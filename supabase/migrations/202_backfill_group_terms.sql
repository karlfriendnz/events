-- ============================================================
-- Backfill: attach every group to its club's FIRST term.
--
-- Clone-per-term (migration 201) means a group belongs to one term. Existing
-- groups predate terms and have term_id = null, so they never show under a term
-- filter and can't be rolled over. This attaches each org's term-less groups to
-- that org's first term — creating a default "Term 1" (from the org's season,
-- else the current calendar year) when the org has none yet.
--
-- Idempotent: only touches groups with term_id IS NULL, and only creates a term
-- when the org has none, so re-running is a no-op.
-- ============================================================

do $$
declare
  o       record;
  t_id    uuid;
  t_name  text;
  s_start date;
  s_end   date;
begin
  for o in
    select id, season_start, season_end
    from organisations
    where exists (select 1 from member_groups g where g.org_id = organisations.id)
  loop
    -- the org's first term (same ordering as useTermsMemberships().loadTerms)
    select id, name into t_id, t_name
    from org_terms
    where org_id = o.id
    order by sort_order asc nulls last, start_date asc
    limit 1;

    -- none yet → create a default term from the org's season (fallback: this year)
    if t_id is null then
      s_start := coalesce(o.season_start, date_trunc('year', now())::date);
      s_end   := coalesce(o.season_end, (date_trunc('year', now()) + interval '1 year' - interval '1 day')::date);
      insert into org_terms (org_id, name, start_date, end_date, status, sort_order)
      values (o.id, 'Term 1', s_start, s_end, 'active', 0)
      returning id, name into t_id, t_name;
    end if;

    -- attach all this org's term-less groups to that term
    update member_groups
    set term_id = t_id,
        current_term = t_name
    where org_id = o.id and term_id is null;
  end loop;
end $$;
