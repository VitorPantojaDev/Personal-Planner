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
const listaContatosEl = document.getElementById("lista-contatos");

const formularioContatoEl = document.getElementById("formulario-contato");
const formContatoEl = document.getElementById("form-contato");
const formContatoTituloEl = document.getElementById("form-contato-titulo");
const mensagemErroContatoEl = document.getElementById("mensagem-erro-contato");

const formularioPetEl = document.getElementById("formulario-pet");
const formPetEl = document.getElementById("form-pet");
const mensagemErroPetEl = document.getElementById("mensagem-erro-pet");

let contatosCache = [];
let petsCache = []; // todos os pets do usuário, agrupados por contato_id na renderização

const pesquisaContatosEl = document.getElementById("pesquisa-contatos");
pesquisaContatosEl.addEventListener("input", renderizarContatos);

function obterContatosParaExibir() {
    const termo = pesquisaContatosEl.value.toLowerCase();
    if (!termo) return contatosCache;

    return contatosCache.filter((contato) => {
        const nomeBate = contato.nome.toLowerCase().includes(termo);
        const petBate = petsCache.some((pet) =>
            pet.contato_id === contato.id &&
            (pet.nome.toLowerCase().includes(termo) || (pet.especie ?? "").toLowerCase().includes(termo))
        );
        return nomeBate || petBate;
    });
}

// ---------------------------------------------------------------
// Carregar contatos + pets
// ---------------------------------------------------------------
async function carregarContatos() {
    listaContatosEl.innerHTML = "Carregando...";

    const { data: contatos, error: erroContatos } = await supabaseClient
        .from("contatos")
        .select("*")
        .order("nome", { ascending: true });

    if (erroContatos) {
        console.log(erroContatos);
        listaContatosEl.innerHTML = "Erro ao carregar contatos.";
        return;
    }

    const { data: pets, error: erroPets } = await supabaseClient
        .from("pets")
        .select("*")
        .order("nome", { ascending: true });

    if (erroPets) {
        console.log(erroPets);
        listaContatosEl.innerHTML = "Erro ao carregar pets.";
        return;
    }

    contatosCache = contatos;
    petsCache = pets;
    renderizarContatos();
}

function renderizarContatos() {
    const contatosParaExibir = obterContatosParaExibir();

    if (contatosParaExibir.length === 0) {
        listaContatosEl.innerHTML = '<p class="agenda-vazio">Nenhum contato encontrado.</p>';
        return;
    }

    listaContatosEl.innerHTML = "";

    contatosParaExibir.forEach((contato) => {
        const petsDoContato = petsCache.filter((p) => p.contato_id === contato.id);

        const card = document.createElement("div");
        card.className = "card-contato";

        const telefoneHtml = contato.telefone ? `<div>Tel: ${escapeHtml(contato.telefone)}</div>` : "";
        const enderecoHtml = contato.endereco ? `<div>${escapeHtml(contato.endereco)}</div>` : "";
        const observacoesHtml = contato.observacoes ? `<div class="contato-observacoes">${escapeHtml(contato.observacoes)}</div>` : "";
        const categoriaHtml = contato.categoria ? `<span class="contato-categoria">${escapeHtml(contato.categoria)}</span>` : "";

        const petsHtml = petsDoContato.length > 0
            ? '<ul class="lista-pets">' + petsDoContato.map((pet) => `
                <li>
                    <strong>${escapeHtml(pet.nome)}</strong>${pet.especie ? " (" + escapeHtml(pet.especie) + ")" : ""}
                    ${pet.observacoes ? `<div class="pet-observacoes">${escapeHtml(pet.observacoes)}</div>` : ""}
                    <button type="button" class="btn-excluir-pet" data-id="${pet.id}">Excluir pet</button>
                </li>
            `).join("") + "</ul>"
            : '<p class="sem-pets">Nenhum pet cadastrado.</p>';

        card.innerHTML = `
            <div class="card-contato-cabecalho" data-id="${contato.id}">
                <strong>${escapeHtml(contato.nome)}</strong>
                ${categoriaHtml}
            </div>

            <div class="card-contato-detalhes oculto">
                ${telefoneHtml}
                ${enderecoHtml}
                ${observacoesHtml}

                <div class="card-contato-pets">
                    <p><strong>Pets</strong></p>
                    ${petsHtml}
                    <button type="button" class="btn-novo-pet" data-id="${contato.id}">Adicionar pet</button>
                </div>

                <div class="card-contato-acoes">
                    <button type="button" class="btn-editar-contato" data-id="${contato.id}">Editar</button>
                    <button type="button" class="btn-excluir-contato" data-id="${contato.id}">Excluir</button>
                </div>
            </div>
        `;

        listaContatosEl.appendChild(card);
    });
}

listaContatosEl.addEventListener("click", (evento) => {
    const cabecalhoClicado = evento.target.closest(".card-contato-cabecalho");
    if (cabecalhoClicado) {
        cabecalhoClicado.nextElementSibling.classList.toggle("oculto");
        return;
    }
    const idNovoPet = evento.target.closest(".btn-novo-pet")?.dataset.id;
    if (idNovoPet) {
        abrirFormularioPet(idNovoPet);
        return;
    }

    const idExcluirPet = evento.target.closest(".btn-excluir-pet")?.dataset.id;
    if (idExcluirPet) {
        excluirPet(idExcluirPet);
        return;
    }

    const idEditar = evento.target.closest(".btn-editar-contato")?.dataset.id;
    if (idEditar) {
        const contato = contatosCache.find((c) => c.id === idEditar);
        if (contato) abrirFormularioContato(contato);
        return;
    }

    const idExcluir = evento.target.closest(".btn-excluir-contato")?.dataset.id;
    if (idExcluir) {
        excluirContato(idExcluir);
        return;
    }
});

// ---------------------------------------------------------------
// Criar / Editar contato
// ---------------------------------------------------------------
document.getElementById("btn-novo-contato").addEventListener("click", () => {
    abrirFormularioContato();
});

document.getElementById("btn-cancelar-contato").addEventListener("click", fecharFormularioContato);

function abrirFormularioContato(contato = null) {
    mensagemErroContatoEl.textContent = "";
    formContatoEl.reset();

    if (contato) {
        formContatoTituloEl.textContent = "Editar contato";
        document.getElementById("contato-id").value = contato.id;
        document.getElementById("contato-nome").value = contato.nome;
        document.getElementById("contato-telefone").value = contato.telefone || "";
        document.getElementById("contato-endereco").value = contato.endereco || "";
        document.getElementById("contato-categoria").value = contato.categoria || "";
        document.getElementById("contato-observacoes").value = contato.observacoes || "";
    } else {
        formContatoTituloEl.textContent = "Novo contato";
        document.getElementById("contato-id").value = "";
    }

    formularioContatoEl.style.display = "block";
    formularioContatoEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

function fecharFormularioContato() {
    formularioContatoEl.style.display = "none";
    formContatoEl.reset();
    mensagemErroContatoEl.textContent = "";
}

formContatoEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemErroContatoEl.textContent = "";

    const id = document.getElementById("contato-id").value;

    const dadosContato = {
        nome: document.getElementById("contato-nome").value,
        telefone: document.getElementById("contato-telefone").value || null,
        endereco: document.getElementById("contato-endereco").value || null,
        categoria: document.getElementById("contato-categoria").value || null,
        observacoes: document.getElementById("contato-observacoes").value || null
    };

    let resultado;
    if (id) {
        resultado = await supabaseClient.from("contatos").update(dadosContato).eq("id", id);
    } else {
        resultado = await supabaseClient.from("contatos").insert(dadosContato);
    }

    if (resultado.error) {
        mensagemErroContatoEl.textContent = "Erro ao salvar: " + resultado.error.message;
        return;
    }

    fecharFormularioContato();
    carregarContatos();
});

async function excluirContato(id) {
    const confirmar = confirm("Excluir este contato? Os pets vinculados também serão apagados. Compromissos vinculados ficam sem contato, mas não são apagados.");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("contatos").delete().eq("id", id);

    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    carregarContatos();
}

// ---------------------------------------------------------------
// Pets
// ---------------------------------------------------------------
function abrirFormularioPet(contatoId) {
    mensagemErroPetEl.textContent = "";
    formPetEl.reset();
    document.getElementById("pet-contato-id").value = contatoId;

    formularioPetEl.style.display = "block";
    formularioPetEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.getElementById("btn-cancelar-pet").addEventListener("click", () => {
    formularioPetEl.style.display = "none";
    formPetEl.reset();
    mensagemErroPetEl.textContent = "";
});

formPetEl.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mensagemErroPetEl.textContent = "";

    const dadosPet = {
        contato_id: document.getElementById("pet-contato-id").value,
        nome: document.getElementById("pet-nome").value,
        especie: document.getElementById("pet-especie").value || null,
        observacoes: document.getElementById("pet-observacoes").value || null
    };

    const { error } = await supabaseClient.from("pets").insert(dadosPet);

    if (error) {
        mensagemErroPetEl.textContent = "Erro ao salvar: " + error.message;
        return;
    }

    formularioPetEl.style.display = "none";
    formPetEl.reset();
    carregarContatos();
});

async function excluirPet(id) {
    const confirmar = confirm("Excluir este pet?");
    if (!confirmar) return;

    const { error } = await supabaseClient.from("pets").delete().eq("id", id);

    if (error) {
        alert("Erro ao excluir: " + error.message);
        return;
    }

    carregarContatos();
}

// ---------------------------------------------------------------
document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});

carregarContatos();
