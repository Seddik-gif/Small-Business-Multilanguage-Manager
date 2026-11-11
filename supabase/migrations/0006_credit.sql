-- Phase 4: customers & credit (vendita a credito).
--
-- A customer's debt is DERIVED: credit sales minus payments. It is never stored. A stored
-- total_debt would be overwritten by whichever till syncs last when two tills record a sale or a
-- payment for the same customer while offline (the stock problem, see 0003). Every sale and every
-- payment is its own row, so nothing is ever lost.
alter table public.customers drop column total_debt;

-- A credit sale must say who owes. The app checks this too; the database is the backstop.
alter table public.sales
  add constraint sales_credit_needs_customer
  check (payment_method <> 'credit' or customer_id is not null);

alter table public.debt_payments
  add constraint debt_payments_positive check (amount > 0);

create index if not exists sales_customer_idx on public.sales (customer_id) where customer_id is not null;
create index if not exists debt_payments_customer_idx on public.debt_payments (customer_id);

-- Server-side balance per customer: what the tills compute locally, available for reports and as a
-- cross-check. security_invoker makes it obey the caller's row-level security.
create view public.customer_balances with (security_invoker = true) as
select
  c.id as customer_id,
  c.user_id,
  coalesce((select sum(s.total_amount) from public.sales s
            where s.customer_id = c.id and s.payment_method = 'credit' and coalesce(s.deleted, 0) = 0), 0)
  - coalesce((select sum(p.amount) from public.debt_payments p
              where p.customer_id = c.id and coalesce(p.deleted, 0) = 0), 0) as balance
from public.customers c
where coalesce(c.deleted, 0) = 0;
