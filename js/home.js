// Se NÃO existir sessão válida, volta para o login.
// Isso protege a home de ser acessada sem estar autenticado.
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

// Lista de contatos carregada uma vez, pra preencher o seletor
let contatosCache = [];
async function carregarContatosParaSelecao() {
    const { data, error } = await supabaseClient.from("contatos").select("id, nome").order("nome");
    if (error) return;
    contatosCache = data;

    const select = document.getElementById("compromisso-contato");
    data.forEach((contato) => {
        const option = document.createElement("option");
        option.value = contato.id;
        option.textContent = contato.nome;
        select.appendChild(option);
    });
}
carregarContatosParaSelecao();

// ---------------------------------------------------------------
// Estado da agenda: qual visão está ativa (dia/semana/mes) e qual
// data serve de referência para essa visão.
// ---------------------------------------------------------------
let visaoAtual = "dia";
let dataAtual = new Date();
dataAtual.setHours(0, 0, 0, 0);

// Guarda os compromissos carregados em memória, para poder
// reabrir o formulário de edição sem precisar consultar o banco de novo.
let compromissosCache = [];

const agendaContainerEl = document.getElementById("agenda-container");
const rotuloDataEl = document.getElementById("rotulo-data");
const formularioEl = document.getElementById("formulario-compromisso");
const formEl = document.getElementById("form-compromisso");
const formTituloEl = document.getElementById("form-titulo");
const mensagemErroFormEl = document.getElementById("mensagem-erro-form");

// ---------------------------------------------------------------
// Helpers de data. Evitamos toISOString() para não sofrer com o
// deslocamento de fuso horário (ele converte para UTC e pode
// "voltar" um dia dependendo da hora local).
// ---------------------------------------------------------------
function formatarDataISO(date) {
    const ano = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function formatarHora(hora) {
    return hora ? hora.slice(0, 5) : "";
}

function obterInicioSemana(date) {
    // Semana começando na segunda-feira.
    const d = new Date(date);
    const diaSemana = d.getDay(); // 0=Dom, 1=Seg, ..., 6=Sáb
    const diferenca = diaSemana === 0 ? -6 : 1 - diaSemana;
    d.setDate(d.getDate() + diferenca);
    d.setHours(0, 0, 0, 0);
    return d;
}

function somarDias(date, quantidade) {
    const d = new Date(date);
    d.setDate(d.getDate() + quantidade);
    return d;
}

function agruparPorData(compromissos) {
    const grupos = {};
    compromissos.forEach((c) => {
        if (!grupos[c.data]) grupos[c.data] = [];
        grupos[c.data].push(c);
    });
    return grupos;
}

const NOMES_DIA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const NOMES_MES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ---------------------------------------------------------------
// Controles de visão e navegação
// ---------------------------------------------------------------
document.querySelectorAll(".btn-visao").forEach((botao) => {
    botao.addEventListener("click", () => {
        visaoAtual = botao.dataset.visao;
        renderizarAgenda();
    });
});

document.getElementById("btn-anterior").addEventListener("click", () => {
    navegar(-1);
});

document.getElementById("btn-proximo").addEventListener("click", () => {
    navegar(1);
});

document.getElementById("btn-hoje").addEventListener("click", () => {
    dataAtual = new Date();
    dataAtual.setHours(0, 0, 0, 0);
    renderizarAgenda();
});

function navegar(direcao) {
    if (visaoAtual === "dia") {
        dataAtual = somarDias(dataAtual, direcao);
    } else if (visaoAtual === "semana") {
        dataAtual = somarDias(dataAtual, direcao * 7);
    } else {
        dataAtual = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + direcao, 1);
    }
    renderizarAgenda();
}

// ---------------------------------------------------------------
// Renderização principal: decide qual visão desenhar
// ---------------------------------------------------------------
async function renderizarAgenda() {
    document.querySelectorAll(".btn-visao").forEach((botao) => {
        botao.classList.toggle("ativo", botao.dataset.visao === visaoAtual);
    });

    if (visaoAtual === "dia") {
        atualizarRotuloDia();
        await renderizarDia();
    } else if (visaoAtual === "semana") {
        atualizarRotuloSemana();
        await renderizarSemana();
    } else {
        atualizarRotuloMes();
        await renderizarMes();
    }
}

function atualizarRotuloDia() {
    rotuloDataEl.textContent = dataAtual.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function atualizarRotuloSemana() {
    const inicio = obterInicioSemana(dataAtual);
    const fim = somarDias(inicio, 6);
    const mesmoMes = inicio.getMonth() === fim.getMonth();
    if (mesmoMes) {
        rotuloDataEl.textContent = `${inicio.getDate()} – ${fim.getDate()} de ${NOMES_MES[fim.getMonth()]} de ${fim.getFullYear()}`;
    } else {
        rotuloDataEl.textContent = `${inicio.getDate()} de ${NOMES_MES[inicio.getMonth()]} – ${fim.getDate()} de ${NOMES_MES[fim.getMonth()]} de ${fim.getFullYear()}`;
    }
}

function atualizarRotuloMes() {
    rotuloDataEl.textContent = `${NOMES_MES[dataAtual.getMonth()]} de ${dataAtual.getFullYear()}`;
}

// ---------------------------------------------------------------
// Visão: DIA
// ---------------------------------------------------------------
async function renderizarDia() {
    agendaContainerEl.innerHTML = "Carregando...";

    const dataISO = formatarDataISO(dataAtual);

    const { data, error } = await supabaseClient
        .from("compromissos")
        .select("*")
        .eq("data", dataISO)
        .order("hora_inicio", { ascending: true });

    if (error) {
        console.log(error);
        agendaContainerEl.innerHTML = "Erro ao carregar compromissos.";
        return;
    }

    compromissosCache = data;

    if (data.length === 0) {
        agendaContainerEl.innerHTML = '<p class="agenda-vazio">Nenhum compromisso neste dia.</p>';
        return;
    }

    const lista = document.createElement("div");
    lista.id = "lista-compromissos";

    data.forEach((compromisso) => {
        lista.appendChild(criarItemCompromisso(compromisso));
    });

    agendaContainerEl.innerHTML = "";
    agendaContainerEl.appendChild(lista);
}

function criarItemCompromisso(compromisso) {
    const nomeContato = compromisso.contato_id
        ? contatosCache.find((ct) => ct.id === compromisso.contato_id)?.nome
        : null;

    const item = document.createElement("div");
    item.className = "item-compromisso";
    item.innerHTML = `
        <strong>${formatarHora(compromisso.hora_inicio) || "sem horário"}</strong>
        - ${compromisso.titulo}
        ${compromisso.categoria ? `<em>(${compromisso.categoria})</em>` : ""}
        ${nomeContato ? `<div class="compromisso-contato">Com: ${nomeContato}</div>` : ""}
        <button type="button" class="btn-editar" data-id="${compromisso.id}">Editar</button>
        <button type="button" class="btn-excluir" data-id="${compromisso.id}">Excluir</button>
    `;
    return item;
}

// ---------------------------------------------------------------
// Visão: SEMANA
// ---------------------------------------------------------------
async function renderizarSemana() {
    agendaContainerEl.innerHTML = "Carregando...";

    const inicio = obterInicioSemana(dataAtual);
    const fim = somarDias(inicio, 6);

    const { data, error } = await supabaseClient
        .from("compromissos")
        .select("*")
        .gte("data", formatarDataISO(inicio))
        .lte("data", formatarDataISO(fim))
        .order("hora_inicio", { ascending: true });

    if (error) {
        console.log(error);
        agendaContainerEl.innerHTML = "Erro ao carregar compromissos.";
        return;
    }

    compromissosCache = data;
    const porData = agruparPorData(data);
    const hojeISO = formatarDataISO(new Date());

    const grade = document.createElement("div");
    grade.id = "grade-semana";

    for (let i = 0; i < 7; i++) {
        const diaData = somarDias(inicio, i);
        const diaISO = formatarDataISO(diaData);
        const compromissosDoDia = porData[diaISO] || [];

        const coluna = document.createElement("div");
        coluna.className = "coluna-semana";
        if (diaISO === hojeISO) coluna.classList.add("coluna-hoje");

        const cabecalho = document.createElement("div");
        cabecalho.className = "cabecalho-coluna-semana";
        cabecalho.textContent = `${NOMES_DIA_SEMANA[i]} ${diaData.getDate()}`;
        coluna.appendChild(cabecalho);

        if (compromissosDoDia.length === 0) {
            const vazio = document.createElement("div");
            vazio.className = "semana-vazio";
            vazio.textContent = "—";
            coluna.appendChild(vazio);
        } else {
            compromissosDoDia.forEach((compromisso) => {
                const item = document.createElement("div");
                item.className = "item-semana";
                item.dataset.id = compromisso.id;
                const tituloCurto = compromisso.titulo.length > 8
                    ? compromisso.titulo.slice(0, 8) + "…"
                    : compromisso.titulo;
                item.innerHTML = tituloCurto;
                item.title = compromisso.titulo;
                coluna.appendChild(item);
            });
        }

        grade.appendChild(coluna);
    }

    agendaContainerEl.innerHTML = "";
    agendaContainerEl.appendChild(grade);
}

// ---------------------------------------------------------------
// Visão: MÊS
// ---------------------------------------------------------------
async function renderizarMes() {
    agendaContainerEl.innerHTML = "Carregando...";

    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const { data, error } = await supabaseClient
        .from("compromissos")
        .select("*")
        .gte("data", formatarDataISO(primeiroDia))
        .lte("data", formatarDataISO(ultimoDia));

    if (error) {
        console.log(error);
        agendaContainerEl.innerHTML = "Erro ao carregar compromissos.";
        return;
    }

    compromissosCache = data;
    const porData = agruparPorData(data);
    const hojeISO = formatarDataISO(new Date());

    // Segunda-feira = 0 no nosso layout, então convertemos o getDay() padrão.
    const offsetInicio = (primeiroDia.getDay() + 6) % 7;

    const grade = document.createElement("div");
    grade.id = "grade-mes";

    NOMES_DIA_SEMANA.forEach((nome) => {
        const cabecalho = document.createElement("div");
        cabecalho.className = "cabecalho-coluna-mes";
        cabecalho.textContent = nome;
        grade.appendChild(cabecalho);
    });

    for (let i = 0; i < offsetInicio; i++) {
        const vazio = document.createElement("div");
        vazio.className = "celula-mes celula-mes-vazia";
        grade.appendChild(vazio);
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const diaData = new Date(ano, mes, dia);
        const diaISO = formatarDataISO(diaData);
        const temCompromisso = !!porData[diaISO];

        const celula = document.createElement("div");
        celula.className = "celula-mes";
        if (diaISO === hojeISO) celula.classList.add("celula-hoje");
        celula.dataset.data = diaISO;

        celula.innerHTML = `
            <span class="numero-dia">${dia}</span>
            ${temCompromisso ? '<span class="indicador-compromisso"></span>' : ""}
        `;

        grade.appendChild(celula);
    }

    agendaContainerEl.innerHTML = "";
    agendaContainerEl.appendChild(grade);
}

// ---------------------------------------------------------------
// Cliques dentro da agenda (delegação de evento, já que o
// conteúdo é recriado a cada renderização)
// ---------------------------------------------------------------
agendaContainerEl.addEventListener("click", (evento) => {
    // Editar/excluir (visão dia)
    const idEditar = evento.target.closest(".btn-editar")?.dataset.id;
    if (idEditar) {
        const compromisso = compromissosCache.find((c) => c.id === idEditar);
        if (compromisso) abrirFormulario(compromisso);
        return;
    }

    const idExcluir = evento.target.closest(".btn-excluir")?.dataset.id;
    if (idExcluir) {
        excluirCompromisso(idExcluir);
        return;
    }

    // Clique num compromisso na visão semana → abre para editar
    const itemSemana = evento.target.closest(".item-semana");
    if (itemSemana) {
        const compromisso = compromissosCache.find((c) => c.id === itemSemana.dataset.id);
        if (compromisso) abrirFormulario(compromisso);
        return;
    }

    // Clique num dia na visão mês → pula para a visão dia daquela data
    const celulaMes = evento.target.closest(".celula-mes:not(.celula-mes-vazia)");
    if (celulaMes) {
        const [ano, mes, dia] = celulaMes.dataset.data.split("-").map(Number);
        dataAtual = new Date(ano, mes - 1, dia);
        visaoAtual = "dia";
        renderizarAgenda();
    }
});

// ---------------------------------------------------------------
// Formulário de criar/editar compromisso
// ---------------------------------------------------------------
function abrirFormulario(compromisso = null) {
    mensagemErroFormEl.textContent = "";
    formEl.reset();

    if (compromisso) {
        formTituloEl.textContent = "Editar compromisso";
        document.getElementById("compromisso-id").value = compromisso.id;
        document.getElementById("titulo").value = compromisso.titulo ?? "";
        document.getElementById("descricao").value = compromisso.descricao ?? "";
        document.getElementById("compromisso-contato").value = compromisso.contato_id ?? "";
        document.getElementById("data").value = compromisso.data ?? "";
        document.getElementById("hora_inicio").value = compromisso.hora_inicio ?? "";
        document.getElementById("hora_fim").value = compromisso.hora_fim ?? "";
        document.getElementById("categoria").value = compromisso.categoria ?? "";
        // Repetição só se aplica ao criar; esta ocorrência já existe sozinha.
        document.getElementById("compromisso-recorrencia-linha").style.display = "none";
    } else {
        formTituloEl.textContent = "Novo compromisso";
        document.getElementById("compromisso-id").value = "";
        document.getElementById("compromisso-contato").value = "";
        document.getElementById("compromisso-recorrencia-linha").style.display = "block";
        document.getElementById("repetir-compromisso").checked = false;
        document.getElementById("repetir-opcoes").style.display = "none";
        document.querySelectorAll(".dia-semana-check").forEach((cb) => (cb.checked = false));
        // Sugere a data que está sendo visualizada como padrão
        document.getElementById("data").value = formatarDataISO(dataAtual);
    }

    formularioEl.style.display = "block";
    formularioEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fecharFormulario() {
    formularioEl.style.display = "none";
    formEl.reset();
    mensagemErroFormEl.textContent = "";
}

document.getElementById("btn-novo-compromisso").addEventListener("click", () => {
    abrirFormulario();
});

document.getElementById("btn-cancelar-compromisso").addEventListener("click", () => {
    fecharFormulario();
});

document.getElementById("repetir-compromisso").addEventListener("change", (evento) => {
    document.getElementById("repetir-opcoes").style.display = evento.target.checked ? "block" : "none";

    if (evento.target.checked) {
        // Pré-marca o dia da semana da data já escolhida (ex.: se a data
        // é uma segunda-feira, já marca "Seg" — cobre o caso "toda segunda").
        const dataValor = document.getElementById("data").value;
        if (dataValor) {
            const [ano, mes, dia] = dataValor.split("-").map(Number);
            const diaSemana = new Date(ano, mes - 1, dia).getDay();
            const checkbox = document.querySelector(`.dia-semana-check[value="${diaSemana}"]`);
            if (checkbox) checkbox.checked = true;
        }
    }
});

formEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    mensagemErroFormEl.textContent = "";

    const id = document.getElementById("compromisso-id").value;
    const repetir = !id && document.getElementById("repetir-compromisso").checked;

    const dadosBase = {
        titulo: document.getElementById("titulo").value,
        descricao: document.getElementById("descricao").value || null,
        hora_inicio: document.getElementById("hora_inicio").value || null,
        hora_fim: document.getElementById("hora_fim").value || null,
        categoria: document.getElementById("categoria").value || null,
        contato_id: document.getElementById("compromisso-contato").value || null,
    };

    let resultado;

    if (id) {
        // Edição: atualiza a linha existente.
        // Não é preciso repetir user_id: a política de UPDATE já garante
        // que só a linha do usuário logado pode ser alterada.
        resultado = await supabaseClient
            .from("compromissos")
            .update({ ...dadosBase, data: document.getElementById("data").value })
            .eq("id", id);
    } else if (repetir) {
        const dataInicialStr = document.getElementById("data").value;
        const dataLimiteStr = document.getElementById("repetir-ate").value;

        const diasSelecionados = Array.from(document.querySelectorAll(".dia-semana-check:checked"))
            .map((cb) => Number(cb.value));

        if (!dataLimiteStr) {
            mensagemErroFormEl.textContent = "Informe até quando repetir.";
            return;
        }
        if (diasSelecionados.length === 0) {
            mensagemErroFormEl.textContent = "Marque ao menos um dia da semana para repetir.";
            return;
        }

        const [anoIni, mesIni, diaIni] = dataInicialStr.split("-").map(Number);
        const [anoFim, mesFim, diaFim] = dataLimiteStr.split("-").map(Number);
        const dataLimite = new Date(anoFim, mesFim - 1, diaFim);

        if (dataLimite < new Date(anoIni, mesIni - 1, diaIni)) {
            mensagemErroFormEl.textContent = "A data limite não pode ser antes da data inicial.";
            return;
        }

        const serieId = crypto.randomUUID();
        const linhas = [];
        let cursor = new Date(anoIni, mesIni - 1, diaIni);

        while (cursor <= dataLimite) {
            if (diasSelecionados.includes(cursor.getDay())) {
                linhas.push({
                    ...dadosBase,
                    data: formatarDataISO(cursor),
                    recorrencia: diasSelecionados.length === 7 ? "diaria" : "semanal",
                    dia_semana: diasSelecionados.join(","),
                    serie_id: serieId,
                });
            }
            cursor = somarDias(cursor, 1);
        }

        resultado = await supabaseClient.from("compromissos").insert(linhas);
    } else {
        // Criação: user_id é preenchido automaticamente pelo banco
        // (coluna com "default auth.uid()" configurada no SQL de setup).
        resultado = await supabaseClient
            .from("compromissos")
            .insert({ ...dadosBase, data: document.getElementById("data").value });
    }

    if (resultado.error) {
        console.log(resultado.error);
        mensagemErroFormEl.textContent = "Erro ao salvar: " + resultado.error.message;
        return;
    }

    fecharFormulario();
    renderizarAgenda();
});

async function excluirCompromisso(id) {
    const compromisso = compromissosCache.find((c) => c.id === id);

    if (compromisso && compromisso.serie_id) {
        const excluirSerie = confirm(
            "Este compromisso faz parte de uma repetição.\n\n" +
            "OK = excluir a série inteira\n" +
            "Cancelar = excluir só esta data"
        );

        if (excluirSerie) {
            const { error } = await supabaseClient
                .from("compromissos")
                .delete()
                .eq("serie_id", compromisso.serie_id);

            if (error) {
                alert("Erro ao excluir: " + error.message);
                return;
            }
            renderizarAgenda();
            return;
        }
        // Cancelar no confirm acima cai aqui embaixo e exclui só esta data.
    } else {
        const confirmar = confirm("Excluir este compromisso?");
        if (!confirmar) return;
    }

    const { error } = await supabaseClient
        .from("compromissos")
        .delete()
        .eq("id", id);

    if (error) {
        console.log(error);
        alert("Erro ao excluir: " + error.message);
        return;
    }

    renderizarAgenda();
}

document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

// =================================================================
// TAREFAS DA SEMANA
// Lista de tarefas recorrentes (checklist), sem data fixa de
// compromisso. Cada tarefa guarda a data da última revisão. Toda
// segunda-feira, tarefas não revisadas nesta semana disparam um
// aviso para o usuário renovar ou excluir cada uma.
// =================================================================
let tarefasCache = [];

const listaTarefasEl = document.getElementById("lista-tarefas");
const formNovaTarefaEl = document.getElementById("form-nova-tarefa");
const btnRevisarTarefasEl = document.getElementById("btn-revisar-tarefas");
const badgeRevisarEl = document.getElementById("badge-revisar");
const modalRevisaoEl = document.getElementById("modal-revisao");
const listaRevisaoEl = document.getElementById("lista-revisao");

// Chave usada para não insistir com o modal automático mais de uma
// vez no mesmo dia, caso o usuário só feche sem decidir nada.
const CHAVE_DISPENSA_REVISAO = "revisaoTarefasDispensadaEm";

async function carregarTarefas() {
    listaTarefasEl.innerHTML = "Carregando tarefas...";

    const { data, error } = await supabaseClient
        .from("tarefas_semana")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.log(error);
        listaTarefasEl.innerHTML = "Erro ao carregar tarefas.";
        return;
    }

    tarefasCache = data;
    renderizarTarefas();
    atualizarBadgeRevisar();
}

function renderizarTarefas() {
    if (tarefasCache.length === 0) {
        listaTarefasEl.innerHTML = '<p class="agenda-vazio">Nenhuma tarefa cadastrada.</p>';
        return;
    }

    listaTarefasEl.innerHTML = "";

    tarefasCache.forEach((tarefa) => {
        const item = document.createElement("div");
        item.className = "item-tarefa";
        if (tarefa.feita) item.classList.add("tarefa-feita");
        item.dataset.id = tarefa.id;
        item.innerHTML = `
            <label class="tarefa-checkbox-linha">
                <input type="checkbox" class="tarefa-checkbox" ${tarefa.feita ? "checked" : ""}>
                <span class="tarefa-titulo">${tarefa.titulo}</span>
            </label>
            <div class="tarefa-acoes">
                <button type="button" class="btn-editar-tarefa" aria-label="Editar">&#9998;</button>
                <button type="button" class="btn-excluir-tarefa" aria-label="Excluir">&times;</button>
            </div>
        `;
        listaTarefasEl.appendChild(item);
    });
}

listaTarefasEl.addEventListener("click", async (evento) => {
    const item = evento.target.closest(".item-tarefa");
    if (!item) return;
    const id = item.dataset.id;
    const tarefa = tarefasCache.find((t) => t.id === id);
    if (!tarefa) return;

    if (evento.target.classList.contains("tarefa-checkbox")) {
        const { error } = await supabaseClient
            .from("tarefas_semana")
            .update({ feita: evento.target.checked })
            .eq("id", id);
        if (error) {
            console.log(error);
            alert("Erro ao atualizar tarefa: " + error.message);
            return;
        }
        tarefa.feita = evento.target.checked;
        item.classList.toggle("tarefa-feita", tarefa.feita);
        return;
    }

    if (evento.target.closest(".btn-editar-tarefa")) {
        const novoTitulo = prompt("Editar tarefa:", tarefa.titulo);
        if (novoTitulo === null || novoTitulo.trim() === "") return;

        const { error } = await supabaseClient
            .from("tarefas_semana")
            .update({ titulo: novoTitulo.trim() })
            .eq("id", id);
        if (error) {
            console.log(error);
            alert("Erro ao editar tarefa: " + error.message);
            return;
        }
        tarefa.titulo = novoTitulo.trim();
        renderizarTarefas();
        return;
    }

    if (evento.target.closest(".btn-excluir-tarefa")) {
        const confirmar = confirm("Excluir esta tarefa?");
        if (!confirmar) return;
        await excluirTarefa(id);
    }
});

async function excluirTarefa(id) {
    const { error } = await supabaseClient
        .from("tarefas_semana")
        .delete()
        .eq("id", id);

    if (error) {
        console.log(error);
        alert("Erro ao excluir tarefa: " + error.message);
        return;
    }

    tarefasCache = tarefasCache.filter((t) => t.id !== id);
    renderizarTarefas();
    atualizarBadgeRevisar();
}

async function renovarTarefa(id) {
    const hojeISO = formatarDataISO(new Date());
    const { error } = await supabaseClient
        .from("tarefas_semana")
        .update({ ultima_revisao: hojeISO })
        .eq("id", id);

    if (error) {
        console.log(error);
        alert("Erro ao renovar tarefa: " + error.message);
        return;
    }

    const tarefa = tarefasCache.find((t) => t.id === id);
    if (tarefa) tarefa.ultima_revisao = hojeISO;
    atualizarBadgeRevisar();
}

formNovaTarefaEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const inputEl = document.getElementById("nova-tarefa-titulo");
    const titulo = inputEl.value.trim();
    if (!titulo) return;

    const { data, error } = await supabaseClient
        .from("tarefas_semana")
        .insert({ titulo })
        .select()
        .single();

    if (error) {
        console.log(error);
        alert("Erro ao criar tarefa: " + error.message);
        return;
    }

    tarefasCache.push(data);
    inputEl.value = "";
    renderizarTarefas();
});

// ---------------------------------------------------------------
// Revisão semanal: tarefas cuja "ultima_revisao" é anterior à
// segunda-feira desta semana estão pendentes de revisão.
// ---------------------------------------------------------------
function tarefasPendentesRevisao() {
    const inicioSemanaISO = formatarDataISO(obterInicioSemana(new Date()));
    return tarefasCache.filter((t) => t.ultima_revisao < inicioSemanaISO);
}

function atualizarBadgeRevisar() {
    const pendentes = tarefasPendentesRevisao();
    if (pendentes.length === 0) {
        btnRevisarTarefasEl.style.display = "none";
        return;
    }
    btnRevisarTarefasEl.style.display = "inline-flex";
    badgeRevisarEl.textContent = pendentes.length;
}

function abrirModalRevisao() {
    const pendentes = tarefasPendentesRevisao();
    if (pendentes.length === 0) return;

    listaRevisaoEl.innerHTML = "";
    pendentes.forEach((tarefa) => {
        const linha = document.createElement("div");
        linha.className = "item-revisao";
        linha.dataset.id = tarefa.id;
        linha.innerHTML = `
            <span class="tarefa-titulo">${tarefa.titulo}</span>
            <div class="tarefa-acoes">
                <button type="button" class="btn-renovar-uma">Renovar</button>
                <button type="button" class="btn-excluir-uma">Excluir</button>
            </div>
        `;
        listaRevisaoEl.appendChild(linha);
    });

    modalRevisaoEl.style.display = "flex";
}

function fecharModalRevisao() {
    modalRevisaoEl.style.display = "none";
    localStorage.setItem(CHAVE_DISPENSA_REVISAO, formatarDataISO(new Date()));
}

listaRevisaoEl.addEventListener("click", async (evento) => {
    const linha = evento.target.closest(".item-revisao");
    if (!linha) return;
    const id = linha.dataset.id;

    if (evento.target.classList.contains("btn-renovar-uma")) {
        await renovarTarefa(id);
        linha.remove();
    } else if (evento.target.classList.contains("btn-excluir-uma")) {
        await excluirTarefa(id);
        linha.remove();
    }

    if (listaRevisaoEl.children.length === 0) {
        modalRevisaoEl.style.display = "none";
    }
    atualizarBadgeRevisar();
});

btnRevisarTarefasEl.addEventListener("click", abrirModalRevisao);
document.getElementById("btn-fechar-revisao").addEventListener("click", fecharModalRevisao);

document.getElementById("btn-renovar-todas").addEventListener("click", async () => {
    const pendentes = tarefasPendentesRevisao();
    for (const tarefa of pendentes) {
        await renovarTarefa(tarefa.id);
    }
    listaRevisaoEl.innerHTML = "";
    modalRevisaoEl.style.display = "none";
    atualizarBadgeRevisar();
});

async function verificarAvisoSegundaFeira() {
    const ehSegunda = new Date().getDay() === 1;
    if (!ehSegunda) return;

    const hojeISO = formatarDataISO(new Date());
    const dispensadoHoje = localStorage.getItem(CHAVE_DISPENSA_REVISAO) === hojeISO;
    if (dispensadoHoje) return;

    if (tarefasPendentesRevisao().length > 0) {
        abrirModalRevisao();
    }
}

// ---------------------------------------------------------------
// Primeira renderização
// ---------------------------------------------------------------
renderizarAgenda();

(async function iniciarTarefas() {
    await carregarTarefas();
    await verificarAvisoSegundaFeira();
})();
