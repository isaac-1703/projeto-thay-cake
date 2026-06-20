-- Habilitar a extensão uuid-ossp caso seja necessária
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------
-- 1. TABELA DE PRODUTOS (products)
-- ------------------------------------------------------------------
create table if not exists public.products (
    id text primary key,
    name text not null constraint products_name_check check (char_length(trim(name)) > 0),
    price numeric(10,2) not null constraint products_price_check check (price >= 0),
    photo text not null constraint products_photo_check check (char_length(trim(photo)) > 0),
    created_at double precision not null default extract(epoch from now())
);

-- Índices para otimização de busca e ordenação
create index if not exists idx_products_created_at on public.products(created_at desc);

-- Habilitar RLS (Row Level Security)
alter table public.products enable row level security;

-- Política de RLS: Leitura pública para todos
drop policy if exists "Allow public read access to products" on public.products;
create policy "Allow public read access to products"
on public.products for select
to anon, authenticated
using (true);


-- ------------------------------------------------------------------
-- 2. TABELA DE FEEDBACKS (feedbacks)
-- ------------------------------------------------------------------
create table if not exists public.feedbacks (
    id text primary key,
    name text not null default 'Anônimo' constraint feedbacks_name_check check (char_length(trim(name)) > 0),
    rating integer not null constraint feedbacks_rating_check check (rating >= 1 and rating <= 5),
    comment text not null default '',
    created_at double precision not null default extract(epoch from now())
);

-- Índices para otimização
create index if not exists idx_feedbacks_created_at on public.feedbacks(created_at desc);

-- Habilitar RLS
alter table public.feedbacks enable row level security;

-- Políticas de RLS: Leitura pública e Inserção pública
drop policy if exists "Allow public read access to feedbacks" on public.feedbacks;
create policy "Allow public read access to feedbacks"
on public.feedbacks for select
to anon, authenticated
using (true);

drop policy if exists "Allow public insert access to feedbacks" on public.feedbacks;
create policy "Allow public insert access to feedbacks"
on public.feedbacks for insert
to anon, authenticated
with check (true);


-- ------------------------------------------------------------------
-- 3. TABELA DE CRIADORES (creators)
-- ------------------------------------------------------------------
create table if not exists public.creators (
    id text primary key,
    name text not null constraint creators_name_check check (char_length(trim(name)) > 0),
    role text not null constraint creators_role_check check (char_length(trim(role)) > 0),
    bio text not null constraint creators_bio_check check (char_length(trim(bio)) > 0),
    photo text not null constraint creators_photo_check check (char_length(trim(photo)) > 0),
    instagram text constraint creators_instagram_check check (instagram is null or char_length(trim(instagram)) >= 0),
    github text constraint creators_github_check check (github is null or char_length(trim(github)) >= 0),
    linkedin text constraint creators_linkedin_check check (linkedin is null or char_length(trim(linkedin)) >= 0),
    created_at double precision not null default extract(epoch from now())
);

-- Índices para otimização
create index if not exists idx_creators_created_at on public.creators(created_at asc);

-- Habilitar RLS
alter table public.creators enable row level security;

-- Política de RLS: Leitura pública para todos
drop policy if exists "Allow public read access to creators" on public.creators;
create policy "Allow public read access to creators"
on public.creators for select
to anon, authenticated
using (true);


-- ------------------------------------------------------------------
-- 4. BUCKET DE STORAGE E POLÍTICAS
-- ------------------------------------------------------------------
-- Criar bucket 'uploads' se não existir
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Remover políticas existentes caso existam para evitar conflitos de nomes
drop policy if exists "Public Access to Uploads Bucket" on storage.objects;
drop policy if exists "Public Insert to Uploads Bucket" on storage.objects;
drop policy if exists "Public Delete from Uploads Bucket" on storage.objects;

-- Criar política de leitura pública
create policy "Public Access to Uploads Bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'uploads');

-- Criar política de inserção pública
create policy "Public Insert to Uploads Bucket"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'uploads');

-- Criar política de exclusão pública
create policy "Public Delete from Uploads Bucket"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'uploads');
