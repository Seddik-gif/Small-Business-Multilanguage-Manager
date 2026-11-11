-- Phase 5: inventory.
--
-- * products.min_stock: reorder level. At or below it the product shows up as "low". NULL = not tracked.
-- * stock_movements.waste_reason / note: why stock was thrown away (butchers' unsold meat, expired goods).
-- * Sign checks: waste always removes stock, a purchase always adds it.
-- * Receiving a purchase order writes ledger rows whose id is derived from the order line, so two tills
--   receiving the same delivery produce the SAME row and the server counts it once. That only works if
--   re-sending an identical row is harmless and a DIFFERENT one is refused, which the append-only guard
--   already does; it now also covers the two new columns.

alter table public.products
  add column min_stock numeric(12,3) check (min_stock is null or min_stock >= 0);

alter table public.stock_movements
  add column waste_reason text check (waste_reason in ('expired', 'spoiled', 'damaged', 'theft', 'other')),
  add column note text;

alter table public.stock_movements
  add constraint stock_movements_sign
  check ((reason <> 'waste' or delta < 0) and (reason <> 'purchase' or delta > 0));

alter table public.purchase_order_items
  add constraint purchase_order_items_valid check (quantity > 0 and unit_cost >= 0);

create or replace function public.guard_stock_movement()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'stock_movements is append-only (delete %)', old.id using errcode = 'check_violation';
  end if;
  if new.product_id is distinct from old.product_id or new.delta is distinct from old.delta
     or new.reason is distinct from old.reason or new.ref_id is distinct from old.ref_id
     or new.user_id is distinct from old.user_id or coalesce(new.deleted, 0) <> coalesce(old.deleted, 0)
     or new.waste_reason is distinct from old.waste_reason or new.note is distinct from old.note then
    raise exception 'stock_movements is append-only (update %)', old.id using errcode = 'check_violation';
  end if;
  return new;
end $$;
