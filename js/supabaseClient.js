// Preencha com os valores da sua tela Project Settings > API
const SUPABASE_URL = "https://khviaakdorvkehjxdvfh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmlhYWtkb3J2a2VoanhkdmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU4MTEsImV4cCI6MjEwMTQwMTgxMX0.5JxJ6FujxFomKnYCLW4sh9fhCEJ8lCEjUZblaOwbbxQ";
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Escapa caracteres HTML perigosos antes de inserir texto do usuário
// via innerHTML (títulos, nomes, observações, etc.), evitando que um
// texto contendo tags/scripts seja interpretado como HTML.
function escapeHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
 
// Se a sessão expirar ou for encerrada (ex.: token vencido) enquanto o
// usuário está numa página protegida, redireciona para o login em vez
// de deixar a tela travada com erros de permissão confusos.
supabaseClient.auth.onAuthStateChange((event) => {
    const paginaAtual = window.location.pathname.split("/").pop();
    if (event === "SIGNED_OUT" && paginaAtual !== "index.html" && paginaAtual !== "") {
        window.location.href = "index.html";
    }
});
