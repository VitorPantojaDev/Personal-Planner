# Personal Planner

Agenda pessoal + rotina de estudos + contatos + anotações + listas, para uso diário no celular e no PC. Instalável como PWA. Sem backend próprio: o frontend (HTML/CSS/JS puro) fala direto com o [Supabase](https://supabase.com) (banco de dados + autenticação + API), hospedado como site estático na [Vercel](https://vercel.com).

## Funcionalidades

- **Agenda**: visões de dia, semana e mês. Compromissos podem repetir (diária ou semanalmente, em dias específicos) e ser vinculados a um contato. Busca por título. Exportação da visão atual em `.txt` e integração opcional com Google Agenda ao salvar. Ao passar o mouse sobre um dia nas visões semana/mês, um tooltip mostra todos os compromissos daquele dia.
- **Tarefas da Semana**: checklist recorrente, sem data fixa — toda segunda-feira, tarefas não revisadas disparam um aviso para renovar ou excluir.
- **Anotações**: notas de texto livre, com busca por título/conteúdo.
- **Estudos**: cursos/disciplinas com carga horária, data limite e cálculo automático de horas/dia necessárias para cumprir a meta. Registro de sessões de estudo, cronômetro embutido. Busca por nome.
- **Contatos**: nome, telefone, endereço, categoria, observações, com pets vinculados. Busca por contato ou pet.
- **Listas**: quadros com duas colunas (ex.: "a fazer" / "feito"), para checklists soltos que não são tarefas da semana nem compromissos.
- **Mural**: recados compartilhados, visíveis a todos os usuários autenticados — pensado para uso entre poucas pessoas (ex.: família).
- **Backup**: baixa um `.json` com todos os dados do usuário logado, direto do navegador.
- **PWA**: pode ser instalado na tela inicial do celular (Android via prompt automático, iOS via instrução em tela).

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
- **Segurança**: a chave pública do Supabase (`anon key`) fica exposta no código do frontend — isso é esperado e seguro nesse modelo. Quem protege os dados são as políticas de **Row Level Security (RLS)** no banco: cada linha só é visível/editável pelo `user_id` dono dela. A chave pública sozinha não dá acesso a nada. Exceção: a tabela `recados` (Mural) é compartilhada entre todos os usuários por design.
- Todo conteúdo digitado pelo usuário (títulos, descrições, observações etc.) passa por uma função `escapeHtml()` antes de ser inserido na página, evitando que HTML/scripts colados nesses campos sejam executados.

## Estrutura de arquivos

```
index.html              → tela de login (+ prompt de instalação PWA)
home.html                → agenda (dia/semana/mês) + tarefas da semana
anotacoes.html            → notas de texto livre
contatos.html             → contatos e pets
estudos.html              → cursos e sessões de estudo
listas.html               → quadros de duas colunas
mural.html                → recados compartilhados
manifest.json              → configuração do PWA
icon-192.png, icon-512.png → ícones do PWA
style.css                   → estilos de todas as páginas
js/
  supabaseClient.js        → inicializa a conexão com o Supabase (URL + chave) + escapeHtml()
  login.js                  → autenticação + instalação do PWA
  home.js                    → lógica da agenda e das tarefas da semana
  anotacoes.js                → lógica das anotações
  contatos.js                  → lógica de contatos/pets
  estudos.js                    → lógica de cursos/sessões/cronômetro
  listas.js                      → lógica dos quadros de duas colunas
  mural.js                        → lógica dos recados compartilhados
supabase/
  schema.sql                      → schema do banco (ver aviso abaixo)
```

> ⚠️ **`schema.sql` está desatualizado em relação ao app**: hoje ele só cria as tabelas `compromissos`, `contatos`, `pets`, `cursos`, `sessoes_estudo` e `tarefas_semana`. As tabelas usadas por Anotações, Listas e Mural (`anotacoes`, `listas`, `lista_itens`, `recados`) ainda não estão no script. Até isso ser corrigido, quem seguir o passo a passo abaixo terá essas três telas quebradas (erro de tabela inexistente no Supabase).

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
5. **Importante (por enquanto):** o script não cobre Anotações, Listas nem Mural — veja o aviso na seção "Estrutura de arquivos" acima.

### 3. Criar seu usuário

Em **Authentication** → **Users** → **Add user**, informe e-mail e senha. Esse é o login que você vai usar no app.

Se for usar o **Mural** (recados compartilhados) com mais de uma pessoa, crie um usuário para cada uma em **Authentication** → **Users**.

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

Se for usar o Mural, edite também a constante `MODERADOR_ID` em `js/mural.js` com o UUID do usuário que deve aparecer com o selo de "Moderador" (encontrado em **Authentication** → **Users** no Supabase).

### 6. Testar localmente

Abra `index.html` com a extensão **Live Server** do VS Code (evite abrir o arquivo direto com duplo clique — alguns navegadores bloqueiam requisições em páginas abertas via `file://`). Faça login com o usuário criado no passo 3.

### 7. Publicar (deploy)

1. Suba o repositório para o GitHub.
2. Crie conta em [vercel.com](https://vercel.com), entre com GitHub.
3. **Add New** → **Project** → selecione o repositório.
4. Framework Preset: **Other** (é HTML/CSS/JS puro, sem build).
5. Deploy. A cada `git push` no branch principal, a Vercel publica automaticamente.
6. Para instalar como app no celular, abra o site publicado (HTTPS é obrigatório para PWA) e use "Adicionar à tela inicial" (o app já sugere isso automaticamente no Android).

## Pontos de atenção conhecidos

- **`schema.sql` incompleto** (ver aviso acima) — precisa ganhar as tabelas `anotacoes`, `listas`, `lista_itens` e `recados` com as respectivas policies de RLS.
- **Nomes de arquivo são case-sensitive na Vercel/Linux**, mesmo que não sejam no Windows. Sempre use letras minúsculas nos nomes dos arquivos (`home.html`, não `Home.html`).
- Colunas `recorrencia` e `dia_semana` em `compromissos` guardam metadados da repetição, mas não são a fonte da verdade — cada ocorrência de uma série recorrente é uma linha própria, agrupada por `serie_id`.
- O **Mural** identifica o "moderador" por um UUID fixo (`MODERADOR_ID`) escrito direto no código (`js/mural.js`), em vez de vir de uma coluna/flag no banco. Funciona, mas exige editar o código para trocar quem é moderador.