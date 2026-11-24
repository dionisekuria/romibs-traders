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

create table if not exists staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table products enable row level security;
alter table product_variants enable row level security;
alter table staff_members enable row level security;

create policy "Public can read products" on products for select using (true);
create policy "Public can read variants" on product_variants for select using (true);

revoke all on public.staff_members from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_variants from anon, authenticated;
grant select on public.staff_members to service_role;
grant select on public.products, public.product_variants to anon, authenticated;
grant select on public.products, public.product_variants to service_role;

create or replace function public.create_product_with_variants(
  p_id text,
  p_name text,
  p_category text,
  p_price integer,
  p_description text,
  p_image text,
  p_image_alt text,
  p_featured boolean,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'At least one product variant is required.' using errcode = '22023';
  end if;

  insert into public.products (id, name, category, price, description, image, image_alt, featured)
  values (p_id, p_name, p_category, p_price, p_description, p_image, p_image_alt, p_featured);

  insert into public.product_variants (id, product_id, label, color, stock)
  select variant.id, p_id, variant.label, variant.color, variant.stock
  from jsonb_to_recordset(p_variants) as variant(id text, label text, color text, stock integer);
end;
$$;

create or replace function public.update_product_inventory(
  p_id text,
  p_price integer,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant record;
  affected_rows integer;
begin
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'At least one product variant is required.' using errcode = '22023';
  end if;

  update public.products set price = p_price where id = p_id;
  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  for variant in
    select item.id, item.stock
    from jsonb_to_recordset(p_variants) as item(id text, stock integer)
  loop
    update public.product_variants
    set stock = variant.stock
    where id = variant.id and product_id = p_id;

    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      raise exception 'Variant does not belong to this product.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

revoke execute on function public.create_product_with_variants(text, text, text, integer, text, text, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.update_product_inventory(text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.create_product_with_variants(text, text, text, integer, text, text, text, boolean, jsonb) to service_role;
grant execute on function public.update_product_inventory(text, integer, jsonb) to service_role;

create table if not exists public.catalog_sync_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('google_sheets')),
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  actor_user_id uuid,
  product_count integer not null default 0,
  variant_count integer not null default 0,
  error text
);

create index if not exists catalog_sync_runs_started_at_idx
  on public.catalog_sync_runs(started_at desc);

alter table public.catalog_sync_runs enable row level security;
revoke all on public.catalog_sync_runs from anon, authenticated;
grant select on public.catalog_sync_runs to service_role;

create or replace function public.update_catalog_product(
  p_id text,
  p_name text,
  p_category text,
  p_price integer,
  p_description text,
  p_image text,
  p_image_alt text,
  p_featured boolean,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant record;
  affected_rows integer;
begin
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'At least one product variant is required.' using errcode = '22023';
  end if;

  update public.products
  set name = p_name,
      category = p_category,
      price = p_price,
      description = p_description,
      image = p_image,
      image_alt = p_image_alt,
      featured = p_featured
  where id = p_id;
  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  for variant in
    select item.id, item.label, item.color, item.stock
    from jsonb_to_recordset(p_variants) as item(id text, label text, color text, stock integer)
  loop
    insert into public.product_variants (id, product_id, label, color, stock)
    values (variant.id, p_id, variant.label, variant.color, variant.stock)
    on conflict (id) do update
    set product_id = p_id,
        label = excluded.label,
        color = excluded.color,
        stock = excluded.stock
    where public.product_variants.product_id = p_id;

    if not found then
      raise exception 'Variant ID belongs to another product.' using errcode = '22023';
    end if;
  end loop;

  delete from public.product_variants
  where product_id = p_id
    and id not in (
      select item.id
      from jsonb_to_recordset(p_variants) as item(id text, label text, color text, stock integer)
    );
end;
$$;

create or replace function public.delete_catalog_product(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  delete from public.products where id = p_id;
  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_catalog_product(text, text, text, integer, text, text, text, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.delete_catalog_product(text) from public, anon, authenticated;
grant execute on function public.update_catalog_product(text, text, text, integer, text, text, text, boolean, jsonb) to service_role;
grant execute on function public.delete_catalog_product(text) to service_role;

create or replace function public.sync_catalog_from_sheets(p_rows jsonb, p_actor_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id bigint;
  product record;
  product_count integer := 0;
  variant_count integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Sheet rows must be a JSON array.' using errcode = '22023';
  end if;

  insert into public.catalog_sync_runs (source, status, actor_user_id)
  values ('google_sheets', 'running', p_actor_user_id)
  returning id into run_id;

  delete from public.product_variants;
  delete from public.products;

  for product in
    select distinct row.id, row.name, row.category, row.price, row.description, row.image, row.image_alt, row.featured
    from jsonb_to_recordset(p_rows) as row(
      id text, name text, category text, price integer, description text, image text,
      image_alt text, featured boolean, variant_id text, variant_label text,
      variant_color text, variant_stock integer
    )
  loop
    insert into public.products (id, name, category, price, description, image, image_alt, featured)
    values (product.id, product.name, product.category, product.price, product.description, product.image, product.image_alt, product.featured);
    product_count := product_count + 1;
  end loop;

  insert into public.product_variants (id, product_id, label, color, stock)
  select row.variant_id, row.id, row.variant_label, row.variant_color, row.variant_stock
  from jsonb_to_recordset(p_rows) as row(
    id text, name text, category text, price integer, description text, image text,
    image_alt text, featured boolean, variant_id text, variant_label text,
    variant_color text, variant_stock integer
  );
  get diagnostics variant_count = row_count;

  update public.catalog_sync_runs
  set status = 'success', completed_at = now(), product_count = product_count, variant_count = variant_count
  where id = run_id;
  return run_id;
end;
$$;

revoke execute on function public.sync_catalog_from_sheets(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.sync_catalog_from_sheets(jsonb, uuid) to service_role;