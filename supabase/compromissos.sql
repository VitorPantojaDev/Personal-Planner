-- Rode no SQL Editor do Supabase (Project > SQL Editor > New query)
-- Seguro executar mesmo se a tabela já existir.

create table if not exists public.compromissos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    titulo text not null,
    descricao text,
    data date not null,
    hora_inicio time,
    hora_fim time,
    recorrencia text default 'nenhuma',
    dia_semana text,
    categoria text,
    contato_id uuid,
    created_at timestamptz default now()
);

-- Ativa Row Level Security (RLS)
alter table public.compromissos enable row level security;

-- Remove políticas antigas com o mesmo nome, se existirem, para poder recriar sem erro
drop policy if exists "select_own_compromissos" on public.compromissos;
drop policy if exists "insert_own_compromissos" on public.compromissos;
drop policy if exists "update_own_compromissos" on public.compromissos;
drop policy if exists "delete_own_compromissos" on public.compromissos;

create policy "select_own_compromissos" on public.compromissos
    for select using (auth.uid() = user_id);

create policy "insert_own_compromissos" on public.compromissos
    for insert with check (auth.uid() = user_id);

create policy "update_own_compromissos" on public.compromissos
    for update using (auth.uid() = user_id);

create policy "delete_own_compromissos" on public.compromissos
    for delete using (auth.uid() = user_id);

-- Observação: user_id tem "default auth.uid()", então o frontend não precisa
-- enviar esse campo manualmente ao inserir um compromisso. O Supabase preenche
-- automaticamente com o id do usuário autenticado que fez a requisição.
