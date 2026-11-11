-- Phase 3 sync support.
--
-- 1. synced_at: a SERVER-assigned timestamp, bumped on every insert/update. Devices pull
--    "rows changed since my last pull" by synced_at, never by updated_at. updated_at is set by the
--    device that made the edit, so a till that was offline pushes an old updated_at long after
--    other tills moved their cursor past it, and they would never see that row.
-- 2. Newest edit wins, enforced on the server too: a push carrying an older updated_at than the
--    stored row is ignored. Without this, a till that reconnects late overwrites a newer edit.
--
-- Tables that sync rows. stock_movements is append-only (0003), so it gets synced_at but no LWW
-- guard: a retried identical upsert is already a no-op there.

create or replace function public.touch_synced_at()
returns trigger language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

-- Skip (return NULL) an update whose updated_at is not newer than what is stored. Equal timestamps
-- are skipped too, which makes a retried push idempotent.
create or replace function public.lww_guard()
returns trigger language plpgsql as $$
begin
  if new.updated_at <= old.updated_at then
    return null;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','staff','sales','sale_items','debt_payments',
                           'suppliers','purchase_orders','purchase_order_items','stock_movements'] loop
    execute format('alter table public.%I add column synced_at timestamptz not null default clock_timestamp()', t);
    execute format('create index on public.%I (user_id, synced_at)', t);
    -- Trigger names sort alphabetically: the guard (a_) runs first and can cancel the update before
    -- z_touch_synced_at stamps it.
    execute format('create trigger z_touch_synced_at before insert or update on public.%I
                    for each row execute function public.touch_synced_at()', t);
    if t <> 'stock_movements' then
      execute format('create trigger a_lww_guard before update on public.%I
                      for each row execute function public.lww_guard()', t);
    end if;
  end loop;
end $$;

-- product_stock is written only by the server (bump_stock) and pulled by updated_at, which the server
-- sets itself, so it needs neither column nor guard. Index for the pull query:
create index if not exists product_stock_user_updated_idx on public.product_stock (user_id, updated_at);
