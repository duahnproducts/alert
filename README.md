# Hometown

Bản đồ quán ăn ngon dưới 50k quanh trường, do sinh viên chấm điểm. Phải check-in GPS tại quán mới được đánh giá; giá là giá người ăn thật đã trả; ảnh là ảnh chụp tại quán.

Bài dự thi "From Idea to Impact" (CLB FPC). Thiết kế sản phẩm: [docs/quan-quen-thiet-ke.md](docs/quan-quen-thiet-ke.md). Phương án kỹ thuật: [docs/quan-quen-ky-thuat.md](docs/quan-quen-ky-thuat.md).

Bản chạy thật: https://duahnproducts.github.io/alert/

Không có server riêng: GitHub Pages phục vụ file tĩnh, Leaflet vẽ bản đồ, Supabase giữ dữ liệu, tài khoản và ảnh. Mọi quy tắc tin cậy (quyền, check-in 150 m, giới hạn đánh giá, hàng chờ ảnh, tự ẩn khi đủ 3 báo cáo) nằm trong [supabase/schema.sql](supabase/schema.sql).

## Chạy trên máy

Cần Node 20 trở lên.

```bash
npm install
cp .env.example .env.local   # rồi điền giá trị, xem mục "Biến môi trường"
npm run dev                  # http://localhost:5173
npm test                     # test hàm thuần trong src/util.js
npm run build                # ra thư mục dist/
```

Bản đồ không cần key nào: app tự vẽ kiểu chibi từ dữ liệu miễn phí của OpenFreeMap. Không tải được bản đồ thì app tự chuyển sang chế độ danh sách.

## Biến môi trường

| Biến | Lấy ở đâu |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Settings → API Keys (dạng `https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys, key `sb_publishable_…` |
| `VITE_SITE_URL` | Domain thật, không có `/` ở cuối. Dùng cho ảnh xem trước khi dán link vào Facebook |

Mọi biến `VITE_*` đều lộ ra trình duyệt. **Không bao giờ** đặt secret key (`sb_secret_…`) vào đây hay vào repo.

## Dựng Supabase

1. Tạo dự án. SQL Editor → dán toàn bộ `supabase/schema.sql` → Run. File chạy lại nhiều lần được, không mất dữ liệu.
2. Dán `supabase/test.sql` → Run. Phải thấy dòng `test.sql: tất cả phép thử đều đạt`. File tự rollback, không để lại dữ liệu.
3. **Auth → Providers:** bật Google (dán Client ID và secret từ Google Cloud), bật Email.
4. **Auth → URL Configuration:** Site URL là domain thật; Redirect URLs gồm domain thật và `http://localhost:5173`.
5. **Auth → Email Templates:** sửa cả mẫu **Magic Link** và **Confirm signup** để gửi mã thay cho link (người mới đăng ký nhận mẫu Confirm signup):
   ```html
   <h2>Mã đăng nhập Hometown</h2>
   <p>Mã của bạn là: <b style="font-size:24px">{{ .Token }}</b></p>
   <p>Gõ mã này vào app để đăng nhập. Mã hết hạn sau 1 giờ. Nếu bạn không yêu cầu, cứ bỏ qua email này.</p>
   ```
6. **Auth → SMTP Settings: bắt buộc** cấu hình SMTP riêng (Resend hoặc Brevo). SMTP mặc định của Supabase chỉ gửi tới thành viên nhóm, người dùng thật sẽ không nhận được mã. Sau đó vào **Auth → Rate Limits** nâng giới hạn gửi email cho khớp hạn mức nhà cung cấp, rồi gửi thử tới một Gmail và một Outlook ngoài nhóm (xem cả thư rác).
7. Bật xác thực 2 bước cho tài khoản của cả nhóm.

## Đăng nhập Google

Chỉ cần cho nút "Tiếp tục với Google", miễn phí, không cần thẻ. Chi tiết ở mục 5.1 phương án kỹ thuật. Tóm tắt: tạo dự án; OAuth consent screen loại External, scope `email` và `profile`, rồi **bấm Publish app** (để ở chế độ Testing thì người khác không đăng nhập được); OAuth Client ID (Web) với redirect URI `https://<ref>.supabase.co/auth/v1/callback`; dán Client ID và secret vào Supabase → Auth → Providers → Google.

## Nền bản đồ

Không cần làm gì. App dùng Leaflet và `protomaps-leaflet` để tự vẽ bản đồ kiểu chibi từ dữ liệu vector của OpenFreeMap (miễn phí, không key, không giới hạn lượt). Màu và nét vẽ nằm trong `PALETTE` và `rules()` ở `src/map.js`. Không dùng `openstreetmap.org`: máy chủ này không kết nối được từ mạng ở Việt Nam.

## Nhập dữ liệu

Cụm trường (SQL Editor):

```sql
insert into areas (name, center_lat, center_lng, radius_m) values
  ('ĐH Bách khoa', 21.0058, 105.8431, 1500);
```

Quán: điền Google Sheet, xuất CSV, rồi Table Editor → `places` → Insert → Import data from CSV. Các cột (bỏ cột `id`):

```text
name,category,lat,lng,address,area_id,price_min,price_max,opening_hours,google_place_id,suggested_by_name,status
```

- `category`: một trong `bun_pho_mi`, `com`, `banh_mi_xoi`, `an_vat`, `do_uong`, `ca_phe`, `che`.
- `price_min`, `price_max`: đồng, vd `30000`.
- `opening_hours`: JSON, khóa là thứ (`"0"` là Chủ nhật) hoặc `"all"`; mảng rỗng là nghỉ; khung qua đêm ghi giờ đóng nhỏ hơn giờ mở. Vd `{"all":[["06:30","13:30"],["17:00","21:00"]],"0":[]}`.
- `google_place_id`: lấy bằng Place ID Finder của Google. Để trống thì link "Chỉ đường" và "Xem đánh giá trên Google Maps" dùng tọa độ thay cho `place_id`.
- `status`: `visible` để hiện ngay.

Đánh giá và ảnh: nhóm gửi qua chính app khi đến ăn. Đánh giá mẫu tạo trong Table Editor với `is_sample = true`, và xóa trước ngày 11/10 bằng `delete from reviews where is_sample;`.

## Bản demo

Chưa khai `VITE_SUPABASE_URL` thì app chạy **bản demo có nhãn**: quán tên tự đặt và đánh giá mẫu lấy từ `public/demo.json`, đầu trang có dải "Bản demo", mỗi đánh giá có nhãn "Mẫu", giá ghi "Giá mẫu". Đăng nhập và viết đánh giá tắt. Muốn đổi nội dung demo thì sửa và chạy:

```bash
node scripts/demo-data.mjs
```

Nối Supabase (khai biến ở GitHub) là app tự chuyển sang dữ liệu thật.

## Địa danh nổi tiếng

Các địa danh của Hà Nội và TP. Hồ Chí Minh nằm trong `public/landmarks.json`, lấy từ Wikidata, Wikipedia tiếng Việt và Wikimedia Commons (ảnh thật, có tên tác giả và giấy phép). Muốn cập nhật, thêm thành phố hoặc đổi số lượng, sửa `CITIES` / `PER_CITY` trong `scripts/landmarks.mjs` rồi chạy:

```bash
node scripts/landmarks.mjs
```

## Duyệt nội dung (12:00 và 21:00)

Lưu 3 truy vấn này trong SQL Editor. Duyệt bằng cách sửa ô `status` trong Table Editor.

```sql
-- 1. Quán chờ duyệt
select id, name, category, lat, lng, address, created_at from places where status = 'pending' order by created_at;

-- 2. Ảnh chờ duyệt (thay <ref> bằng mã dự án)
select id, place_id, review_id, created_at,
       'https://<ref>.supabase.co/storage/v1/object/public/photos/' || storage_path as xem
from photos where status = 'pending' order by created_at;

-- 3. Nội dung bị ẩn do báo cáo
select r.target_type, r.target_id, count(*) as so_bao_cao, string_agg(r.reason, ' | ') as ly_do
from reports r
left join reviews v on r.target_type = 'review' and v.id = r.target_id
left join photos p on r.target_type = 'photo' and p.id = r.target_id
where coalesce(v.status, p.status) = 'hidden'
group by 1, 2;
```

Khôi phục một nội dung bị ẩn tự động thì xóa luôn báo cáo của nó, nếu không báo cáo tiếp theo sẽ ẩn lại ngay:

```sql
update reviews set status = 'visible' where id = 123;
delete from reports where target_type = 'review' and target_id = 123;
```

## Deploy

- **GitHub Pages:** Settings → Pages → Source: GitHub Actions (đã bật). Workflow `.github/workflows/pages.yml` tự build và deploy mỗi khi push vào nhánh mặc định của repo, ra https://duahnproducts.github.io/alert/. Khai 2 biến ở Settings → Secrets and variables → Actions → **Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (`VITE_SITE_URL` workflow tự điền). Chưa khai thì app vẫn mở được: bản đồ và địa danh chạy, danh sách quán báo không tải được.
- **Supabase Auth → URL Configuration:** Site URL và Redirect URLs gồm `https://duahnproducts.github.io/alert/` và `http://localhost:5173`.
- **Đường dẫn:** app chạy dưới `/alert/`, nên trong code mọi đường dẫn đều tương đối theo thẻ `<base>` trong `index.html`. GitHub Pages không có rewrite, nên workflow chép `index.html` thành `404.html` để link sâu như `/alert/quan/12` vẫn mở được app.
- **Sao lưu:** thêm 2 secret `SUPABASE_DB_URL` (Supabase → Connect → Session pooler) và `BACKUP_PASSPHRASE` (mật khẩu tự đặt). Workflow `.github/workflows/backup.yml` chạy mỗi đêm, mã hóa bản sao bằng gpg (repo công khai nên ai cũng tải được artifact), giữ 14 ngày, và giữ dự án Supabase miễn phí không bị tạm dừng. Giải mã: `gpg -d data.sql.gpg > data.sql`.
- **UptimeRobot:** 2 monitor 5 phút: trang chủ, và `https://<ref>.supabase.co/rest/v1/areas?select=id&limit=1&apikey=<publishable key>` (chạy thử bằng `curl` trước, phải ra mã 200).

## Trước khi nộp

- [ ] Sửa các chỗ ghi `CẦN ĐIỀN` trong `index.html`: link bài dự thi trên fanpage (menu), tên thành viên, link fanpage, email liên hệ (trang Về dự án).
- [ ] Xóa đánh giá mẫu, chạy lại `test.sql`, chạy tay workflow sao lưu một lần.
- [ ] Lighthouse mobile từ 90 ở cả 4 mục; chạy hết ma trận thiết bị ở mục 11 bản thiết kế.

## Cấu trúc

```text
index.html            khung trang, thẻ Open Graph, nội dung trang Về dự án và chính sách quyền riêng tư
src/main.js           router, trạng thái, bộ lọc, ngăn kéo danh sách, thẻ xem nhanh
src/map.js            file duy nhất biết đến thư viện bản đồ; kiểu chibi (màu, nét đường, chữ) nằm ở đây
src/place.js          trang quán, link Google Maps, ảnh, báo cáo
src/review.js         check-in, nén ảnh, gửi đánh giá, đề xuất quán
src/auth.js           đăng nhập Google và mã email, trình duyệt trong Facebook/Zalo, trang Của tôi
src/supabase.js       client và mọi truy vấn
src/util.js           hàm thuần (giờ mở cửa, khoảng cách, tìm không dấu…) + test
supabase/schema.sql   bảng, view, RLS, hàm, trigger, bucket ảnh
supabase/test.sql     kiểm tra RLS, place_stats và các hàm
public/icons/         bộ icon tự vẽ (SVG): 7 biểu tượng món, 17 biểu tượng địa danh, 4 biểu cảm Bao; avatar app-*.png (Bao)
public/manifest.webmanifest  tên và icon khi thêm app ra màn hình chính
public/covers/        7 tranh minh họa quán theo loại món, làm ảnh bìa khi quán chưa có ảnh thật
public/og.png         ảnh xem trước khi dán link
public/landmarks.json địa danh nổi tiếng kèm ảnh thật (tạo bằng scripts/landmarks.mjs)
```
