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
 
document.getElementById("btn-sair").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
});
 