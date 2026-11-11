-- Phase 1 schema. Spec tables plus the additions flagged in README (staff, purchase_order_items,
-- stock_movements) and sync columns (updated_at, deleted) on every table for last-write-wins.
-- ids are uuid generated on the client so rows can be created offline.

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  shop_name text,
  language_preference text default 'it',
  created_at timestamptz default now()
);

create table public.categories (
  id uuid primary key, user_id uuid not null references public.users(id),
  name text not null, color text not null default '#64748b', icon text,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.products (
  id uuid primary key, user_id uuid not null references public.users(id),
  barcode text, image_url text,
  name_it text not null, name_en text, name_ar text, name_bn text, name_zh text,
  price numeric(10,2) not null default 0, price_per_kg numeric(10,2), cost_price numeric(10,2),
  stock_quantity numeric(12,3) not null default 0,
  category_id uuid references public.categories(id),
  iva_rate smallint not null default 22 check (iva_rate in (4,10,22)),
  is_active smallint not null default 1,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.customers (
  id uuid primary key, user_id uuid not null references public.users(id),
  name text not null, phone text, language_preference text,
  total_debt numeric(10,2) not null default 0, notes text,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.staff (
  id uuid primary key, user_id uuid not null references public.users(id),
  name text not null, role text not null check (role in ('owner','cashier')), pin_hash text not null,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.sales (
  id uuid primary key, user_id uuid not null references public.users(id),
  customer_id uuid references public.customers(id), staff_id uuid references public.staff(id),
  total_amount numeric(10,2) not null, payment_method text not null check (payment_method in ('cash','card','credit')),
  discount_amount numeric(10,2) not null default 0,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.sale_items (
  id uuid primary key, user_id uuid not null references public.users(id),
  sale_id uuid not null references public.sales(id), product_id uuid not null references public.products(id),
  quantity numeric(12,3) not null, unit_price numeric(10,2) not null, weight_kg numeric(10,3), total_price numeric(10,2) not null,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.debt_payments (
  id uuid primary key, user_id uuid not null references public.users(id),
  customer_id uuid not null references public.customers(id),
  amount numeric(10,2) not null, payment_date timestamptz not null default now(), notes text,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.suppliers (
  id uuid primary key, user_id uuid not null references public.users(id),
  name text not null, phone text, email text, notes text,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.purchase_orders (
  id uuid primary key, user_id uuid not null references public.users(id),
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  total_amount numeric(10,2) not null default 0, received_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.purchase_order_items (
  id uuid primary key, user_id uuid not null references public.users(id),
  purchase_order_id uuid not null references public.purchase_orders(id), product_id uuid not null references public.products(id),
  quantity numeric(12,3) not null, unit_cost numeric(10,2) not null,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

create table public.stock_movements (
  id uuid primary key, user_id uuid not null references public.users(id),
  product_id uuid not null references public.products(id),
  delta numeric(12,3) not null, reason text not null check (reason in ('sale','purchase','waste','adjustment')), ref_id uuid,
  created_at timestamptz default now(), updated_at timestamptz not null default now(), deleted smallint default 0
);

-- Row level security: each shop sees only its own rows.
do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','staff','sales','sale_items','debt_payments',
                           'suppliers','purchase_orders','purchase_order_items','stock_movements'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index on public.%I (user_id, updated_at)', t);
  end loop;
end $$;

alter table public.users enable row level security;
create policy "own profile" on public.users for all using (id = auth.uid()) with check (id = auth.uid());
