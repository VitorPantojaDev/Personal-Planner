-- =====================================================================
-- Personal Planner — Schema completo do banco (Supabase / Postgres)
-- =====================================================================
-- Este arquivo consolida todas as tabelas do projeto num único lugar.
-- Rode do início ao fim, uma vez, num projeto Supabase novo, para
-- recriar o banco inteiro do zero.
--
-- Pré-requisito: o projeto Supabase deve ter sido criado com a opção
-- "Enable automatic RLS" marcada (ou rode os "alter table ... enable
-- row level security" manualmente — já estão incluídos abaixo por
-- segurança, rodar de novo não tem efeito colateral).
-- =====================================================================


-- ---------------------------------------------------------------
-- COMPROMISSOS
-- ---------------------------------------------------------------
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
    serie_id uuid,
    created_at timestamptz default now()
);
alter table public.compromissos alter column user_id set default auth.uid();
alter table public.compromissos add column if not exists serie_id uuid;


-- ---------------------------------------------------------------
-- CONTATOS + PETS
-- ---------------------------------------------------------------
create table if not exists public.contatos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    nome text not null,
    telefone text,
    endereco text,
    categoria text,
    observacoes text,
    created_at timestamptz default now()
);
alter table public.contatos alter column user_id set default auth.uid();

create table if not exists public.pets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    contato_id uuid not null references public.contatos(id) on delete cascade,
    nome text not null,
    especie text,
    observacoes text,
    created_at timestamptz default now()
);
alter table public.pets alter column user_id set default auth.uid();

-- Conecta compromissos.contato_id a contatos.id formalmente
alter table public.compromissos drop constraint if exists compromissos_contato_id_fkey;
alter table public.compromissos
    add constraint compromissos_contato_id_fkey
    foreign key (contato_id) references public.contatos(id) on delete set null;


-- ---------------------------------------------------------------
-- ESTUDOS: CURSOS + SESSÕES
-- ---------------------------------------------------------------
create table if not exists public.cursos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    nome text not null,
    carga_horaria_total numeric not null,
    horas_estudadas numeric not null default 0,
    data_limite date,
    ativo boolean not null default true,
    link text,
    observacoes text,
    created_at timestamptz default now()
);
alter table public.cursos alter column user_id set default auth.uid();
alter table public.cursos add column if not exists link text;
alter table public.cursos add column if not exists observacoes text;

create table if not exists public.sessoes_estudo (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    curso_id uuid not null references public.cursos(id) on delete cascade,
    data date not null,
    horas numeric not null,
    observacao text,
    created_at timestamptz default now()
);
alter table public.sessoes_estudo alter column user_id set default auth.uid();


-- ---------------------------------------------------------------
-- TAREFAS DA SEMANA (checklist recorrente, sem data fixa)
-- ---------------------------------------------------------------
create table if not exists public.tarefas_semana (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    titulo text not null,
    feita boolean not null default false,
    ultima_revisao date not null default current_date,
    created_at timestamptz default now()
);
alter table public.tarefas_semana alter column user_id set default auth.uid();


-- =====================================================================
-- PERMISSÕES DE ACESSO (GRANT) — necessário para a API do Supabase
-- liberar leitura/escrita para usuários autenticados.
-- =====================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.compromissos    to authenticated;
grant select, insert, update, delete on public.contatos        to authenticated;
grant select, insert, update, delete on public.pets            to authenticated;
grant select, insert, update, delete on public.cursos          to authenticated;
grant select, insert, update, delete on public.sessoes_estudo  to authenticated;
grant select, insert, update, delete on public.tarefas_semana  to authenticated;


-- =====================================================================
-- ROW LEVEL SECURITY (RLS) — cada usuário só acessa suas próprias linhas
-- =====================================================================
alter table public.compromissos    enable row level security;
alter table public.contatos        enable row level security;
alter table public.pets            enable row level security;
alter table public.cursos          enable row level security;
alter table public.sessoes_estudo  enable row level security;
alter table public.tarefas_semana  enable row level security;

-- Todas as tabelas seguem o mesmo padrão: uma linha só é visível/editável
-- se user_id da linha for igual ao usuário autenticado na requisição.

do $$
declare
    tabela text;
begin
    foreach tabela in array array['compromissos', 'contatos', 'pets', 'cursos', 'sessoes_estudo', 'tarefas_semana']
    loop
        execute format('drop policy if exists "select_own_%1$s" on public.%1$s', tabela);
        execute format('drop policy if exists "insert_own_%1$s" on public.%1$s', tabela);
        execute format('drop policy if exists "update_own_%1$s" on public.%1$s', tabela);
        execute format('drop policy if exists "delete_own_%1$s" on public.%1$s', tabela);

        execute format('create policy "select_own_%1$s" on public.%1$s for select using (auth.uid() = user_id)', tabela);
        execute format('create policy "insert_own_%1$s" on public.%1$s for insert with check (auth.uid() = user_id)', tabela);
        execute format('create policy "update_own_%1$s" on public.%1$s for update using (auth.uid() = user_id)', tabela);
        execute format('create policy "delete_own_%1$s" on public.%1$s for delete using (auth.uid() = user_id)', tabela);
    end loop;
end $$;


-- =====================================================================
-- CONFERÊNCIA FINAL — rode e confira se todas as colunas user_id
-- mostram "auth.uid()" em column_default
-- =====================================================================
select table_name, column_name, column_default, is_nullable
from information_schema.columns
where table_name in ('compromissos', 'contatos', 'pets', 'cursos', 'sessoes_estudo', 'tarefas_semana')
and column_name = 'user_id'
order by table_name;
