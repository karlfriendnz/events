-- Clear the platform-global profile types. The global tier created a SECOND
-- inheritance concept (alongside NSO/ancestor inheritance) plus duplicates and
-- confusing lock/override behaviour. The prototype now uses ONE source of truth:
-- each club's OWN person types. (A single clean inheritance tier can be
-- reintroduced later if needed.) Columns left in place; only the seeded rows go.
delete from person_target_types where is_global = true;
