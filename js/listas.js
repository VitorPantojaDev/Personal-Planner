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
const selectQuadroEl = document.getElementById("select-quadro");
const quadroAtualEl = document.getElementById("quadro-atual");
const semListasEl = document.getElementById("sem-listas");
const formularioQuadroEl = document.getElementById("formulario-quadro");
const formQuadroEl = document.getElementById("form-quadro");

let quadrosCache = [];
let quadroSelecionadoId = null;
let itensCache = [];

// ---------------------------------------------------------------
// Carregar quadros (listas)
// ---------------------------------------------------------------
async function carregarQuadros() {
    const { data, error } = await supabaseClient
        .from("listas")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.log(error);
        return;
    }

    quadrosCache = data;

    if (data.length === 0) {
        selectQuadroEl.innerHTML = "";
        quadroAtualEl.classList.add("oculto");
        semListasEl.classList.remove("oculto");
        return;
    }

    semListasEl.classList.add("oculto");
    const opcaoPlaceholder = '<option value="">Selecione uma lista...</option>';
    selectQuadroEl.innerHTML = opcaoPlaceholder + data.map((q) =>
        `<option value="${q.id}">${escapeHtml(q.nome)}</option>`
    ).join("");

    // Se a lista que estava selecionada foi excluída ou nenhuma foi escolhida
    // ainda, não abre nenhuma automaticamente — fica só o seletor visível.
    if (!quadroSelecionadoId || !data.find((q) => q.id === quadroSelecionadoId)) {
        quadroSelecionadoId = null;
        quadroAtualEl.classList.add("oculto");
        selectQuadroEl.value = "";
        return;
    }
    
    selectQuadroEl.value = quadroSelecionadoId;
    await carregarItens();
}

selectQuadroEl.addEventListener("change", async () => {
    quadroSelecionadoId = selectQuadroEl.value || null;

    if (!quadroSelecionadoId) {
        quadroAtualEl.classList.add("oculto");
        return;
    }
    
    await carregarItens();
});

// ---------------------------------------------------------------
// Criar / excluir quadro
// ---------------------------------------------------------------
document.getElementById("btn-novo-quadro").addEventListener("click", () => {
    formQuadroEl.reset();
    formularioQuadroEl.classList.remove("oculto");
});

document.getElementById("btn-cancelar-quadro").addEventListener("click", () => {
    formularioQuadroEl.classList.add("oculto");
});

formQuadroEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const { data, error } = await supabaseClient
        .from("listas")
        .insert({
            nome: document.getElementById("quadro-nome").value,
            coluna_esquerda_nome: document.getElementById("quadro-coluna-esquerda").value,
            coluna_direita_nome: document.getElementById("quadro-coluna-direita").value,
        })
        .select()
        .single();

    if (error) {
        alert("Erro ao criar lista: " + error.message);
        return;
    }

    formularioQuadroEl.classList.add("oculto");
    quadroSelecionadoId = data.id;
    await carregarQuadros();
});

document.getElementById("btn-excluir-quadro").addEventListener("click", async () => {
    if (!quadroSelecionadoId) return;
    const confirmar = confirm("Excluir esta lista e todos os itens dela?");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("listas").delete().eq("id", quadroSelecionadoId);
    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    quadroSelecionadoId = null;
    await carregarQuadros();
});

// ---------------------------------------------------------------
// Carregar e renderizar itens do quadro selecionado
// ---------------------------------------------------------------
async function carregarItens() {
    if (!quadroSelecionadoId) return;

    const quadro = quadrosCache.find((q) => q.id === quadroSelecionadoId);
    if (!quadro) return;

    quadroAtualEl.classList.remove("oculto");
    document.getElementById("titulo-coluna-esquerda").textContent = quadro.coluna_esquerda_nome;
    document.getElementById("titulo-coluna-direita").textContent = quadro.coluna_direita_nome;

    const { data, error } = await supabaseClient
        .from("lista_itens")
        .select("*")
        .eq("lista_id", quadroSelecionadoId)
        .order("ordem", { ascending: true });

    if (error) {
        console.log(error);
        return;
    }

    itensCache = data;
    renderizarColuna("esquerda");
    renderizarColuna("direita");
}

function renderizarColuna(coluna) {
    const ul = document.getElementById(`itens-${coluna}`);
    const itensDaColuna = itensCache.filter((i) => i.coluna === coluna);

    if (itensDaColuna.length === 0) {
        ul.innerHTML = '<li class="item-vazio">Nenhum item.</li>';
        return;
    }

    ul.innerHTML = itensDaColuna.map((item, index) => `
        <li data-id="${item.id}">
            <span class="item-texto">${escapeHtml(item.texto)}</span>
            <span class="item-acoes">
                <button type="button" class="btn-mover-cima" ${index === 0 ? "disabled" : ""} title="Mover para cima">▲</button>
                <button type="button" class="btn-mover-baixo" ${index === itensDaColuna.length - 1 ? "disabled" : ""} title="Mover para baixo">▼</button>
                <button type="button" class="btn-transferir" title="Mover para a outra coluna">${coluna === "esquerda" ? "→" : "←"}</button>
                <button type="button" class="btn-excluir-item" title="Excluir">×</button>
            </span>
        </li>
    `).join("");
}

// ---------------------------------------------------------------
// Adicionar item
// ---------------------------------------------------------------
document.querySelectorAll(".form-add-item").forEach((form) => {
    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        const input = form.querySelector("input");
        const texto = input.value.trim();
        if (!texto) return;

        const coluna = form.dataset.coluna;
        const itensDaColuna = itensCache.filter((i) => i.coluna === coluna);
        const proximaOrdem = itensDaColuna.length > 0
            ? Math.max(...itensDaColuna.map((i) => i.ordem)) + 1
            : 0;

        const { error } = await supabaseClient.from("lista_itens").insert({
            lista_id: quadroSelecionadoId,
            texto,
            coluna,
            ordem: proximaOrdem,
        });

        if (error) {
            alert("Erro ao adicionar item: " + error.message);
            return;
        }

        input.value = "";
        await carregarItens();
    });
});

// ---------------------------------------------------------------
// Ações nos itens: mover cima/baixo, transferir, excluir
// ---------------------------------------------------------------
quadroAtualEl.addEventListener("click", async (evento) => {
    const li = evento.target.closest("li[data-id]");
    if (!li) return;
    const itemId = li.dataset.id;
    const item = itensCache.find((i) => i.id === itemId);
    if (!item) return;

    if (evento.target.closest(".btn-mover-cima")) {
        await moverItem(item, -1);
    } else if (evento.target.closest(".btn-mover-baixo")) {
        await moverItem(item, 1);
    } else if (evento.target.closest(".btn-transferir")) {
        await transferirItem(item);
    } else if (evento.target.closest(".btn-excluir-item")) {
        await excluirItem(item);
    }
});

async function moverItem(item, direcao) {
    const itensDaColuna = itensCache
        .filter((i) => i.coluna === item.coluna)
        .sort((a, b) => a.ordem - b.ordem);

    const indexAtual = itensDaColuna.findIndex((i) => i.id === item.id);
    const indexVizinho = indexAtual + direcao;
    if (indexVizinho < 0 || indexVizinho >= itensDaColuna.length) return;

    const vizinho = itensDaColuna[indexVizinho];

    // Troca as ordens dos dois itens.
    await supabaseClient.from("lista_itens").update({ ordem: vizinho.ordem }).eq("id", item.id);
    await supabaseClient.from("lista_itens").update({ ordem: item.ordem }).eq("id", vizinho.id);

    await carregarItens();
}

async function transferirItem(item) {
    const colunaDestino = item.coluna === "esquerda" ? "direita" : "esquerda";
    const itensDestino = itensCache.filter((i) => i.coluna === colunaDestino);
    const novaOrdem = itensDestino.length > 0
        ? Math.max(...itensDestino.map((i) => i.ordem)) + 1
        : 0;

    const { error } = await supabaseClient
        .from("lista_itens")
        .update({ coluna: colunaDestino, ordem: novaOrdem })
        .eq("id", item.id);

    if (error) {
        alert("Erro ao mover item: " + error.message);
        return;
    }

    await carregarItens();
}

async function excluirItem(item) {
    const { error } = await supabaseClient.from("lista_itens").delete().eq("id", item.id);
    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }
    await carregarItens();
}

// ---------------------------------------------------------------
document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

carregarQuadros();
