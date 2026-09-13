// Se já existir uma sessão válida, pula direto para a home,
// sem obrigar a logar de novo toda vez que abrir a página.
async function verificarSessaoExistente() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
        window.location.href = "home.html";
    }
}
verificarSessaoExistente();
 
document.getElementById("form-login").addEventListener("submit", async (evento) => {
    evento.preventDefault(); // impede o recarregamento padrão da página
 
    const email = document.getElementById("email").value;
    const senha = document.getElementById("senha").value;
    const mensagemErro = document.getElementById("mensagem-erro");
    mensagemErro.textContent = "";
 
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: senha
    });
 
    if (error) {
        mensagemErro.textContent = "Erro ao entrar: " + error.message;
        return;
    }
 
    window.location.href = "home.html";
});
 
// ---------------------------------------------------------------
// Facilita a instalação do PWA (Android/Chrome)
// ---------------------------------------------------------------
let promptInstalacao = null;

window.addEventListener("beforeinstallprompt", (evento) => {
    evento.preventDefault();
    promptInstalacao = evento;
    document.getElementById("instalar-app-aviso").classList.remove("oculto");
});

document.getElementById("btn-instalar-app").addEventListener("click", async () => {
    if (!promptInstalacao) return;
    promptInstalacao.prompt();
    await promptInstalacao.userChoice;
    promptInstalacao = null;
    document.getElementById("instalar-app-aviso").classList.add("oculto");
});

window.addEventListener("appinstalled", () => {
    document.getElementById("instalar-app-aviso").classList.add("oculto");
});

// iPhone/iPad não disparam o evento acima, então mostramos instrução em texto
const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const jaInstalado = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
if (ehIOS && !jaInstalado) {
    document.getElementById("instalar-app-ios").classList.remove("oculto");
}