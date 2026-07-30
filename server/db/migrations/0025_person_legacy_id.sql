-- The old platform's Person that corresponds to one of ours.
--
-- An invoice over there REQUIRES a personID — a charge with no member attached
-- isn't a thing in their books. So anyone who registers has to exist over there
-- before they can be invoiced, and this is where we remember who they turned out
-- to be. Without it, every registration would look up (or worse, re-create) the
-- same member on every save.
--
-- Null = never resolved. Either the club has no legacy connection, or this person
-- has not registered for anything that needed invoicing yet.
ALTER TABLE persons ADD COLUMN legacy_person_id INT NULL;
CREATE INDEX idx_persons_legacy_person_id ON persons (legacy_person_id);
