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

    recadosCache = data;
    renderizarLista();
}

function renderizarLista() {
    const termo = pesquisaEl.value.toLowerCase();
    const filtradas = termo
        ? recadosCache.filter((a) =>
            r.corpo.toLowerCase().includes(termo) ||
            (r.corpo ?? "").toLowerCase().includes(termo))
        : recadosCache;

    if (filtradas.length === 0) {
        listaRecadosEl.innerHTML = '<p class="agenda-vazio">Nenhum recado encontrado.</p>';
        return;
    }

    listaRecadosEl.innerHTML = filtradas.map((a) => {
        const preview = (r.corpo || "").slice(0, 80).replace(/\n/g, " ");
        const dataFormatada = new Date(r.atualizado_em).toLocaleDateString("pt-BR");
        return `
            <div class="card-recado" data-id="${r.id}">
                <strong>${escapeHtml(r.titulo)}</strong>
                <div class="recado-preview">${escapeHtml(preview)}${(r.corpo || "").length > 80 ? "…" : ""}</div>
                <div class="recado-data">Editado em ${dataFormatada}</div>
            </div>
        `;
    }).join("");
}

pesquisaEl.addEventListener("input", renderizarLista);

listaRecadosEl.addEventListener("click", (evento) => {
    const card = evento.target.closest(".card-recado");
    if (!card) return;
    const recado = recadosCache.find((a) => r.id === card.dataset.id);
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
        document.getElementById("recado-corpo").value = recado.corpo|| "";
        recadoInfoEl.textContent = "Editado em " + new Date(recado.atualizado_em).toLocaleString("pt-BR");
        btnExcluirEl.classList.remove("oculto");
    } else {
        document.getElementById("recado-id").value = "";
        document.getElementById("recado-titulo").value = "";
        document.getElementById("recado-corpo").value = "";
        recadoInfoEl.textContent = "";
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
        corpo: document.getElementById("recado-corpo").value,
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

    editorRecadoEl.classList.add("oculto");
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

    editorRecadoEl.classList.add("oculto");
    await carregarRecados();
});

carregarRecados();
