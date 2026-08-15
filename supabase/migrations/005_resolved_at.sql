-- Add resolved_at timestamp column to problem_reports
alter table problem_reports 
add column if not exists resolved_at timestamptz default null;
