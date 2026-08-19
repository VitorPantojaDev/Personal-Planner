const SUPABASE_URL = "https://khviaakdorvkehjxdvfh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmlhYWtkb3J2a2VoanhkdmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU4MTEsImV4cCI6MjEwMTQwMTgxMX0.5JxJ6FujxFomKnYCLW4sh9fhCEJ8lCEjUZblaOwbbxQ";
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
 
supabaseClient.auth.onAuthStateChange((event) => {
    const paginaAtual = window.location.pathname.split("/").pop();
    if (event === "SIGNED_OUT" && paginaAtual !== "index.html" && paginaAtual !== "") {
        window.location.href = "index.html";
    }
});

function baixarArquivo(nomeArquivo, conteudo, tipoMime) {
    const blob = new Blob([conteudo], { type: tipoMime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function paraCampoCSV(valor) {
    const texto = String(valor ?? "");
    if (/[",\n]/.test(texto)) {
        return '"' + texto.replaceAll('"', '""') + '"';
    }
    return texto;
}

function paraCSV(linhas) {
    return linhas.map((linha) => linha.map(paraCampoCSV).join(",")).join("\n");
}
