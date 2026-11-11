-- Phase 7.
--
-- * A sale's amounts can never be negative (a discount larger than the basket would make the total negative).
--   The app caps discounts at the basket value; the database is the backstop.
-- * staff.language_preference: the language each person uses. Unlocking with a PIN switches the till to
--   that person's language ("language persisted per user" in the spec), on every till.

alter table public.sales
  add constraint sales_amounts_valid check (discount_amount >= 0 and total_amount >= 0);

alter table public.staff
  add column language_preference text
  check (language_preference is null or language_preference in ('it', 'en', 'ar', 'bn', 'zh'));
