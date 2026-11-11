-- Stock is derived on the server from the stock_movements ledger. Clients never write it.
--
-- Contract:
--   * Clients push stock_movements (append-only): +purchase, -sale, -waste, ±adjustment.
--   * The server keeps product_stock.stock_quantity = SUM(delta) per product, via trigger.
--   * Clients pull product_stock as a read-only cache. Local display value =
--       server stock_quantity + SUM(delta of local movements not yet pushed).

-- 1. No stock column on products: a client that still sends one gets an error instead of
--    silently overwriting another till's sales.
alter table public.products drop column stock_quantity;

-- 2. Server-maintained stock, readable but not writable by clients (no write policies).
create table public.product_stock (
  product_id uuid primary key references public.products(id) on delete cascade,
  user_id uuid not null references public.users(id),
  stock_quantity numeric(12,3) not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.product_stock enable row level security;
create policy "read own stock" on public.product_stock for select using (user_id = auth.uid());
create index on public.product_stock (user_id, updated_at);

-- Atomic increment: concurrent tills serialize on the product_stock row lock, nothing is lost.
create or replace function public.bump_stock(p_product uuid, p_user uuid, p_delta numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into product_stock (product_id, user_id, stock_quantity, updated_at)
  values (p_product, p_user, p_delta, now())
  on conflict (product_id) do update
    set stock_quantity = product_stock.stock_quantity + excluded.stock_quantity,
        updated_at = now();
end $$;

-- 3. Ledger rows are append-only. A retried upsert of the same movement is allowed (nothing
--    changes); editing or deleting one is not. Corrections are new 'adjustment' movements.
create or replace function public.guard_stock_movement()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'stock_movements is append-only (delete %)', old.id using errcode = 'check_violation';
  end if;
  if new.product_id is distinct from old.product_id or new.delta is distinct from old.delta
     or new.reason is distinct from old.reason or new.ref_id is distinct from old.ref_id
     or new.user_id is distinct from old.user_id or coalesce(new.deleted, 0) <> coalesce(old.deleted, 0) then
    raise exception 'stock_movements is append-only (update %)', old.id using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.guard_stock_movement();

-- 4. Apply each new movement. Also blocks a shop from moving another shop's stock: the FK alone
--    would accept any existing product id regardless of RLS.
create or replace function public.apply_stock_movement()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from products where id = new.product_id;
  if owner is distinct from new.user_id then
    raise exception 'product % does not belong to this shop', new.product_id using errcode = 'insufficient_privilege';
  end if;
  if coalesce(new.deleted, 0) = 0 and new.delta <> 0 then
    perform bump_stock(new.product_id, new.user_id, new.delta);
  end if;
  return new;
end $$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- 5. Every product gets a stock row (0) so devices can pull it even before the first movement.
create or replace function public.init_product_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into product_stock (product_id, user_id, stock_quantity) values (new.id, new.user_id, 0)
  on conflict (product_id) do nothing;
  return new;
end $$;

create trigger products_init_stock
  after insert on public.products
  for each row execute function public.init_product_stock();

-- Backfill for any data that existed before this migration.
insert into public.product_stock (product_id, user_id, stock_quantity)
select p.id, p.user_id, coalesce(sum(m.delta) filter (where coalesce(m.deleted, 0) = 0), 0)
from public.products p left join public.stock_movements m on m.product_id = p.id
group by p.id, p.user_id
on conflict (product_id) do nothing;

-- 6. Create the shop profile row when an owner signs up (public.users.id = auth.users.id).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
