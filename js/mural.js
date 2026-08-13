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
// Elementos e estado
// ---------------------------------------------------------------
const listaRecadosEl = document.getElementById("lista-recados");
const editorRecadoEl = document.getElementById("editor-recado");
const recadoInfoEl = document.getElementById("recado-info");
const mensagemErroEl = document.getElementById("mensagem-erro-recado");
const btnExcluirEl = document.getElementById("btn-excluir-recado");
const pesquisaEl = document.getElementById("pesquisa-recados");

let recadosCache = [];

// ---------------------------------------------------------------
// Carregar e renderizar
// ---------------------------------------------------------------
async function carregarRecados() {
    const { data, error } = await supabaseClient
        .from("recados_publicos")
        .select("*")
        .order("atualizado_em", { ascending: false });

    if (error) {
        console.log(error);
        listaRecadosEl.innerHTML = "Erro ao carregar recados.";
        return;
    }

    anotacoesCache = data;
    renderizarLista();
}

function renderizarLista() {
    const termo = pesquisaEl.value.toLowerCase();
    const filtradas = termo
        ? anotacoesCache.filter((a) =>
            a.titulo.toLowerCase().includes(termo) ||
            (a.conteudo ?? "").toLowerCase().includes(termo))
        : anotacoesCache;

    if (filtradas.length === 0) {
        listaRecadosEl.innerHTML = '<p class="agenda-vazio">Nenhum recado encontrado.</p>';
        return;
    }

    listaRecadosEl.innerHTML = filtradas.map((a) => {
        const preview = (a.conteudo || "").slice(0, 80).replace(/\n/g, " ");
        const dataFormatada = new Date(a.atualizado_em).toLocaleDateString("pt-BR");
        return `
            <div class="card-recado" data-id="${a.id}">
                <strong>${escapeHtml(a.titulo)}</strong>
                <div class="recado-preview">${escapeHtml(preview)}${(a.conteudo || "").length > 80 ? "…" : ""}</div>
                <div class="recado-data">Editado em ${dataFormatada}</div>
            </div>
        `;
    }).join("");
}

pesquisaEl.addEventListener("input", renderizarLista);

listaRecadosEl.addEventListener("click", (evento) => {
    const card = evento.target.closest(".card-recado");
    if (!card) return;
    const recado = recadosCache.find((a) => a.id === card.dataset.id);
    if (recado) abrirEditor(recado);
});

// ---------------------------------------------------------------
// Abrir / fechar editor
// ---------------------------------------------------------------
function abrirEditor(recado = null) {
    mensagemErroEl.textContent = "";

    if (recado) {
        document.getElementById("recado-id").value = recado.id;
        document.getElementById("recado-titulo").value = recado.titulo;
        document.getElementById("recado-conteudo").value = recado.conteudo || "";
        anotacaoInfoEl.textContent = "Editado em " + new Date(anotacao.atualizado_em).toLocaleString("pt-BR");
        btnExcluirEl.classList.remove("oculto");
    } else {
        document.getElementById("recado-id").value = "";
        document.getElementById("recado-titulo").value = "";
        document.getElementById("recado-conteudo").value = "";
        anotacaoInfoEl.textContent = "";
        btnExcluirEl.classList.add("oculto");
    }

    editorRecadoEl.classList.remove("oculto");
    editorRecadoEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("btn-novo-recado").addEventListener("click", () => abrirEditor());

document.getElementById("btn-fechar-recado").addEventListener("click", () => {
    editorRecadoEl.classList.add("oculto");
});

// ---------------------------------------------------------------
// Salvar / excluir
// ---------------------------------------------------------------
document.getElementById("btn-salvar-recado").addEventListener("click", async () => {
    mensagemErroEl.textContent = "";

    const titulo = document.getElementById("recado-titulo").value.trim();
    if (!titulo) {
        mensagemErroEl.textContent = "Dê um título para o recado.";
        return;
    }

    const id = document.getElementById("recado-id").value;
    const dados = {
        titulo,
        conteudo: document.getElementById("recado-conteudo").value,
        atualizado_em: new Date().toISOString(),
    };

    let resultado;
    if (id) {
        resultado = await supabaseClient.from("recados").update(dados).eq("id", id);
    } else {
        resultado = await supabaseClient.from("recados").insert(dados);
    }

    if (resultado.error) {
        mensagemErroEl.textContent = "Erro ao salvar: " + resultado.error.message;
        return;
    }

    editorAnotacaoEl.classList.add("oculto");
    await carregarRecado();
});

btnExcluirEl.addEventListener("click", async () => {
    const id = document.getElementById("recado-id").value;
    if (!id) return;

    const confirmar = confirm("Excluir este recado?");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("recados").delete().eq("id", id);
    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    editorAnotacaoEl.classList.add("oculto");
    await carregarRecados();
});

carregarRecados();
