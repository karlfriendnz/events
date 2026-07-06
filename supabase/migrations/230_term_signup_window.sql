-- Sign-up window on a TERM (not on registration forms — forms stay date-free;
-- the term owns WHEN registration is open, the form is just HOW you register).
--   signup_open  — date member registration for this term's groups opens.
--                  Null = open as soon as the term exists.
--   signup_close — date it closes. Null = closes when the term ends (end_date).
-- Two terms can be open at once (late Term 3 joins + Term 4 re-enrolment);
-- the public form resolves which term instances of a class are open and offers
-- a term picker when more than one is.
alter table org_terms add column if not exists signup_open date;
alter table org_terms add column if not exists signup_close date;
