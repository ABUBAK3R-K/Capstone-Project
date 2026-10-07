-- 011_booking_cancellation.sql
--
-- Customers can cancel their own bookings. Until now a customer had no way
-- to withdraw a request: bookings had no customer UPDATE policy, so a
-- mistaken booking stayed 'pending' in the business's queue forever.
--
-- This makes the status lifecycle depend on WHO is changing it, so the
-- transition trigger from 009 is replaced with a role-aware one:
--
--   business owner:  pending → confirmed | declined,  confirmed → completed
--   customer:        pending | confirmed → cancelled
--
-- Column grants from 009 are unchanged: `status` is still the only
-- client-writable column, for customers and owners alike.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. New terminal status
-- ─────────────────────────────────────────────────────────────────────────

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'declined', 'completed', 'cancelled'));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Customers may update (only `status`, per the 009 grant) their own rows
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "Customers can cancel their own bookings" on public.bookings;
create policy "Customers can cancel their own bookings"
on public.bookings for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Role-aware transitions
-- ─────────────────────────────────────────────────────────────────────────

-- The RLS policies decide which rows each party can touch; this decides
-- which status change each party may make. Without it, the new customer
-- policy would let a customer set their own booking to 'confirmed'.
--
-- auth.uid() is null for DATABASE_URL / service-role connections (admin
-- tooling), which may make any change in the lifecycle.
--
-- SECURITY DEFINER so the ownership lookup sees the business row regardless
-- of the caller's RLS visibility.
create or replace function public.enforce_booking_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  is_privileged boolean := caller is null;
  is_customer boolean := caller is not null and caller = old.customer_id;
  is_owner boolean := caller is not null and exists (
    select 1 from public.businesses b where b.id = old.business_id and b.owner_id = caller
  );
  owner_move boolean;
  customer_move boolean;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  owner_move :=
    (old.status = 'pending' and new.status in ('confirmed', 'declined'))
    or (old.status = 'confirmed' and new.status = 'completed');
  customer_move :=
    old.status in ('pending', 'confirmed') and new.status = 'cancelled';

  if not (
    (owner_move and (is_owner or is_privileged))
    or (customer_move and (is_customer or is_privileged))
  ) then
    raise exception 'A booking cannot move from % to % (as %)',
      old.status, new.status,
      case when is_privileged then 'admin' when is_owner then 'business' else 'customer' end
      using errcode = 'check_violation';
  end if;

  -- responded_at records the business's answer, mirroring
  -- problem_reports.resolved_at — a customer cancelling isn't one.
  if old.status = 'pending' and new.status in ('confirmed', 'declined') then
    new.responded_at := now();
  end if;

  return new;
end;
$$;
