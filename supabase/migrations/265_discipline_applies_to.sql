-- Where each discipline applies. A governing body can mark a discipline as
-- relevant to only certain parts of the system (Events / Groups / Competitions /
-- …). Clubs then only see the right disciplines when linking in that context.
--
-- NULL or empty = applies EVERYWHERE (no restriction) — the safe default so
-- existing disciplines keep showing in every linker.
alter table disciplines add column if not exists applies_to text[];
