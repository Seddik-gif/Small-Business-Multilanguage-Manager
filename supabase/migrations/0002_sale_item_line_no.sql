-- Phase 2: keep receipt lines in the order they were rung up.
alter table public.sale_items add column line_no integer not null default 0;
