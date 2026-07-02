-- Notes can carry an optional due date (task-style follow-up).
alter table person_notes add column if not exists due_date date;
