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

// Guarda os compromissos carregados em memória, para poder
// reabrir o formulário de edição sem precisar consultar o banco de novo.
let compromissosCache = [];

const listaEl = document.getElementById("lista-compromissos");
const formularioEl = document.getElementById("formulario-compromisso");
const formEl = document.getElementById("form-compromisso");
const formTituloEl = document.getElementById("form-titulo");
const mensagemErroFormEl = document.getElementById("mensagem-erro-form");

async function carregarCompromissosHoje() {

    listaEl.innerHTML = "Carregando...";

    const hoje = new Date().toISOString().split("T")[0];

    const { data, error } = await supabaseClient
        .from("compromissos")
        .select("*")
        .eq("data", hoje)
        .order("hora_inicio", { ascending: true });

    if (error) {
        console.log("ERRO COMPLETO:");
        console.log(error);

        listaEl.innerHTML = "Erro ao carregar compromissos.";

        return;
    }

    compromissosCache = data;

    if (data.length === 0) {
        listaEl.innerHTML = "Nenhum compromisso hoje.";
        return;
    }

    listaEl.innerHTML = "";

    data.forEach(compromisso => {

        const item = document.createElement("div");
        item.className = "item-compromisso";

        item.innerHTML = `
            <strong>${compromisso.hora_inicio ?? "sem horário"}</strong>
            - ${compromisso.titulo}
            ${compromisso.categoria ? `<em>(${compromisso.categoria})</em>` : ""}
            <button type="button" class="btn-editar" data-id="${compromisso.id}">Editar</button>
            <button type="button" class="btn-excluir" data-id="${compromisso.id}">Excluir</button>
        `;

        listaEl.appendChild(item);

    });

}

carregarCompromissosHoje();

// Delegação de evento: como os botões de editar/excluir são recriados
// a cada carregamento da lista, o listener fica no elemento pai (lista),
// que sempre existe, em vez de um listener por botão.
listaEl.addEventListener("click", (evento) => {
    const id = evento.target.dataset.id;
    if (!id) return;

    if (evento.target.classList.contains("btn-editar")) {
        const compromisso = compromissosCache.find(c => c.id === id);
        if (compromisso) abrirFormulario(compromisso);
    }

    if (evento.target.classList.contains("btn-excluir")) {
        excluirCompromisso(id);
    }
});

function abrirFormulario(compromisso = null) {
    mensagemErroFormEl.textContent = "";
    formEl.reset();

    if (compromisso) {
        formTituloEl.textContent = "Editar compromisso";
        document.getElementById("compromisso-id").value = compromisso.id;
        document.getElementById("titulo").value = compromisso.titulo ?? "";
        document.getElementById("descricao").value = compromisso.descricao ?? "";
        document.getElementById("data").value = compromisso.data ?? "";
        document.getElementById("hora_inicio").value = compromisso.hora_inicio ?? "";
        document.getElementById("hora_fim").value = compromisso.hora_fim ?? "";
        document.getElementById("categoria").value = compromisso.categoria ?? "";
    } else {
        formTituloEl.textContent = "Novo compromisso";
        document.getElementById("compromisso-id").value = "";
        // Sugere a data de hoje como padrão para um novo compromisso
        document.getElementById("data").value = new Date().toISOString().split("T")[0];
    }

    formularioEl.style.display = "block";
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

formEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    mensagemErroFormEl.textContent = "";

    const id = document.getElementById("compromisso-id").value;

    const dadosCompromisso = {
        titulo: document.getElementById("titulo").value,
        descricao: document.getElementById("descricao").value || null,
        data: document.getElementById("data").value,
        hora_inicio: document.getElementById("hora_inicio").value || null,
        hora_fim: document.getElementById("hora_fim").value || null,
        categoria: document.getElementById("categoria").value || null,
    };

    let resultado;

    if (id) {
        // Edição: atualiza a linha existente.
        // Não é preciso repetir user_id: a política de UPDATE já garante
        // que só a linha do usuário logado pode ser alterada.
        resultado = await supabaseClient
            .from("compromissos")
            .update(dadosCompromisso)
            .eq("id", id);
    } else {
        // Criação: user_id é preenchido automaticamente pelo banco
        // (coluna com "default auth.uid()" configurada no SQL de setup).
        resultado = await supabaseClient
            .from("compromissos")
            .insert(dadosCompromisso);
    }

    if (resultado.error) {
        console.log(resultado.error);
        mensagemErroFormEl.textContent = "Erro ao salvar: " + resultado.error.message;
        return;
    }

    fecharFormulario();
    carregarCompromissosHoje();
});

async function excluirCompromisso(id) {
    const confirmar = confirm("Excluir este compromisso?");
    if (!confirmar) return;

    const { error } = await supabaseClient
        .from("compromissos")
        .delete()
        .eq("id", id);

    if (error) {
        console.log(error);
        alert("Erro ao excluir: " + error.message);
        return;
    }

    carregarCompromissosHoje();
}

document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});
