-- RLS Test Script for problem_reports table
-- Run this in the Supabase SQL Editor to verify RLS policies are enforced correctly.

begin;

-- 1. Create fake users to test visibility
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
insert into profiles (id, name, role) values ('11111111-1111-1111-1111-111111111111', 'Regular User', 'user') on conflict do nothing;

insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222') on conflict do nothing;
insert into profiles (id, name, role) values ('22222222-2222-2222-2222-222222222222', 'Admin User', 'admin') on conflict do nothing;

-- 2. Ensure a problem report exists for User 1
insert into problem_reports (id, user_id, category, location, description)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Garbage', 'POINT(77.58 12.96)', 'Test Report')
on conflict do nothing;


-- ==========================================
-- TEST 1: Plain user querying problem_reports
-- ==========================================
-- Simulating auth.uid() = 11111111...
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select count(*) as regular_user_visibility_count from problem_reports;
-- SUCCESS CONDITION: Should return a small number (only their own reports)

-- Try to update the status as a regular user
update problem_reports set status = 'fixed' where id = '33333333-3333-3333-3333-333333333333';
-- SUCCESS CONDITION: Should succeed execution, but update 0 rows due to RLS blocking it.


-- ==========================================
-- TEST 2: Admin user querying problem_reports
-- ==========================================
-- Simulating auth.uid() = 22222222...
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select count(*) as admin_visibility_count from problem_reports;
-- SUCCESS CONDITION: Should return ALL reports in the entire database

-- Try to update the status as an admin
update problem_reports set status = 'in_progress' where id = '33333333-3333-3333-3333-333333333333';
select status as updated_status_by_admin from problem_reports where id = '33333333-3333-3333-3333-333333333333';
-- SUCCESS CONDITION: The status should now read 'in_progress'

-- Cleanup and rollback the test data to leave the DB untouched
rollback;
