// Protege a página: sem sessão válida, volta para o login.
async function protegerPagina() {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
        window.location.href = "index.html";
        return;
    }
    document.getElementById("email-usuario").textContent =
        "Logado como: " + data.session.user.email;
}
protegerPagina();

// ---------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------
const listaCursosEl = document.getElementById("lista-cursos");

const formularioCursoEl = document.getElementById("formulario-curso");
const formCursoEl = document.getElementById("form-curso");
const formCursoTituloEl = document.getElementById("form-curso-titulo");
const mensagemErroCursoEl = document.getElementById("mensagem-erro-curso");

const formularioSessaoEl = document.getElementById("formulario-sessao");
const formSessaoEl = document.getElementById("form-sessao");
const mensagemErroSessaoEl = document.getElementById("mensagem-erro-sessao");

const pesquisaCursosEl = document.getElementById("pesquisa-cursos");
pesquisaCursosEl.addEventListener("input", () => {
    const termo = pesquisaCursosEl.value.toLowerCase();
    const filtrados = cursosCache.filter((c) => c.nome.toLowerCase().includes(termo));
    renderizarCursos(filtrados);
});

let cursosCache = [];

let sessoesHojeCache = {}; // { curso_id: horas somadas hoje }

async function carregarSessoesHoje() {
    const hojeISO = formatarDataISO(new Date());
    const { data, error } = await supabaseClient
        .from("sessoes_estudo")
        .select("curso_id, horas")
        .eq("data", hojeISO);

    if (error) {
        console.log(error);
        sessoesHojeCache = {};
        return;
    }

    sessoesHojeCache = {};
    data.forEach((sessao) => {
        sessoesHojeCache[sessao.curso_id] = (sessoesHojeCache[sessao.curso_id] || 0) + sessao.horas;
    });
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function formatarDataISO(date) {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function horasParaHHMM(horasDecimais) {
    const totalMinutos = Math.round(horasDecimais * 60);
    const sinal = totalMinutos < 0 ? "-" : "";
    const abs = Math.abs(totalMinutos);
    const horas = Math.floor(abs / 60);
    const minutos = abs % 60;
    return `${sinal}${horas}:${String(minutos).padStart(2, "0")}`;
}

function hhmmParaHoras(texto) {
    const partes = String(texto).trim().split(":");
    const horas = parseInt(partes[0], 10) || 0;
    const minutos = partes[1] ? parseInt(partes[1], 10) || 0 : 0;
    return horas + minutos / 60;
}

function calcularProgresso(curso, horasHoje = 0) {
    const horasRestantes = Math.max(0, curso.carga_horaria_total - curso.horas_estudadas);
    const percentual = curso.carga_horaria_total > 0
        ? Math.min(100, (curso.horas_estudadas / curso.carga_horaria_total) * 100)
        : 0;

    // Desconta o que já foi estudado hoje, para pegar a meta que existia
    // no início do dia — sem ela se recalcular sozinha durante o dia.
    const horasEstudadasAntesHoje = Math.max(0, curso.horas_estudadas - horasHoje);
    const horasRestantesAntesHoje = Math.max(0, curso.carga_horaria_total - horasEstudadasAntesHoje);

    function montarMetaHoje(diasParaMeta) {
        if (horasRestantesAntesHoje <= 0) {
            return { horasHoje, metaHojeHoras: 0, percentualHoje: 100 };
        }
        const metaHojeHoras = horasRestantesAntesHoje / diasParaMeta;
        const percentualHoje = Math.min(100, (horasHoje / metaHojeHoras) * 100);
        return { horasHoje, metaHojeHoras, percentualHoje };
    }

    if (!curso.data_limite) {
        // Sem data limite não dá para calcular uma meta diária com sentido.
        return { horasRestantes, percentual, horasPorDia: null, status: "sem-prazo", metaHoje: null };
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(curso.data_limite + "T00:00:00");
    const diffMs = limite - hoje;
    const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diasParaMeta = diasRestantes > 0 ? diasRestantes : 1;
    const metaHoje = montarMetaHoje(diasParaMeta);

    if (horasRestantes <= 0) {
        return { horasRestantes: 0, percentual: 100, horasPorDia: 0, status: "concluido", metaHoje };
    }

    if (diasRestantes <= 0) {
        return { horasRestantes, percentual, horasPorDia: null, status: "vencido", metaHoje };
    }

    const horasPorDia = horasRestantes / diasRestantes;
    let status = "ok";
    if (horasPorDia > 4) status = "urgente";
    else if (horasPorDia > 2) status = "atencao";

    return { horasRestantes, percentual, horasPorDia, diasRestantes, status, metaHoje };
}

// ---------------------------------------------------------------
// Carregar e renderizar cursos
// ---------------------------------------------------------------
async function carregarCursos() {
    listaCursosEl.innerHTML = "Carregando...";

    const resultadoCursos = await supabaseClient
        .from("cursos")
        .select("*")
        .eq("ativo", true)
        .order("data_limite", { ascending: true, nullsFirst: false });

    await carregarSessoesHoje();

    if (resultadoCursos.error) {
        console.log(resultadoCursos.error);
        listaCursosEl.innerHTML = "Erro ao carregar cursos.";
        return;
    }

    cursosCache = resultadoCursos.data;
    renderizarCursos(cursosCache);
}

function renderizarCursos(cursos) {
    if (cursos.length === 0) {
        listaCursosEl.innerHTML = '<p class="agenda-vazio">Nenhum curso cadastrado.</p>';
        return;
    }

    listaCursosEl.innerHTML = "";

    cursos.forEach((curso) => {
        const progresso = calcularProgresso(curso, sessoesHojeCache[curso.id] || 0);

        const card = document.createElement("div");
        card.className = "card-curso status-" + progresso.status;

        let linhaMeta;
        if (progresso.status === "vencido") {
            linhaMeta = "Prazo vencido, ainda faltam " + horasParaHHMM(progresso.horasRestantes) + ".";
        } else if (progresso.status === "sem-prazo") {
            linhaMeta = "Sem data limite definida.";
        } else {
            linhaMeta = `Faltam ${horasParaHHMM(progresso.horasRestantes)} em ${progresso.diasRestantes} dia(s) — `
                + `<strong>${horasParaHHMM(progresso.horasPorDia)}/dia</strong>`;
        }

        const linkSeguro = curso.link && /^https?:\/\//i.test(curso.link) ? curso.link : null;
        const linkHtml = linkSeguro
            ? `<div class="curso-link"><a href="${escapeHtml(linkSeguro)}" target="_blank" rel="noopener">Acessar material</a></div>`
            : "";

        const observacoesHtml = curso.observacoes
            ? `<div class="curso-observacoes">${escapeHtml(curso.observacoes)}</div>`
            : "";

        const metaHojeHtml = !progresso.metaHoje
            ? ""
            : progresso.metaHoje.metaHojeHoras > 0
                ? `<div class="meta-hoje">Hoje: ${horasParaHHMM(progresso.metaHoje.horasHoje)} / ${horasParaHHMM(progresso.metaHoje.metaHojeHoras)} — <strong>${progresso.metaHoje.percentualHoje.toFixed(0)}%</strong> da meta do dia</div>`
                : `<div class="meta-hoje meta-hoje-cumprida">Meta do dia já cumprida.</div>`;
            
        card.innerHTML = `
            <div class="card-curso-cabecalho">
                <strong>${escapeHtml(curso.nome)}</strong>
                <span class="curso-horas">${horasParaHHMM(curso.horas_estudadas)} / ${horasParaHHMM(curso.carga_horaria_total)}</span>
            </div>
            <div class="barra-progresso">
                <div class="barra-progresso-preenchida" style="width: ${progresso.percentual}%;"></div>
            </div>
            <div class="card-curso-meta">${linhaMeta}</div>
            ${metaHojeHtml}
            ${linkHtml}
            ${observacoesHtml}
            <div class="card-curso-acoes">
                <button type="button" class="btn-registrar-sessao" data-id="${curso.id}">Registrar sessão</button>
                <button type="button" class="btn-editar-curso" data-id="${curso.id}">Editar</button>
                <button type="button" class="btn-excluir-curso" data-id="${curso.id}">Excluir</button>
            </div>
        `;

        listaCursosEl.appendChild(card);
    });
}

listaCursosEl.addEventListener("click", (evento) => {
    const idSessao = evento.target.closest(".btn-registrar-sessao")?.dataset.id;
    if (idSessao) {
        abrirFormularioSessao(idSessao);
        return;
    }

    const idEditar = evento.target.closest(".btn-editar-curso")?.dataset.id;
    if (idEditar) {
        const curso = cursosCache.find((c) => c.id === idEditar);
        if (curso) abrirFormularioCurso(curso);
        return;
    }

    const idExcluir = evento.target.closest(".btn-excluir-curso")?.dataset.id;
    if (idExcluir) {
        excluirCurso(idExcluir);
        return;
    }
});

// ---------------------------------------------------------------
// Criar / Editar curso
// ---------------------------------------------------------------
document.getElementById("btn-novo-curso").addEventListener("click", () => {
    abrirFormularioCurso();
});

document.getElementById("btn-cancelar-curso").addEventListener("click", fecharFormularioCurso);

function abrirFormularioCurso(curso = null) {
    mensagemErroCursoEl.textContent = "";
    formCursoEl.reset();

    if (curso) {
        formCursoTituloEl.textContent = "Editar curso";
        document.getElementById("curso-id").value = curso.id;
        document.getElementById("curso-nome").value = curso.nome;
        document.getElementById("curso-carga-total").value = curso.carga_horaria_total;
        document.getElementById("curso-data-limite").value = curso.data_limite || "";
        document.getElementById("curso-link").value = curso.link || "";
        document.getElementById("curso-observacoes").value = curso.observacoes || "";
    } else {
        formCursoTituloEl.textContent = "Novo curso";
        document.getElementById("curso-id").value = "";
    }

    formularioCursoEl.style.display = "block";
    formularioCursoEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fecharFormularioCurso() {
    formularioCursoEl.style.display = "none";
    formCursoEl.reset();
    mensagemErroCursoEl.textContent = "";
}

formCursoEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemErroCursoEl.textContent = "";

    const id = document.getElementById("curso-id").value;

    const dadosCurso = {
        nome: document.getElementById("curso-nome").value,
        carga_horaria_total: parseFloat(document.getElementById("curso-carga-total").value),
        data_limite: document.getElementById("curso-data-limite").value || null,
        link: document.getElementById("curso-link").value || null,
        observacoes: document.getElementById("curso-observacoes").value || null
    };

    let resultado;
    if (id) {
        resultado = await supabaseClient.from("cursos").update(dadosCurso).eq("id", id);
    } else {
        resultado = await supabaseClient.from("cursos").insert(dadosCurso);
    }

    if (resultado.error) {
        mensagemErroCursoEl.textContent = "Erro ao salvar: " + resultado.error.message;
        return;
    }

    fecharFormularioCurso();
    carregarCursos();
});

async function excluirCurso(id) {
    const confirmar = confirm("Excluir este curso? As sessões de estudo registradas também serão apagadas.");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("cursos").delete().eq("id", id);

    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    carregarCursos();
}

// ---------------------------------------------------------------
// Registrar sessão de estudo
// ---------------------------------------------------------------
function abrirFormularioSessao(cursoId) {
    mensagemErroSessaoEl.textContent = "";
    formSessaoEl.reset();
    document.getElementById("sessao-curso-id").value = cursoId;
    document.getElementById("sessao-data").value = formatarDataISO(new Date());

    formularioSessaoEl.style.display = "block";
    formularioSessaoEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("btn-cancelar-sessao").addEventListener("click", () => {
    formularioSessaoEl.style.display = "none";
    formSessaoEl.reset();
    mensagemErroSessaoEl.textContent = "";
});

formSessaoEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemErroSessaoEl.textContent = "";

    const cursoId = document.getElementById("sessao-curso-id").value;
    const valorHoras = document.getElementById("sessao-horas").value.trim();
        if (!/^\d+:[0-5]\d$/.test(valorHoras)) {
            mensagemErroSessaoEl.textContent = "Informe as horas no formato hh:mm.";
            return;
    }
    const horas = hhmmParaHoras(valorHoras);

    const dadosSessao = {
        curso_id: cursoId,
        data: document.getElementById("sessao-data").value,
        horas: horas,
        observacao: document.getElementById("sessao-observacao").value || null
    };

    const { error: erroSessao } = await supabaseClient.from("sessoes_estudo").insert(dadosSessao);

    if (erroSessao) {
        mensagemErroSessaoEl.textContent = "Erro ao registrar: " + erroSessao.message;
        return;
    }

document.getElementById("sessao-horas").addEventListener("input", (evento) => {
    let valor = evento.target.value.replace(/[^0-9:]/g, "");

    const partes = valor.split(":");
    if (partes.length > 2) {
        valor = partes[0] + ":" + partes.slice(1).join("");
    }

    evento.target.value = valor;
});


    // Atualiza o acumulado de horas estudadas do curso.
    const curso = cursosCache.find((c) => c.id === cursoId);
    const novoTotal = (curso ? curso.horas_estudadas : 0) + horas;

    const { error: erroCurso } = await supabaseClient
        .from("cursos")
        .update({ horas_estudadas: novoTotal })
        .eq("id", cursoId);

    if (erroCurso) {
        mensagemErroSessaoEl.textContent = "Sessão registrada, mas houve erro ao atualizar o total: " + erroCurso.message;
        return;
    }

    formularioSessaoEl.style.display = "none";
    formSessaoEl.reset();
    carregarCursos();
});

// ---------------------------------------------------------------
document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

carregarCursos();

// ---------------------------------------------------------------
// Cronômetro de estudos (tipo Pomodoro)
// ---------------------------------------------------------------
const cronometroMinutosEl = document.getElementById("cronometro-minutos");
const cronometroDisplayEl = document.getElementById("cronometro-display");
const cronometroStatusEl = document.getElementById("cronometro-status");
const btnCronometroIniciarEl = document.getElementById("btn-cronometro-iniciar");
const btnCronometroPausarEl = document.getElementById("btn-cronometro-pausar");
const btnCronometroZerarEl = document.getElementById("btn-cronometro-zerar");

let cronometroIntervalo = null;
let cronometroSegundosRestantes = 0;
let cronometroSegundosTotais = 0;
let audioContextoCronometro = null;

function formatarTempoCronometro(segundos) {
    const m = Math.floor(segundos / 60).toString().padStart(2, "0");
    const s = Math.floor(segundos % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function atualizarPonteirosCronometro() {
    const decorrido = cronometroSegundosTotais - cronometroSegundosRestantes;
    const progresso = cronometroSegundosTotais > 0 ? decorrido / cronometroSegundosTotais : 0;

    // Ponteiro principal: uma volta completa (360°) ao longo de todo o tempo definido pelo usuário.
    const anguloProgresso = progresso * 360;

    // Ponteiro fino: continua marcando os segundos reais, só para dar sensação de movimento contínuo.
    const anguloSegundos = (decorrido % 60) * 6;

    document.getElementById("ponteiro-segundos").setAttribute("transform", `rotate(${anguloSegundos} 100 100)`);
    document.getElementById("ponteiro-minutos").setAttribute("transform", `rotate(${anguloProgresso} 100 100)`);
}

function atualizarDisplayCronometro() {
    cronometroDisplayEl.textContent = formatarTempoCronometro(cronometroSegundosRestantes);
    const decorrido = cronometroSegundosTotais - cronometroSegundosRestantes;
    cronometroStatusEl.textContent = `Tempo decorrido: ${formatarTempoCronometro(decorrido)}`;
    document.getElementById("cronometro-mini").textContent = cronometroIntervalo
        ? `— ${formatarTempoCronometro(cronometroSegundosRestantes)}`
        : "";
    atualizarPonteirosCronometro();
}

function pararCronometro() {
    if (cronometroIntervalo) {
        clearInterval(cronometroIntervalo);
        cronometroIntervalo = null;
    }
    btnCronometroIniciarEl.disabled = false;
    btnCronometroPausarEl.disabled = true;
}

function tocarAlarmeCronometro() {
    try {
        if (!audioContextoCronometro) {
            audioContextoCronometro = new (window.AudioContext || window.webkitAudioContext)();
        }
        const duracaoBip = 0.35;
        for (let i = 0; i < 3; i++) {
            const osc = audioContextoCronometro.createOscillator();
            const ganho = audioContextoCronometro.createGain();
            osc.connect(ganho);
            ganho.connect(audioContextoCronometro.destination);
            osc.type = "sine";
            osc.frequency.value = 880;

            const inicio = audioContextoCronometro.currentTime + i * (duracaoBip + 0.15);
            ganho.gain.setValueAtTime(0.2, inicio);
            ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracaoBip);

            osc.start(inicio);
            osc.stop(inicio + duracaoBip);
        }
    } catch (erro) {
        console.log("Não foi possível tocar o alarme:", erro);
    }
}

document.getElementById("btn-toggle-cronometro").addEventListener("click", () => {
    document.getElementById("cronometro-conteudo").classList.toggle("oculto");
});

btnCronometroIniciarEl.addEventListener("click", () => {
    if (cronometroIntervalo) return;

    // Cria o contexto de áudio já aqui (dentro do clique do usuário),
    // pois navegadores bloqueiam som iniciado fora de uma ação direta.
    if (!audioContextoCronometro) {
        audioContextoCronometro = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (cronometroSegundosRestantes === 0) {
        const minutos = parseFloat(cronometroMinutosEl.value) || 25;
        cronometroSegundosTotais = Math.round(minutos * 60);
        cronometroSegundosRestantes = cronometroSegundosTotais;
    }

    cronometroMinutosEl.disabled = true;
    btnCronometroIniciarEl.disabled = true;
    btnCronometroPausarEl.disabled = false;

    cronometroIntervalo = setInterval(() => {
        cronometroSegundosRestantes--;
        atualizarDisplayCronometro();

        if (cronometroSegundosRestantes <= 0) {
            pararCronometro();
            tocarAlarmeCronometro();
            cronometroStatusEl.textContent = "Tempo esgotado!";
            cronometroSegundosRestantes = 0;
        }
    }, 1000);

    atualizarDisplayCronometro();
});

btnCronometroPausarEl.addEventListener("click", () => {
    const decorrido = cronometroSegundosTotais - cronometroSegundosRestantes;
    pararCronometro();
    cronometroStatusEl.textContent = `Pausado — ${formatarTempoCronometro(decorrido)} decorridos.`;
});

btnCronometroZerarEl.addEventListener("click", () => {
    pararCronometro();
    cronometroSegundosRestantes = 0;
    cronometroSegundosTotais = 0;
    cronometroMinutosEl.disabled = false;
    const minutos = parseFloat(cronometroMinutosEl.value) || 0;
    cronometroDisplayEl.textContent = formatarTempoCronometro(minutos * 60);
    cronometroStatusEl.textContent = "";
    document.getElementById("ponteiro-segundos").setAttribute("transform", "rotate(0 100 100)");
    document.getElementById("ponteiro-minutos").setAttribute("transform", "rotate(0 100 100)");
});

cronometroMinutosEl.addEventListener("input", () => {
    if (!cronometroIntervalo && cronometroSegundosRestantes === 0) {
        const minutos = parseFloat(cronometroMinutosEl.value) || 0;
        cronometroDisplayEl.textContent = formatarTempoCronometro(minutos * 60);
    }
});

// ---------------------------------------------------------------
// Exportar cursos em texto
// ---------------------------------------------------------------
document.getElementById("btn-baixar-cursos").addEventListener("click", () => {
    let texto = "Cursos\n\n";

    if (cursosCache.length === 0) {
        texto += "Nenhum curso cadastrado.";
    } else {
        cursosCache.forEach((curso) => {
            const progresso = calcularProgresso(curso);
            const horasDia = (progresso.horasPorDia ?? null) !== null
                ? horasParaHHMM(progresso.horasPorDia) + "/dia"
                : "-";

            texto += `${curso.nome}\n`;
            texto += `Carga horária: ${horasParaHHMM(curso.carga_horaria_total)} (estudadas: ${horasParaHHMM(curso.horas_estudadas)})\n`;
            texto += `Data limite: ${curso.data_limite || "-"}\n`;
            texto += `Necessário para cumprir o prazo: ${horasDia}\n`;
            if (curso.link) texto += `Link: ${curso.link}\n`;
            if (curso.observacoes) texto += `Observações: ${curso.observacoes}\n`;
            texto += "\n";
        });
    }

    baixarArquivo("cursos.txt", texto.trim(), "text/plain");
});
