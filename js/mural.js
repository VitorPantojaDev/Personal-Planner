let usuarioAtualId = null;
const MODERADOR_ID = "13b795b7-7b70-4109-9e67-a370c2480f41";

async function protegerPagina() {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
        window.location.href = "index.html";
        return;
    }
    document.getElementById("email-usuario").textContent =
        "Logado como: " + data.session.user.email;
        usuarioAtualId = data.session.user.id;
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
        .from("recados")
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
            a.corpo.toLowerCase().includes(termo) ||
            (a.corpo ?? "").toLowerCase().includes(termo))
        : recadosCache;

    if (filtradas.length === 0) {
        listaRecadosEl.innerHTML = '<p class="agenda-vazio">Nenhum recado encontrado.</p>';
        return;
    }

    listaRecadosEl.innerHTML = filtradas.map((a) => {
        const preview = (a.corpo || "").slice(0, 80).replace(/\n/g, " ");
        const dataFormatada = new Date(a.atualizado_em).toLocaleDateString("pt-BR");
        const seloModerador = a.user_id === MODERADOR_ID
            ? '<span class="selo-moderador">Moderador</span>'
            : "";
        return `
            <div class="card-recado" data-id="${a.id}">
                <strong>${escapeHtml(a.titulo)}</strong>
                <div class="recado-preview">${escapeHtml(preview)}${(a.corpo || "").length > 80 ? "…" : ""}</div>
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
        document.getElementById("recado-conteudo").value = recado.corpo|| "";
        recadoInfoEl.textContent = "Editado em " + new Date(recado.atualizado_em).toLocaleString("pt-BR");
        const souDono = recado.user_id === usuarioAtualId;
        const souModerador = usuarioAtualId === MODERADOR_ID;

        document.getElementById("recado-titulo").disabled = !souDono;
        document.getElementById("recado-conteudo").disabled = !souDono;
        document.getElementById("btn-salvar-recado").classList.toggle("oculto", !souDono);

        if (souDono || souModerador) {
            btnExcluirEl.classList.remove("oculto");
        } else {
            btnExcluirEl.classList.add("oculto");
        }
        btnExcluirEl.classList.remove("oculto");
    } else {
        document.getElementById("recado-id").value = "";
        document.getElementById("recado-titulo").disabled = false;
        document.getElementById("recado-conteudo").disabled = false;
        document.getElementById("btn-salvar-recado").classList.remove("oculto");
        recadoInfoEl.textContent = "";
        btnExcluirEl.classList.add("oculto");
    }

    editorRecadoEl.classList.remove("oculto");
    editorRecadoEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("btn-novo-recado").addEventListener("click", () => {
    const meuRecado = recadosCache.find((r) => r.user_id === usuarioAtualId);
    if (meuRecado) {
        alert("Você já tem um recado publicado. Editando o seu recado existente.");
        abrirEditor(meuRecado);
    } else {
        abrirEditor();
    }
});

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
        corpo: document.getElementById("recado-conteudo").value,
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
    await carregarRecados();
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
