-- Quán Quen: toàn bộ cấu trúc database (bảng, view, RLS, hàm, trigger, bucket ảnh).
-- Chạy trong SQL Editor của Supabase. Chạy lại được nhiều lần: bảng dùng "if not exists" (không mất dữ liệu),
-- view, hàm, trigger, policy được tạo lại. Thêm cột mới vào bảng đã có thì phải viết "alter table" riêng.
-- Mọi quy tắc tin cậy nằm ở đây, không nằm ở frontend (phương án kỹ thuật, mục 4).

-- ───────────── Bảng ─────────────

create table if not exists areas (
  id smallint generated always as identity primary key,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 1500
);

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30)
);

create table if not exists places (
  id bigint generated always as identity primary key,
  google_place_id text unique,
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (category in ('bun_pho_mi','com','banh_mi_xoi','an_vat','do_uong','ca_phe','che')),
  lat double precision not null,
  lng double precision not null,
  address text check (char_length(address) <= 200),
  area_id smallint references areas,
  price_min int,
  price_max int check (price_max >= price_min),
  opening_hours jsonb,
  status text not null default 'pending' check (status in ('pending','visible','hidden')),
  created_by uuid default auth.uid() references profiles on delete set null,
  suggested_by_name text,          -- tên người gợi ý qua comment fanpage (bản thiết kế, mục 12)
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  place_id bigint not null references places on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  price_paid int check (price_paid between 1000 and 500000),
  dishes text[] not null default '{}' check (cardinality(dishes) <= 5),
  comment text check (char_length(comment) <= 200),
  checkin_distance_m int not null,
  is_sample boolean not null default false,
  status text not null default 'visible' check (status in ('pending','visible','hidden')),
  review_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, review_date)   -- 1 đánh giá / quán / ngày theo giờ Việt Nam
);

create table if not exists photos (
  id bigint generated always as identity primary key,
  review_id bigint not null references reviews on delete cascade,
  place_id bigint not null references places on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  storage_path text not null unique,      -- bản 1280 px '<uid>/<review_id>/1.webp'; bản 400 px là '…/1_t.webp'
  width int, height int,
  status text not null default 'pending' check (status in ('pending','visible','hidden')),
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('review','photo')),
  target_id bigint not null,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id)  -- mỗi người báo một lần, nên "3 báo cáo" = 3 người
);

create index if not exists reviews_place_idx on reviews (place_id, created_at desc);
create index if not exists photos_place_idx on photos (place_id, created_at desc);
create index if not exists places_created_by_idx on places (created_by, created_at);

-- ───────────── Quyền theo bảng và cột ─────────────
-- Supabase mặc định cấp mọi quyền cho anon/authenticated; RLS bên dưới mới là thứ chặn theo dòng.
-- Ở đây chỉ thu hẹp thêm những cột không được đụng tới.

alter table areas    enable row level security;
alter table profiles enable row level security;
alter table places   enable row level security;
alter table reviews  enable row level security;
alter table photos   enable row level security;
alter table reports  enable row level security;

-- Cấp quyền tường minh, không dựa vào quyền mặc định của Supabase (dự án mới có thể tắt việc tự cấp quyền cho bảng mới).
-- RLS bên dưới vẫn quyết định từng dòng; các lệnh revoke sau đó thu hẹp lại theo cột.
grant usage on schema public to anon, authenticated;
grant select on areas, profiles, places, photos to anon, authenticated;
grant insert, delete on photos to authenticated;
grant insert on reports to authenticated;
grant usage on all sequences in schema public to authenticated;

-- reviews: giấu checkin_distance_m. Hệ quả: select=* trên reviews bị từ chối, phải liệt kê cột.
revoke select, insert, update on reviews from anon, authenticated;
grant select (id, place_id, user_id, stars, price_paid, dishes, comment, is_sample, status, review_date, created_at)
  on reviews to anon, authenticated;
grant delete on reviews to authenticated;

-- places: người dùng chỉ điền được các cột của form đề xuất; status, created_by, suggested_by_name do database đặt.
revoke insert, update, delete on places from anon, authenticated;
grant insert (name, category, lat, lng, address, area_id, price_min, price_max) on places to authenticated;

-- profiles: chỉ đổi được tên hiển thị.
revoke insert, update, delete on profiles from anon, authenticated;
grant update (display_name) on profiles to authenticated;

-- photos: thêm và xóa của mình; status do trigger đặt.
revoke update on photos from anon, authenticated;
revoke insert, delete on photos from anon;

-- reports: chỉ thêm.
revoke select, update, delete on reports from anon, authenticated;
revoke insert on reports from anon;

revoke insert, update, delete on areas from anon, authenticated;

-- ───────────── Policy ─────────────

drop policy if exists "đọc cụm trường" on areas;
create policy "đọc cụm trường" on areas for select using (true);

drop policy if exists "đọc tên hiển thị" on profiles;
create policy "đọc tên hiển thị" on profiles for select using (true);
drop policy if exists "đổi tên của mình" on profiles;
create policy "đổi tên của mình" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "đọc quán đang hiện" on places;
create policy "đọc quán đang hiện" on places for select
  using (status = 'visible' or created_by = auth.uid());
drop policy if exists "đề xuất quán" on places;
create policy "đề xuất quán" on places for insert to authenticated
  with check (
    status = 'pending'
    and created_by = auth.uid()
    and suggested_by_name is null
    and (select count(*) from places p
         where p.created_by = auth.uid()
           and (p.created_at at time zone 'Asia/Ho_Chi_Minh')::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date) < 5
  );

drop policy if exists "đọc review đang hiện" on reviews;
create policy "đọc review đang hiện" on reviews for select
  using (status = 'visible' or user_id = auth.uid());
drop policy if exists "xóa review của mình" on reviews;
create policy "xóa review của mình" on reviews for delete to authenticated
  using (user_id = auth.uid());
-- Không có policy insert/update: thêm đánh giá chỉ qua submit_review.

drop policy if exists "đọc ảnh đang hiện" on photos;
create policy "đọc ảnh đang hiện" on photos for select
  using (status = 'visible' or user_id = auth.uid());
drop policy if exists "thêm ảnh cho review của mình" on photos;
create policy "thêm ảnh cho review của mình" on photos for insert to authenticated
  with check (
    user_id = auth.uid()
    and storage_path like auth.uid()::text || '/%'
    and exists (select 1 from reviews r where r.id = photos.review_id and r.user_id = auth.uid() and r.place_id = photos.place_id)
    and (select count(*) from photos p where p.review_id = photos.review_id) < 3
  );
drop policy if exists "xóa ảnh của mình" on photos;
create policy "xóa ảnh của mình" on photos for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "gửi báo cáo" on reports;
create policy "gửi báo cáo" on reports for insert to authenticated
  with check (user_id = auth.uid());

-- ───────────── View ─────────────
-- security_invoker: RLS của người gọi vẫn áp dụng. View chỉ trả số thô; ngưỡng "Mới" / "giá tham khảo" xử lý ở frontend.

drop view if exists places_public;
drop view if exists reviews_public;
drop view if exists place_stats;

create view place_stats with (security_invoker = true) as
select r.place_id,
  count(*)::int as review_count,
  round(avg(r.stars), 1) as avg_stars,
  count(r.price_paid)::int as price_count,
  round(percentile_cont(0.5)  within group (order by r.price_paid))::int as price_median,
  round(percentile_cont(0.25) within group (order by r.price_paid))::int as price_p25,
  round(percentile_cont(0.75) within group (order by r.price_paid))::int as price_p75,
  (select jsonb_agg(jsonb_build_object('name', t.name, 'n', t.n) order by t.n desc, t.name)
     from (select mode() within group (order by trim(d)) as name, count(*)::int as n
             from reviews r2, unnest(r2.dishes) d
            where r2.place_id = r.place_id and r2.status = 'visible' and not r2.is_sample
            group by lower(trim(d))
            order by n desc, name
            limit 3) t) as top_dishes
from reviews r
where r.status = 'visible' and not r.is_sample
group by r.place_id;

create view places_public with (security_invoker = true) as
select p.id, p.google_place_id, p.name, p.category, p.lat, p.lng, p.address, p.area_id,
  p.price_min, p.price_max, p.opening_hours, p.suggested_by_name,
  coalesce(s.review_count, 0) as review_count, s.avg_stars,
  coalesce(s.price_count, 0) as price_count, s.price_median, s.price_p25, s.price_p75,
  coalesce(s.top_dishes, '[]'::jsonb) as top_dishes,
  c.storage_path as cover_path, c.created_at as cover_at
from places p
left join place_stats s on s.place_id = p.id
left join lateral (
  select ph.storage_path, ph.created_at from photos ph
   where ph.place_id = p.id and ph.status = 'visible'
   order by ph.created_at desc limit 1
) c on true
where p.status = 'visible';

create view reviews_public with (security_invoker = true) as
select r.id, r.place_id, r.stars, r.price_paid, r.dishes, r.comment, r.is_sample, r.review_date, r.created_at,
  pr.display_name,
  (select count(*)::int from reviews r2
    where r2.user_id = r.user_id and r2.status = 'visible' and not r2.is_sample) as author_review_count
from reviews r
join profiles pr on pr.id = r.user_id
where r.status = 'visible';

grant select on place_stats, places_public, reviews_public to anon, authenticated;

-- ───────────── Hàm và trigger ─────────────

-- Đường duy nhất để thêm đánh giá. Tọa độ người dùng chỉ là tham số, không ghi vào bảng nào.
create or replace function submit_review(
  p_place_id bigint, p_lat double precision, p_lng double precision, p_accuracy_m double precision,
  p_stars int, p_price_paid int, p_dishes text[], p_comment text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_place places;
  v_dist double precision;
  v_id bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_place from places where id = p_place_id and status = 'visible';
  if not found then raise exception 'place_not_found'; end if;
  if p_accuracy_m is null or p_accuracy_m > 100 then raise exception 'gps_inaccurate'; end if;

  v_dist := 2 * 6371000 * asin(sqrt(
    sin(radians(v_place.lat - p_lat) / 2) ^ 2 +
    cos(radians(p_lat)) * cos(radians(v_place.lat)) * sin(radians(v_place.lng - p_lng) / 2) ^ 2));
  if v_dist - p_accuracy_m > 150 then raise exception 'too_far'; end if;

  if (select count(*) from reviews where user_id = v_uid
        and review_date = (now() at time zone 'Asia/Ho_Chi_Minh')::date) >= 10 then
    raise exception 'daily_limit';
  end if;
  -- link, tên miền, chuỗi từ 9 chữ số trở lên (số điện thoại)
  if p_comment ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|vn|net)\M|(\d[\s.-]?){9,})' then
    raise exception 'comment_has_contact';
  end if;
  -- ponytail: danh sách từ cấm viết thẳng trong hàm; sửa bằng create or replace. Chuyển thành bảng nếu cần người không biết SQL sửa.
  -- Ranh giới từ viết tay ([^[:alnum:]]) vì \m \M không nhận chữ có dấu khi database dùng locale C.
  if lower(p_comment) ~ '(^|[^[:alnum:]])(địt|đụ|đéo|lồn|cặc|buồi|đĩ|vcl|vkl|đm|dm|đmm|dmm|đcm|dcm|clm|cmm)([^[:alnum:]]|$)' then
    raise exception 'comment_banned_word';
  end if;

  insert into reviews (place_id, user_id, stars, price_paid, dishes, comment, checkin_distance_m)
  values (p_place_id, v_uid, p_stars, p_price_paid,
          array(select distinct left(trim(d), 40) from unnest(coalesce(p_dishes, '{}')) d where trim(d) <> ''),
          nullif(trim(p_comment), ''), round(v_dist))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'already_reviewed_today';
end $$;

revoke execute on function submit_review from public, anon;
grant execute on function submit_review to authenticated;

-- Tạo profile khi có tài khoản mới. Không lấy phần trước @ của email làm tên (lộ email).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text := left(trim(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 30);
begin
  if char_length(v_name) < 2 then
    v_name := 'Thực khách ' || lpad(floor(random() * 10000)::int::text, 4, '0');
  end if;
  insert into public.profiles (id, display_name) values (new.id, v_name) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Ảnh của người có dưới 2 đánh giá đang hiện (không tính review này) vào hàng chờ.
create or replace function set_photo_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.status := case
    when (select count(*) from reviews
           where user_id = new.user_id and status = 'visible' and not is_sample and id <> new.review_id) >= 2
    then 'visible' else 'pending' end;
  return new;
end $$;

drop trigger if exists set_photo_status on photos;
create trigger set_photo_status before insert on photos
  for each row execute function set_photo_status();

-- Đủ 3 người báo cáo thì tự ẩn. Khi nhóm khôi phục nội dung, xóa luôn các dòng reports của nó.
create or replace function auto_hide() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where target_type = new.target_type and target_id = new.target_id) >= 3 then
    if new.target_type = 'review' then
      update reviews set status = 'hidden' where id = new.target_id;
    else
      update photos set status = 'hidden' where id = new.target_id;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists auto_hide on reports;
create trigger auto_hide after insert on reports
  for each row execute function auto_hide();

-- Xóa tài khoản: cascade xóa profiles, reviews, photos, reports. File ảnh phải xóa trước qua Storage API.
create or replace function delete_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function delete_account from public, anon;
grant execute on function delete_account to authenticated;

-- ───────────── Storage ─────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "qq tải ảnh vào thư mục của mình" on storage.objects;
create policy "qq tải ảnh vào thư mục của mình" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "qq liệt kê ảnh của mình" on storage.objects;
create policy "qq liệt kê ảnh của mình" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "qq xóa ảnh của mình" on storage.objects;
create policy "qq xóa ảnh của mình" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
