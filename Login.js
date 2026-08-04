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
 