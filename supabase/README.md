# Configuração do Banco de Dados no Supabase

Este diretório contém a estrutura de migrações e documentação para o banco de dados do projeto **Thay Cake** integrado com o **Supabase**.

---

## Detalhes do Projeto Criado

O banco de dados foi criado e provisionado dinamicamente:
* **Nome do Projeto:** `projeto-thay-cake`
* **ID do Projeto (Ref):** `bloxthjlozcwefgsmywq`
* **Região:** `sa-east-1` (São Paulo - América do Sul)
* **URL do Projeto:** `https://bloxthjlozcwefgsmywq.supabase.co`

---

## Credenciais geradas para Configuração (Render/Ambiente)

Para que o backend do seu site (`server.py`) conecte a este banco de dados, você deve adicionar as seguintes **variáveis de ambiente** nas configurações do seu deploy no Render:

1. `SUPABASE_URL`:
   ```env
   https://bloxthjlozcwefgsmywq.supabase.co
   ```
2. `SUPABASE_KEY` (Chave de Serviço / Service Role Key):
   * **IMPORTANTE PARA SEGURANÇA:** No painel do seu projeto no Supabase, vá em **Project Settings** -> **API** -> localize a chave chamada **`service_role`** (ela possui a descrição "secret" e "key that bypasses Row Level Security").
   * Cole esta chave no valor de `SUPABASE_KEY`. Isso permitirá que o backend execute escritas, atualizações e deleções com segurança total.
   * *Atenção:* Nunca exponha a chave `service_role` no frontend do site. Como o nosso frontend comunica-se exclusivamente com a API do `server.py`, esta chave ficará 100% segura apenas no servidor do Render.

---

## Estrutura do Banco de Dados

Aplicamos a migração contida em `migrations/20260620160000_create_tables_and_rls.sql` que cria:

### 1. Tabelas e Índices
* **`public.products`**: Armazena produtos da loja.
  * Índice: `idx_products_created_at` (ordenação por data de criação).
* **`public.feedbacks`**: Armazena avaliações dos clientes.
  * Índice: `idx_feedbacks_created_at` (ordenação por data de envio).
* **`public.creators`**: Armazena a biografia da equipe do site.
  * Índice: `idx_creators_created_at` (ordenação sequencial).

### 2. Validação e Segurança a Nível de Banco (Alta Robustez)
Para evitar corrupção de dados ou abusos (além do tratamento contra SQL Injection nativo do PostgREST):
* **Constraints de Texto**: Impedem a inserção de strings vazias ou compostas apenas de espaços.
* **Constraints de Valores**:
  * O rating do feedback deve estar entre `1` e `5` estrelas.
  * O preço do produto deve ser maior ou igual a `0`.

### 3. Row Level Security (RLS) e Políticas
Ativamos RLS em todas as tabelas e no Storage, configurando as seguintes permissões para acesso público (`anon`):
* **Produtos & Criadores**: Apenas leitura pública (`SELECT`). Inserções, edições e exclusões são bloqueadas para chaves públicas, exigindo a chave `service_role` (usada pelo backend do Render).
* **Feedbacks**: Leitura pública (`SELECT`) e inserção pública (`INSERT`). Edições e exclusões são bloqueadas para chaves públicas.
* **Storage (Bucket `uploads`)**: Leitura, inserção e deleção liberadas no bucket público `uploads` para o upload de fotos funcionar de forma integrada com os tokens.
