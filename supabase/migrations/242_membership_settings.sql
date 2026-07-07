-- Membership settings outgrew "renewal" (241): the blob now also carries
-- purchase rules (who can buy, registration options, payment collection,
-- admin approval) and benefits (account credit). Rename to match. Shape is
-- owned by useMemberships.defaultMembershipSettings(); null = defaults.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'member_groups' and column_name = 'renewal') then
    alter table member_groups rename column renewal to membership_settings;
  end if;
end $$;
