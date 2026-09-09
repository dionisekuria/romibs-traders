create table if not exists products (
  id text primary key,
  name text not null,
  category text not null check (category in ('Everyday wear', 'Sets', 'Outerwear')),
  price integer not null check (price >= 0),
  description text not null default '',
  image text not null default '',
  image_alt text not null default '',
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists product_variants (
  id text primary key,
  product_id text not null references products(id) on delete cascade,
  label text not null,
  color text not null,
  stock integer not null default 0 check (stock >= 0)
);

create index if not exists product_variants_product_id_idx on product_variants(product_id);
alter table products enable row level security;
alter table product_variants enable row level security;
create policy "Public can read products" on products for select using (true);
create policy "Public can read variants" on product_variants for select using (true);