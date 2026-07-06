-- Terminology belongs to a SPORT. Each sport a club runs can carry its own
-- term overrides (a swim squad says "Swimmer/Squad", the gymnastics side says
-- "Gymnast/Class"). Resolution layers: defaults ← NSO ancestors ← the org's
-- own organisations.terminology ← the sport's org_sports.terminology.
-- Club-level pages resolve with the PRIMARY sport; sport-scoped screens can
-- pass a specific org_sports row.
alter table org_sports add column if not exists terminology jsonb;
