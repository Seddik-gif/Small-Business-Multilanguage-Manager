-- Phase 6: reports.
--
-- Each sale line remembers the cost price AND the IVA rate the product had WHEN IT WAS SOLD.
-- Reports use these, not the product's current values:
--  * receiving a delivery updates a product's cost price (0007), and a margin report that re-priced old
--    sales with today's cost would drift every time that happened;
--  * re-classifying a product (say 22% to 10%) must not rewrite the IVA of past days.
-- NULL = not known at the time (the report then falls back to the product's current value and says so).
alter table public.sale_items
  add column unit_cost numeric(10,2) check (unit_cost is null or unit_cost >= 0),
  add column iva_rate smallint check (iva_rate is null or iva_rate in (4, 10, 22));
