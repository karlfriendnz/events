-- Allow bookable items to be grouped by a category label
alter table bookables add column if not exists item_category text;
