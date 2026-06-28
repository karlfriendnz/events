-- PROTOTYPE (/proto/*) — global core fields. The Personal-details and
-- Communication sections are the SAME for every person type, so they're defined
-- once at the org level, not per type. This stores which OPTIONAL core fields the
-- club collects (the required ones — First/Last/Role/Email/Phone — are always on).
-- Shape: { "enabled": { "dob": true, "gender": true, "phone2": false, "comms": true } }
alter table organisations add column if not exists core_fields jsonb not null default '{}'::jsonb;
