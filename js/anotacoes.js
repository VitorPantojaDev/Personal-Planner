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
const listaAnotacoesEl = document.getElementById("lista-anotacoes");
const editorAnotacaoEl = document.getElementById("editor-anotacao");
const anotacaoInfoEl = document.getElementById("anotacao-info");
const mensagemErroEl = document.getElementById("mensagem-erro-anotacao");
const btnExcluirEl = document.getElementById("btn-excluir-anotacao");
const pesquisaEl = document.getElementById("pesquisa-anotacoes");

let anotacoesCache = [];

// ---------------------------------------------------------------
// Carregar e renderizar
// ---------------------------------------------------------------
async function carregarAnotacoes() {
    const { data, error } = await supabaseClient
        .from("anotacoes")
        .select("*")
        .order("atualizado_em", { ascending: false });

    if (error) {
        console.log(error);
        listaAnotacoesEl.innerHTML = "Erro ao carregar anotações.";
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
        listaAnotacoesEl.innerHTML = '<p class="agenda-vazio">Nenhuma anotação encontrada.</p>';
        return;
    }

    listaAnotacoesEl.innerHTML = filtradas.map((a) => {
        const preview = (a.conteudo || "").slice(0, 80).replace(/\n/g, " ");
        const dataFormatada = new Date(a.atualizado_em).toLocaleDateString("pt-BR");
        return `
            <div class="card-anotacao" data-id="${a.id}">
                <strong>${escapeHtml(a.titulo)}</strong>
                <div class="anotacao-preview">${escapeHtml(preview)}${(a.conteudo || "").length > 80 ? "…" : ""}</div>
                <div class="anotacao-data">Editado em ${dataFormatada}</div>
            </div>
        `;
    }).join("");
}

pesquisaEl.addEventListener("input", renderizarLista);

listaAnotacoesEl.addEventListener("click", (evento) => {
    const card = evento.target.closest(".card-anotacao");
    if (!card) return;
    const anotacao = anotacoesCache.find((a) => a.id === card.dataset.id);
    if (anotacao) abrirEditor(anotacao);
});

// ---------------------------------------------------------------
// Abrir / fechar editor
// ---------------------------------------------------------------
function abrirEditor(anotacao = null) {
    mensagemErroEl.textContent = "";

    if (anotacao) {
        document.getElementById("anotacao-id").value = anotacao.id;
        document.getElementById("anotacao-titulo").value = anotacao.titulo;
        document.getElementById("anotacao-conteudo").value = anotacao.conteudo || "";
        anotacaoInfoEl.textContent = "Editado em " + new Date(anotacao.atualizado_em).toLocaleString("pt-BR");
        btnExcluirEl.classList.remove("oculto");
    } else {
        document.getElementById("anotacao-id").value = "";
        document.getElementById("anotacao-titulo").value = "";
        document.getElementById("anotacao-conteudo").value = "";
        anotacaoInfoEl.textContent = "";
        btnExcluirEl.classList.add("oculto");
    }

    editorAnotacaoEl.classList.remove("oculto");
    editorAnotacaoEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("btn-nova-anotacao").addEventListener("click", () => abrirEditor());

document.getElementById("btn-fechar-anotacao").addEventListener("click", () => {
    editorAnotacaoEl.classList.add("oculto");
});

// ---------------------------------------------------------------
// Salvar / excluir
// ---------------------------------------------------------------
document.getElementById("btn-salvar-anotacao").addEventListener("click", async () => {
    mensagemErroEl.textContent = "";

    const titulo = document.getElementById("anotacao-titulo").value.trim();
    if (!titulo) {
        mensagemErroEl.textContent = "Dê um título para a anotação.";
        return;
    }

    const id = document.getElementById("anotacao-id").value;
    const dados = {
        titulo,
        conteudo: document.getElementById("anotacao-conteudo").value,
        atualizado_em: new Date().toISOString(),
    };

    let resultado;
    if (id) {
        resultado = await supabaseClient.from("anotacoes").update(dados).eq("id", id);
    } else {
        resultado = await supabaseClient.from("anotacoes").insert(dados);
    }

    if (resultado.error) {
        mensagemErroEl.textContent = "Erro ao salvar: " + resultado.error.message;
        return;
    }

    editorAnotacaoEl.classList.add("oculto");
    await carregarAnotacoes();
});

btnExcluirEl.addEventListener("click", async () => {
    const id = document.getElementById("anotacao-id").value;
    if (!id) return;

    const confirmar = confirm("Excluir esta anotação?");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("anotacoes").delete().eq("id", id);
    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    editorAnotacaoEl.classList.add("oculto");
    await carregarAnotacoes();
});

// ---------------------------------------------------------------
// Exportar todas as anotações em um único arquivo de texto
// ---------------------------------------------------------------
document.getElementById("btn-baixar-anotacoes").addEventListener("click", () => {
    let texto = "";
    anotacoesCache.forEach((a) => {
        texto += `# ${a.titulo}\n${a.conteudo || ""}\n\n---\n\n`;
    });

    baixarArquivo("anotacoes.txt", texto || "Nenhuma anotação.", "text/plain");
});

// ---------------------------------------------------------------
document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

carregarAnotacoes();
