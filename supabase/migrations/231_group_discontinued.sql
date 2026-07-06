-- A class the club has ENDED (not just skipped this term). Set from the term
-- wizard's Classes step ("Discontinue" on an unticked class, undoable). The
-- rollover nudge and future wizard runs EXCLUDE discontinued classes instead
-- of counting them as "not yet rolled" forever.
alter table member_groups add column if not exists discontinued_at timestamptz;
