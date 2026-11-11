
-- 1. Tạo hàm kiểm tra bình luận cha
create or replace function public.comment_parent_matches(
  p_parent_id uuid,
  p_confession_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.comments parent
    where parent.id = p_parent_id
      and parent.confession_id = p_confession_id
  );
$$;

-- 2. Giới hạn quyền sử dụng hàm
revoke all on function public.comment_parent_matches(uuid, uuid)
from public, anon;

grant execute on function public.comment_parent_matches(uuid, uuid)
to authenticated;

-- 3. Xóa chính sách INSERT cũ
drop policy if exists "comments_insert_own"
on public.comments;

-- 4. Tạo chính sách INSERT mới
create policy "comments_insert_own"
on public.comments
for insert
to authenticated
with check (
  user_id = (select auth.uid())

  and exists (
    select 1
    from public.confessions c
    where c.id = confession_id
      and c.status = 'approved'
  )

  and (
    parent_id is null
    or public.comment_parent_matches(
      parent_id,
      confession_id
    )
  )
);
----------------------

create or replace function public.admin_approve_confessions(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_max integer;
  v_updated integer;
begin
  -- Kiểm tra quyền admin
  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) then
    raise exception 'Bạn không có quyền quản trị.';
  end if;

  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  -- Khóa để tránh cấp trùng số thứ tự
  perform pg_advisory_xact_lock(
    hashtext('confessions_daily_approval_numbering')
  );

  -- Lấy số thứ tự lớn nhất trong ngày
  select coalesce(max(cfs_number), 0)
  into v_max
  from public.confessions
  where status = 'approved'
    and publish_date = v_today;

  -- Khóa các bài viết cần duyệt riêng biệt
  perform c.id
  from public.confessions c
  where c.id = any(p_ids)
    and c.status = 'pending'
  order by c.created_at asc, c.id asc
  for update;

  -- Đánh số thứ tự sau khi đã khóa bản ghi
  with chosen as materialized (
    select
      c.id,
      row_number() over (
        order by c.created_at asc, c.id asc
      ) as rn
    from public.confessions c
    where c.id = any(p_ids)
      and c.status = 'pending'
  )
  update public.confessions c
  set
    status = 'approved',
    publish_date = v_today,
    cfs_number = v_max + chosen.rn::integer
  from chosen
  where c.id = chosen.id;

  get diagnostics v_updated = row_count;

  return v_updated;
end;
$$;

revoke all on function
public.admin_approve_confessions(uuid[])
from public;

grant execute on function
public.admin_approve_confessions(uuid[])
to authenticated;
--------------------
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'chantu427@gmail.com';