-- 171_circles_phase2.sql — Families & Circles, Phase 2.
-- Brings the model toward Hello Club parity (minus financials, parked):
--   • bookings.subject_person_id — WHO a booking is for (vs the contact who made it),
--     enabling "book on behalf of" a family dependent / circle co-member.
--   • circles.color — per-circle colour swatch (HC lets leads colour their circle).
--   • circle_members.is_lead — circle "leads" (HC concept): a member promoted to
--     manage the circle + act on behalf. Families already use guardian/dependent;
--     is_lead is the circle-side analogue and may also flag a primary guardian.
--   • circle_members.can_register — grant to sign this member up to events/classes,
--     separate from can_book_for (resource bookings). Defaults true.

alter table public.bookings
  add column if not exists subject_person_id uuid references public.persons(id) on delete set null;

create index if not exists bookings_subject_person_id_idx
  on public.bookings (subject_person_id);

alter table public.circles
  add column if not exists color text;

alter table public.circle_members
  add column if not exists is_lead boolean not null default false,
  add column if not exists can_register boolean not null default true;
