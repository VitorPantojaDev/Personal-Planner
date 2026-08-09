# Personal Planner

Agenda pessoal + rotina de estudos + contatos, para uso diário no celular e no PC. Sem backend próprio: o frontend (HTML/CSS/JS puro) fala direto com o [Supabase](https://supabase.com) (banco de dados + autenticação + API), hospedado como site estático na [Vercel](https://vercel.com).

## Funcionalidades

- **Agenda**: visões de dia, semana e mês. Compromissos podem repetir (diária ou semanalmente, em dias específicos) e ser vinculados a um contato. Busca por título.
- **Tarefas da Semana**: checklist recorrente, sem data fixa — toda segunda-feira, tarefas não revisadas disparam um aviso para renovar ou excluir.
- **Estudos**: cursos/disciplinas com carga horária, data limite e cálculo automático de horas/dia necessárias para cumprir a meta. Registro de sessões de estudo. Busca por nome.
- **Contatos**: nome, telefone, endereço, categoria, observações, com pets vinculados. Busca por contato ou pet.

## Arquitetura

```
Navegador (celular / PC)
        │
        │  supabase-js (autenticado)
        ▼
   Supabase (Postgres + Auth + API automática)
```

Não existe servidor backend próprio — o Supabase substitui essa camada. Isso significa:

- **Hospedagem**: qualquer serviço de arquivos estáticos serve (Vercel, Netlify, GitHub Pages). Sem build, sem servidor rodando.
- **Segurança**: a chave pública do Supabase (`anon key`) fica exposta no código do frontend — isso é esperado e seguro nesse modelo. Quem protege os dados são as políticas de **Row Level Security (RLS)** no banco: cada linha só é visível/editável pelo `user_id` dono dela. A chave pública sozinha não dá acesso a nada.

## Estrutura de arquivos

```
index.html            → tela de login
home.html              → agenda (dia/semana/mês) + tarefas da semana
estudos.html           → cursos e sessões de estudo
contatos.html          → contatos e pets
style.css               → estilos de todas as páginas
js/
  supabaseClient.js     → inicializa a conexão com o Supabase (URL + chave)
  login.js               → autenticação
  home.js                 → lógica da agenda e das tarefas da semana
  estudos.js              → lógica de cursos/sessões
  contatos.js             → lógica de contatos/pets
supabase/
  schema.sql              → schema completo do banco (rodar uma vez, no início)
```

## Como replicar o projeto do zero

### 1. Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) (dá pra entrar com GitHub).
2. **New Project** → escolha um nome, gere uma senha de banco (guarde num gerenciador de senhas) e a região mais próxima (`South America (São Paulo)`, se disponível).
3. Nas opções de segurança da criação do projeto, mantenha:
   - **Enable Data API**: marcado (obrigatório).
   - **Automatically expose new tables**: desmarcado.
   - **Enable automatic RLS**: marcado.

### 2. Criar o schema do banco

1. No painel do projeto, abra **SQL Editor** → **New query**.
2. Copie todo o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) deste repositório, cole e clique em **Run**.
3. Um aviso de "operação destrutiva" pode aparecer (por causa dos `drop policy if exists`) — é esperado e seguro, pode confirmar.
4. A última consulta do script mostra uma tabela de conferência: todas as linhas devem ter `auth.uid()` na coluna `column_default`. Se algo aparecer como `NULL`, rode o script de novo.

### 3. Criar seu usuário

Em **Authentication** → **Users** → **Add user**, informe e-mail e senha. Esse é o login que você vai usar no app (é um app de uso pessoal, não precisa de cadastro público).

### 4. Pegar as credenciais do projeto

Em **Project Settings** → **API**:
- Copie **Project URL**.
- Copie a chave **anon public** (em "Project API keys").

### 5. Configurar o frontend

Clone este repositório e edite `js/supabaseClient.js`:

```js
const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "sua-chave-anon-aqui";
```

### 6. Testar localmente

Abra `index.html` com a extensão **Live Server** do VS Code (evite abrir o arquivo direto com duplo clique — alguns navegadores bloqueiam requisições em páginas abertas via `file://`). Faça login com o usuário criado no passo 3.

### 7. Publicar (deploy)

1. Suba o repositório para o GitHub.
2. Crie conta em [vercel.com](https://vercel.com), entre com GitHub.
3. **Add New** → **Project** → selecione o repositório.
4. Framework Preset: **Other** (é HTML/CSS/JS puro, sem build).
5. Deploy. A cada `git push` no branch principal, a Vercel publica automaticamente.

## Pontos de atenção conhecidos

- **Nomes de arquivo são case-sensitive na Vercel/Linux**, mesmo que não sejam no Windows. Sempre use letras minúsculas nos nomes dos arquivos (`home.html`, não `Home.html`).
- Colunas `recorrencia` e `dia_semana` em `compromissos` guardam metadados da repetição, mas não são a fonte da verdade — cada ocorrência de uma série recorrente é uma linha própria, agrupada por `serie_id`.
- O input do formulário de compromissos não sanitiza HTML digitado no título/descrição antes de exibir (usa `innerHTML` diretamente). Como é um app de uso pessoal e single-user, o risco prático é baixo, mas evite colar HTML/scripts nesses campos.
