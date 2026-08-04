// Preencha com os valores da sua tela Project Settings > API
const SUPABASE_URL = "https://khviaakdorvkehjxdvfh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtodmlhYWtkb3J2a2VoanhkdmZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjU4MTEsImV4cCI6MjEwMTQwMTgxMX0.5JxJ6FujxFomKnYCLW4sh9fhCEJ8lCEjUZblaOwbbxQ";
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 