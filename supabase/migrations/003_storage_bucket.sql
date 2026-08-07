-- Create a public storage bucket for issue report images
insert into storage.buckets (id, name, public) 
values ('reports', 'reports', true)
on conflict (id) do nothing;

-- Storage Policies for 'reports' bucket

-- 1. Anyone can view the images
create policy "Public Access to reports images"
on storage.objects for select
to public
using ( bucket_id = 'reports' );

-- 2. Only authenticated users can upload images
create policy "Authenticated users can upload report images"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'reports' );

-- 3. Users can only update/delete their own uploads (optional, but good practice)
create policy "Users can update their own uploads"
on storage.objects for update
to authenticated
using ( bucket_id = 'reports' and auth.uid() = owner );

create policy "Users can delete their own uploads"
on storage.objects for delete
to authenticated
using ( bucket_id = 'reports' and auth.uid() = owner );
