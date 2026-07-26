-- Which part of the banner image should show.
--
-- A banner is displayed in boxes of very different shapes — a 128px strip in the
-- wizard, a 220px hero on the public form, a card thumbnail — and `object-fit:
-- cover` centres by default. On a photo where the subject isn't dead centre
-- (most photos) that crops the wrong part, and the only recourse was to edit the
-- file elsewhere and re-upload.
--
-- Stored as a CSS `object-position` value ("50% 30%") rather than a crop, so the
-- ORIGINAL image is kept and re-framed correctly at every size it's shown at.
-- A crop would have baked one box's aspect ratio into the file.
--
-- NULL = centre, i.e. exactly today's behaviour for every existing event.

ALTER TABLE `events` ADD COLUMN `banner_position` varchar(24);
