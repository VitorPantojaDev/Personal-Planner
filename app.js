// ============================================================
// CONFIGURAÇÃO — preencha com os valores do seu projeto Supabase
// (Project Settings > API)
// ============================================================
const SUPABASE_URL = "https://khviaakdorvkehjxdvfh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmlhYWtkb3J2a2VoanhkdmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU4MTEsImV4cCI6MjEwMTQwMTgxMX0.5JxJ6FujxFomKnYCLW4sh9fhCEJ8lCEjUZblaOwbbxQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// ELEMENTOS DA TELA
// ============================================================
const telaLogin = document.getElementById("tela-login");
const telaApp = document.getElementById("tela-app");
const formLogin = document.getElementById("form-login");
const loginErro = document.getElementById("login-erro");
const usuarioLogadoSpan = document.getElementById("usuario-logado");
const btnSair = document.getElementById("btn-sair");

const listaCompromissos = document.getElementById("lista-compromissos");
const formCompromisso = document.getElementById("form-compromisso");
const agendaDataAtualSpan = document.getElementById("agenda-data-atual");
const btnDiaAnterior = document.getElementById("dia-anterior");
const btnProximoDia = document.getElementById("proximo-dia");
const btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");

let dataSelecionada = new Date();

// ============================================================
// AUTENTICAÇÃO
// ============================================================

async function iniciar() {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
        mostrarApp(data.session.user);
    } else {
        mostrarLogin();
    }
}

function mostrarLogin() {
    telaLogin.classList.remove("oculto");
    telaApp.classList.add("oculto");
}

function mostrarApp(usuario) {
    telaLogin.classList.add("oculto");
    telaApp.classList.remove("oculto");
    usuarioLogadoSpan.textContent = usuario.email;
    carregarCompromissosDoDia();
}

formLogin.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    loginErro.textContent = "";

    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha
    });

    if (error) {
        loginErro.textContent = "Erro ao entrar: " + error.message;
        return;
    }

    mostrarApp(data.user);
});

btnSair.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    mostrarLogin();
});

// ============================================================
// NAVEGAÇÃO ENTRE ABAS
// ============================================================
document.querySelectorAll(".aba-btn").forEach((botao) => {
    botao.addEventListener("click", () => {
        document.querySelectorAll(".aba-btn").forEach((b) => b.classList.remove("ativa"));
        document.querySelectorAll(".aba-conteudo").forEach((c) => c.classList.add("oculto"));

        botao.classList.add("ativa");
        document.getElementById("aba-" + botao.dataset.aba).classList.remove("oculto");
    });
});

// ============================================================
// AGENDA — VISÃO DIA
// ============================================================

function formatarDataISO(data) {
    // yyyy-mm-dd, respeitando o fuso horário local (evita bug de -1 dia)
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function formatarDataExibicao(data) {
    return data.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
}

async function carregarCompromissosDoDia() {
    agendaDataAtualSpan.textContent = formatarDataExibicao(dataSelecionada);
    const dataISO = formatarDataISO(dataSelecionada);

    const { data, error } = await supabaseClient
        .from("compromissos")
        .select("*")
        .eq("data", dataISO)
        .order("hora_inicio", { ascending: true, nullsFirst: false });

    if (error) {
        console.error("Erro ao carregar compromissos:", error.message);
        return;
    }

    renderizarCompromissos(data);
}

function renderizarCompromissos(compromissos) {
    listaCompromissos.innerHTML = "";

    if (compromissos.length === 0) {
        listaCompromissos.innerHTML = "<li>Nenhum compromisso neste dia.</li>";
        return;
    }

    compromissos.forEach((c) => {
        const item = document.createElement("li");

        const horario = c.hora_inicio
            ? c.hora_inicio.slice(0, 5) + (c.hora_fim ? " - " + c.hora_fim.slice(0, 5) : "")
            : "Sem horário";

        item.innerHTML = `
            <strong>${c.titulo}</strong>
            ${c.categoria ? `<span> · ${c.categoria}</span>` : ""}
            <div class="compromisso-horario">${horario}</div>
            ${c.descricao ? `<div>${c.descricao}</div>` : ""}
            <div class="compromisso-acoes">
                <button class="btn-editar">Editar</button>
                <button class="btn-excluir">Excluir</button>
            </div>
        `;

        item.querySelector(".btn-editar").addEventListener("click", () => preencherFormularioParaEdicao(c));
        item.querySelector(".btn-excluir").addEventListener("click", () => excluirCompromisso(c.id));

        listaCompromissos.appendChild(item);
    });
}

btnDiaAnterior.addEventListener("click", () => {
    dataSelecionada.setDate(dataSelecionada.getDate() - 1);
    carregarCompromissosDoDia();
});

btnProximoDia.addEventListener("click", () => {
    dataSelecionada.setDate(dataSelecionada.getDate() + 1);
    carregarCompromissosDoDia();
});

// ---- Criar / Editar ----

formCompromisso.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const id = document.getElementById("compromisso-id").value;

    const registro = {
        titulo: document.getElementById("titulo").value,
        descricao: document.getElementById("descricao").value || null,
        data: formatarDataISO(dataSelecionada),
        hora_inicio: document.getElementById("hora-inicio").value || null,
        hora_fim: document.getElementById("hora-fim").value || null,
        categoria: document.getElementById("categoria").value || null
    };

    const { data: sessao } = await supabaseClient.auth.getSession();
    registro.user_id = sessao.session.user.id;

    let resultado;
    if (id) {
        resultado = await supabaseClient.from("compromissos").update(registro).eq("id", id);
    } else {
        resultado = await supabaseClient.from("compromissos").insert(registro);
    }

    if (resultado.error) {
        alert("Erro ao salvar: " + resultado.error.message);
        return;
    }

    limparFormulario();
    carregarCompromissosDoDia();
});

function preencherFormularioParaEdicao(c) {
    document.getElementById("compromisso-id").value = c.id;
    document.getElementById("titulo").value = c.titulo;
    document.getElementById("descricao").value = c.descricao || "";
    document.getElementById("hora-inicio").value = c.hora_inicio ? c.hora_inicio.slice(0, 5) : "";
    document.getElementById("hora-fim").value = c.hora_fim ? c.hora_fim.slice(0, 5) : "";
    document.getElementById("categoria").value = c.categoria || "";
    btnCancelarEdicao.classList.remove("oculto");
    document.getElementById("titulo").scrollIntoView({ behavior: "smooth" });
}

btnCancelarEdicao.addEventListener("click", limparFormulario);

function limparFormulario() {
    formCompromisso.reset();
    document.getElementById("compromisso-id").value = "";
    btnCancelarEdicao.classList.add("oculto");
}

// ---- Excluir ----

async function excluirCompromisso(id) {
    const confirmar = confirm("Excluir este compromisso?");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("compromissos").delete().eq("id", id);

    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    carregarCompromissosDoDia();
}

// ============================================================
iniciar();
