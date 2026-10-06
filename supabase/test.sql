-- Kiểm tra RLS, view place_stats và các hàm. Chạy trong SQL Editor của Supabase sau schema.sql.
-- Mọi thứ nằm trong một transaction và rollback ở cuối, nên không để lại dữ liệu.
-- Một assert sai là dừng ngay và báo lỗi kèm tên phép thử. Chạy hết không lỗi là đạt.

begin;

-- ── Dữ liệu giả: 3 người, 1 quán ──
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"full_name":"Người A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local', '{}');

do $$ begin
  assert (select display_name from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Người A',
    'handle_new_user: lấy tên từ Google';
  assert (select display_name from profiles where id = '00000000-0000-0000-0000-00000000000b') ~ '^Thực khách \d{4}$',
    'handle_new_user: tên mặc định không lấy từ email';
end $$;

with p as (
  insert into places (name, category, lat, lng, status)
  values ('Quán thử', 'bun_pho_mi', 21.0, 105.8, 'visible') returning id
) select set_config('qq.place', id::text, true) from p;

-- A có 4 đánh giá đang hiện (giá 20k, 30k, 40k, 100k), 1 đánh giá mẫu và 1 đánh giá bị ẩn (không được tính)
insert into reviews (place_id, user_id, stars, price_paid, dishes, checkin_distance_m, review_date, is_sample, status)
select current_setting('qq.place')::bigint, '00000000-0000-0000-0000-00000000000a', v.stars, v.price, v.dishes, 10,
       current_date - v.ago, v.sample, v.status
from (values
  (5,  20000, '{"Bún chả","Nem"}'::text[], 1, false, 'visible'),
  (4,  30000, '{" bún chả ","Nem"}',       2, false, 'visible'),
  (4,  40000, '{"Bún chả","Trà đá"}',      3, false, 'visible'),
  (3, 100000, '{}',                        4, false, 'visible'),
  (1, 500000, '{"Phở"}',                   5, true,  'visible'),
  (1,   1000, '{"Phở","Phở bò"}',          6, false, 'hidden')
) v(stars, price, dishes, ago, sample, status);

-- ── place_stats ──
do $$ declare s place_stats; begin
  select * into s from place_stats where place_id = current_setting('qq.place')::bigint;
  assert s.review_count = 4, 'place_stats: bỏ qua đánh giá mẫu và bị ẩn, được ' || s.review_count;
  assert s.avg_stars = 4.0, 'place_stats: điểm trung bình, được ' || s.avg_stars;
  assert s.price_count = 4, 'place_stats: số lượt báo giá';
  assert s.price_median = 35000, 'place_stats: trung vị, được ' || s.price_median;
  assert s.price_p25 = 27500, 'place_stats: phân vị 25, được ' || s.price_p25;
  assert s.price_p75 = 55000, 'place_stats: phân vị 75, được ' || s.price_p75;
  assert s.top_dishes = '[{"n":3,"name":"Bún chả"},{"n":2,"name":"Nem"},{"n":1,"name":"Trà đá"}]'::jsonb,
    'place_stats: món được nhắc nhiều, được ' || s.top_dishes;
end $$;

-- ── Người dùng B ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

do $$ declare n int; begin
  delete from reviews where user_id = '00000000-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  assert n = 0, 'RLS: B không được xóa đánh giá của A';
end $$;

do $$ begin
  perform checkin_distance_m from reviews limit 1;
  assert false, 'quyền theo cột: không được đọc checkin_distance_m';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into reviews (place_id, user_id, stars, checkin_distance_m)
  values (current_setting('qq.place')::bigint, auth.uid(), 5, 0);
  assert false, 'RLS: không được ghi thẳng vào reviews';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  perform submit_review(current_setting('qq.place')::bigint, 21.01, 105.8, 10, 5, 30000, '{}', null); -- cách ~1,1 km
  assert false, 'submit_review: phải từ chối khi ở xa';
exception when raise_exception then assert sqlerrm = 'too_far', 'submit_review: mong too_far, được ' || sqlerrm;
end $$;

do $$ begin
  perform submit_review(current_setting('qq.place')::bigint, 21.0003, 105.8, 150, 5, 30000, '{}', null);
  assert false, 'submit_review: phải từ chối khi sai số GPS trên 100 m';
exception when raise_exception then assert sqlerrm = 'gps_inaccurate', 'mong gps_inaccurate, được ' || sqlerrm;
end $$;

do $$ begin
  perform submit_review(current_setting('qq.place')::bigint, 21.0003, 105.8, 10, 5, 30000, '{}', 'Gọi 0912 345 678 nhé');
  assert false, 'submit_review: phải chặn số điện thoại';
exception when raise_exception then assert sqlerrm = 'comment_has_contact', 'mong comment_has_contact, được ' || sqlerrm;
end $$;

do $$ begin
  perform submit_review(current_setting('qq.place')::bigint, 21.0003, 105.8, 10, 5, 30000, '{}', 'Ngon vcl');
  assert false, 'submit_review: phải chặn từ tục';
exception when raise_exception then assert sqlerrm = 'comment_banned_word', 'mong comment_banned_word, được ' || sqlerrm;
end $$;

-- Cách ~33 m: gửi được. Không có cột nào lưu tọa độ.
select set_config('qq.rid_b',
  submit_review(current_setting('qq.place')::bigint, 21.0003, 105.8, 10, 5, 30000, '{"Bún chả"," "}', ' Ngon, ăn lồng chim cũng được ')::text, true);

do $$ begin
  assert (select comment from reviews where id = current_setting('qq.rid_b')::bigint) = 'Ngon, ăn lồng chim cũng được',
    'submit_review: không chặn nhầm từ có chứa từ cấm ("lồng")';
  assert (select dishes from reviews where id = current_setting('qq.rid_b')::bigint) = '{"Bún chả"}',
    'submit_review: bỏ món rỗng';
  perform submit_review(current_setting('qq.place')::bigint, 21.0003, 105.8, 10, 4, 30000, '{}', null);
  assert false, 'submit_review: chỉ 1 đánh giá mỗi quán mỗi ngày';
exception when raise_exception then
  assert sqlerrm = 'already_reviewed_today', 'mong already_reviewed_today, được ' || sqlerrm;
end $$;

-- Ảnh của B (chưa có 2 đánh giá đang hiện trước đó) vào hàng chờ; tối đa 3 ảnh mỗi đánh giá
insert into photos (review_id, place_id, storage_path)
select current_setting('qq.rid_b')::bigint, current_setting('qq.place')::bigint,
       '00000000-0000-0000-0000-00000000000b/' || current_setting('qq.rid_b') || '/' || n || '.webp'
from generate_series(1, 3) n;

do $$ begin
  assert (select bool_and(status = 'pending') from photos where review_id = current_setting('qq.rid_b')::bigint),
    'set_photo_status: ảnh tài khoản mới phải chờ duyệt';
  insert into photos (review_id, place_id, storage_path)
  values (current_setting('qq.rid_b')::bigint, current_setting('qq.place')::bigint,
          '00000000-0000-0000-0000-00000000000b/' || current_setting('qq.rid_b') || '/4.webp');
  assert false, 'RLS: tối đa 3 ảnh mỗi đánh giá';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  insert into photos (review_id, place_id, storage_path)
  values (current_setting('qq.rid_b')::bigint, current_setting('qq.place')::bigint, 'nguoi-khac/1.webp');
  assert false, 'RLS: ảnh phải nằm trong thư mục của mình';
exception when insufficient_privilege then null;
end $$;

-- Đề xuất quán: status do database đặt, tối đa 5 mỗi ngày
do $$ begin
  insert into places (name, category, lat, lng, status) values ('Quán gian', 'com', 21, 105.8, 'visible');
  assert false, 'quyền theo cột: không được tự đặt status cho quán';
exception when insufficient_privilege then null;
end $$;

insert into places (name, category, lat, lng)
select 'Đề xuất ' || n, 'com', 21, 105.8 from generate_series(1, 5) n;

do $$ begin
  assert (select count(*) from places where created_by = auth.uid() and status = 'pending') = 5,
    'đề xuất quán: vào trạng thái chờ duyệt, người đề xuất vẫn thấy';
  insert into places (name, category, lat, lng) values ('Đề xuất 6', 'com', 21, 105.8);
  assert false, 'RLS: tối đa 5 đề xuất mỗi ngày';
exception when insufficient_privilege then null;
end $$;

do $$ begin
  update profiles set display_name = 'Bê đổi tên' where id = '00000000-0000-0000-0000-00000000000a';
  assert (select display_name from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Người A',
    'RLS: B không được đổi tên của A';
end $$;

-- ── Ẩn khi đủ 3 người báo cáo ──
insert into reports (target_type, target_id, reason) values ('review', current_setting('qq.rid_b')::bigint, 'thử');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into reports (target_type, target_id, reason) values ('review', current_setting('qq.rid_b')::bigint, 'thử');

do $$ begin
  assert (select count(*) from reviews_public where id = current_setting('qq.rid_b')::bigint) = 1,
    'auto_hide: 2 báo cáo thì chưa ẩn';
end $$;

-- Ảnh của A (đã có 4 đánh giá đang hiện) lên ngay
insert into photos (review_id, place_id, storage_path)
select id, place_id, '00000000-0000-0000-0000-00000000000a/' || id || '/1.webp'
from reviews where user_id = auth.uid() and price_paid = 20000;

do $$ begin
  assert (select status from photos where storage_path like '00000000-0000-0000-0000-00000000000a/%') = 'visible',
    'set_photo_status: người đã có từ 2 đánh giá đang hiện thì ảnh lên ngay';
  assert (select cover_path from places_public where id = current_setting('qq.place')::bigint) like '00000000-0000-0000-0000-00000000000a/%',
    'places_public: ảnh bìa là ảnh đang hiện mới nhất (không lấy ảnh chờ duyệt)';
end $$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
insert into reports (target_type, target_id, reason) values ('review', current_setting('qq.rid_b')::bigint, 'thử');

do $$ begin
  assert (select count(*) from reviews_public where id = current_setting('qq.rid_b')::bigint) = 0,
    'auto_hide: đủ 3 báo cáo thì ẩn';
  perform * from reports;
  assert false, 'RLS: không ai đọc được bảng reports';
exception when insufficient_privilege then null;
end $$;

-- ── Khách chưa đăng nhập ──
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  assert (select count(*) from places_public) >= 1, 'anon đọc được quán đang hiện';
  assert (select count(*) from places where status = 'pending') = 0, 'anon không thấy quán chờ duyệt';
  assert (select author_review_count from reviews_public where price_paid = 20000) = 4,
    'reviews_public: số đánh giá của người viết (để tính huy hiệu)';
  perform submit_review(current_setting('qq.place')::bigint, 21.0, 105.8, 10, 5, 30000, '{}', null);
  assert false, 'anon không được gọi submit_review';
exception when insufficient_privilege then null;
end $$;

-- ── Xóa tài khoản: cascade xóa mọi thứ của người đó ──
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select delete_account();
reset role;

do $$ begin
  assert not exists (select 1 from profiles where id = '00000000-0000-0000-0000-00000000000b'), 'delete_account: xóa profile';
  assert not exists (select 1 from reviews where user_id = '00000000-0000-0000-0000-00000000000b'), 'delete_account: xóa đánh giá';
  assert not exists (select 1 from photos where user_id = '00000000-0000-0000-0000-00000000000b'), 'delete_account: xóa ảnh';
  assert (select created_by from places where name = 'Đề xuất 1') is null, 'delete_account: quán đã đề xuất vẫn giữ';
  raise notice 'test.sql: tất cả phép thử đều đạt';
end $$;

rollback;
