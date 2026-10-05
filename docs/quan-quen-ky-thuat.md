# Quán Quen: Phương án kỹ thuật

Viết ngày 05/10/2026, dựa trên [Quán Quen: Thiết kế sản phẩm](quan-quen-thiet-ke.md) (gọi tắt là "bản thiết kế", trích theo số mục). Tài liệu này trả lời câu "làm bằng gì, cụ thể ra sao" để nhóm 3 người code được ngay từ 06/10. Chỗ nào khác hoặc chi tiết hơn bản thiết kế đều được ghi rõ ở mục 10.

**Giả định.** Bản thiết kế đã đánh dấu xong hai câu hỏi mở nhưng chưa ghi câu trả lời. Tài liệu này giả định: (1) nhóm có thẻ, dùng **Google Maps**; (2) dùng **JavaScript thuần**. Nếu khác, xem mục 11 (phương án Leaflet). Nếu nhóm quen React thì chỉ đổi mục 3, mọi phần khác giữ nguyên.

## 1. Tóm tắt quyết định

| Lớp | Chọn | Ghi chú |
| --- | --- | --- |
| Frontend | Vite + JavaScript thuần, ES modules | Build ra file tĩnh; không framework, không thư viện UI |
| Phụ thuộc chạy trên trình duyệt | `@supabase/supabase-js`, `@googlemaps/markerclusterer` | Chỉ hai gói. Maps JS nạp bằng đoạn bootstrap chính thức của Google, không cần gói loader |
| Điều hướng | History API (`/quan/12`), Vercel rewrite về `index.html` | Link chia sẻ đẹp, không đụng hash của OAuth |
| Bản đồ | Maps JS API, `AdvancedMarkerElement`, Map ID có phong cách sáng/tối | Ẩn POI bằng phong cách trên cloud |
| Điểm Google | `Place.fetchFields(['rating','userRatingCount','googleMapsURI'])` | Gọi từ trình duyệt, không lưu |
| Dữ liệu | Supabase Postgres, 6 bảng + 3 view + 4 hàm | Mọi quy tắc tin cậy nằm trong database |
| Tài khoản | Supabase Auth: Google OAuth (PKCE) và mã 6 số qua email | **Bắt buộc** SMTP riêng (mục 5.4) |
| Ảnh | Nén trên máy bằng canvas, 2 cỡ (1280 px và 400 px), WebP hoặc JPEG | Supabase Storage, bucket công khai |
| Hosting | Vercel Hobby, tự deploy từ nhánh `main` | |
| Giám sát, sao lưu | UptimeRobot + một GitHub Action chạy mỗi đêm | Action vừa sao lưu dữ liệu vừa giữ Supabase không bị tạm dừng |
| Kiểm thử | `node --test` cho hàm thuần, `supabase/test.sql` cho RLS và view | Không dùng framework test |

Nguyên tắc xuyên suốt: **frontend chỉ hiển thị, database quyết định.** Ai sửa được gì, check-in có hợp lệ không, ảnh có phải chờ duyệt không, đều do Postgres (RLS, hàm, trigger) quyết định. Người dùng có anon key (công khai theo thiết kế của Supabase) cũng không vượt qua được.

## 2. Kiến trúc

```text
Điện thoại (Chrome, Safari, trình duyệt trong Facebook/Zalo)
  └─ Web app tĩnh (Vite build, ~6 file JS)
       ├─ HTML/JS/CSS ───────────────> Vercel (CDN, rewrite mọi đường dẫn về index.html)
       ├─ Maps JS + Places ──────────> Google Maps Platform (key khóa theo domain, giới hạn lượt/ngày)
       ├─ REST/RPC (anon key + JWT) ─> Supabase PostgREST ──> Postgres (RLS, view, submit_review, trigger)
       ├─ Đăng nhập ─────────────────> Supabase Auth ──> Google OAuth / SMTP riêng (Resend hoặc Brevo)
       └─ Tải ảnh lên/xuống ─────────> Supabase Storage (bucket "photos", thư mục theo user_id)

Công cụ phụ:  GitHub ──push──> Vercel        GitHub Action (mỗi đêm) ──pg_dump──> artifact sao lưu
              UptimeRobot ──5 phút──> trang web + một truy vấn đọc Supabase
```

Không có server nào của nhóm. Thứ cần vận hành trong mùa thi chỉ là duyệt nội dung trong Table Editor của Supabase.

## 3. Frontend

### 3.1 Cấu trúc thư mục

```text
quan-quen/
  index.html            khung trang, thẻ Open Graph, preconnect font
  vercel.json           rewrite + header bảo mật
  package.json          scripts: dev, build, test
  .env.local            (không commit) VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_GMAPS_KEY, VITE_GMAPS_MAP_ID
  src/
    main.js             router, trạng thái chung, bộ lọc, chế độ danh sách, ngăn kéo
    map.js              nạp Maps JS, ghim, gom cụm, chuyển sang danh sách khi lỗi
    place.js            trang quán, điểm Google, lưới ảnh, báo cáo
    review.js           check-in, nén ảnh, gửi đánh giá, đề xuất quán
    auth.js             tấm đăng nhập, phát hiện trình duyệt trong app, trang Của tôi
    supabase.js         client và mọi truy vấn
    util.js             hàm thuần: isOpenNow, distanceM, normalizeVi, formatPrice, isInAppBrowser
    util.test.js        test cho util.js (node --test)
    style.css
  public/
    icons/              7 biểu tượng món + 4 biểu cảm Bé Bao (SVG)
    og.png              ảnh xem trước 1200×630 khi dán link
  supabase/
    schema.sql          bảng, view, RLS, hàm, trigger, bucket (chạy lại được từ đầu)
    test.sql            kiểm tra RLS và place_stats
  .github/workflows/backup.yml
```

`map.js` là file duy nhất biết đến Google Maps. Nếu phải đổi sang Leaflet thì chỉ viết lại file này.

### 3.2 Điều hướng

| Đường dẫn | Màn | Cần đăng nhập |
| --- | --- | --- |
| `/` | Bản đồ (có `?khu=2` để chọn cụm trường) | Không |
| `/quan/:id` | Chi tiết quán | Không |
| `/quan/:id/danh-gia` | Viết đánh giá | Có |
| `/de-xuat` | Đề xuất quán | Có |
| `/cua-toi` | Của tôi | Có |
| `/gioi-thieu` | Về dự án, chính sách quyền riêng tư | Không |

Router khoảng 30 dòng trong `main.js`: một mảng `[regex, hàm render]`, `history.pushState` khi bấm link nội bộ, nghe sự kiện `popstate`. `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{ "source": "/(.*)", "headers": [
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "X-Content-Type-Options", "value": "nosniff" }
  ]}]
}
```

Vercel ưu tiên file tĩnh có thật trước khi rewrite, nên `/assets/*` và `/icons/*` vẫn được phục vụ bình thường. `Referrer-Policy` không được đặt thành `no-referrer`, vì key Google kiểm tra domain qua header Referer.

### 3.3 Tải và lọc dữ liệu

- Khi mở app: đọc bản lưu `localStorage['qq:places:v1']` (nếu có) và vẽ ngay, rồi gọi `places_public` (mục 4.3) một lần để lấy bản mới, khoảng 30 KB cho 50 quán. Lấy được thì lưu lại kèm `savedAt`. Không lấy được thì giữ bản cũ và hiện dòng "Dữ liệu lưu lúc 20:15". Không có cả hai thì hiện Bé Bao buồn và nút thử lại.
- Mọi bộ lọc chạy trên mảng trong bộ nhớ: cụm trường (`area_id`), giá (dùng `price_median` nếu `price_count >= 3`, nếu không thì dùng `price_max`), loại món, "đang mở".
- Ô tìm kiếm so khớp không dấu trên tên quán, món được nhắc nhiều và tên loại món. Gõ "bun cha" vẫn ra "Bún chả":

```js
export const normalizeVi = s =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
```

- Khoảng cách: công thức haversine trong `util.js`, chỉ tính khi người dùng đã bấm "Vị trí của tôi". Nếu chưa có vị trí thì dùng tâm cụm trường đang chọn.

### 3.4 Giờ mở cửa

`places.opening_hours` là JSON, khóa là thứ theo `Date.getDay()` của JS (`"0"` là Chủ nhật), hoặc `"all"` nếu ngày nào cũng giống nhau. Mảng rỗng nghĩa là nghỉ ngày đó. Khung qua đêm ghi giờ đóng nhỏ hơn giờ mở.

```json
{ "all": [["06:30", "13:30"], ["17:00", "21:00"]], "0": [] }
```

```js
export function isOpenNow(hours, now = new Date()) {
  if (!hours) return null // không rõ giờ: không lọc, không hiện "Đang mở"
  const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
  const day = vn.getDay(), m = vn.getHours() * 60 + vn.getMinutes()
  const ranges = d => hours[d] ?? hours.all ?? []
  const min = t => +t.slice(0, 2) * 60 + +t.slice(3)
  for (const [a, b] of ranges(day)) {
    const s = min(a), e = min(b)
    if (e > s ? m >= s && m < e : m >= s) return true
  }
  for (const [a, b] of ranges((day + 6) % 7)) { // phần sau nửa đêm của khung hôm qua
    if (min(b) <= min(a) && m < min(b)) return true
  }
  return false
}
```

Trong Google Sheet, nhóm gõ JSON vào một ô. Khi xuất CSV, Sheets tự thêm dấu ngoặc kép đúng chuẩn để Supabase nhập được.

### 3.5 Bản đồ (`map.js`)

- Nạp Maps JS bằng [đoạn bootstrap `importLibrary`](https://developers.google.com/maps/documentation/javascript/load-maps-js-api) dán vào `index.html`, chỉ gọi sau khi khung trang và danh sách đã vẽ xong. Bản đồ là thứ nặng nhất, không được chặn lần vẽ đầu.
- Tùy chọn bản đồ: `mapId`, `colorScheme: FOLLOW_SYSTEM` (dùng phong cách tối đã cấu hình cùng Map ID), `disableDefaultUI: true`, `zoomControl: true`, `clickableIcons: false`, `gestureHandling: 'greedy'` (một ngón tay kéo được bản đồ toàn màn hình).
- Mỗi quán là một `AdvancedMarkerElement`. `content` là một `div` dựng từ SVG ghim và biểu tượng món, có `title` là nhãn đọc màn hình ("Bún chả Hương, 35 nghìn, 4,6 sao, cách 300 mét"). Vương miện, trạng thái mờ và mặt trăng là class CSS. Hiệu ứng nảy dùng `@keyframes` và bị tắt trong `@media (prefers-reduced-motion: reduce)`.
- Gom cụm: `MarkerClusterer` với `renderer` tự viết, trả về một marker tròn màu kem có số quán và biểu tượng loại món nhiều nhất trong cụm.
- Khi lọc: gọi `clusterer.clearMarkers()` rồi `addMarkers(lọc)`, không tạo lại marker.
- **Chuyển sang danh sách khi lỗi:** gán `window.gm_authFailure` (Google gọi hàm này khi key sai hoặc domain bị chặn), bắt lỗi của `importLibrary`, và đặt hẹn giờ 8 giây cho sự kiện `tilesloaded`. Gặp một trong ba trường hợp thì chuyển hẳn sang chế độ danh sách, kèm dòng "Bản đồ đang nghỉ, xem danh sách nhé".

### 3.6 Trang quán (`place.js`)

- Dữ liệu chính lấy từ mảng đã tải. Chỉ đánh giá và ảnh cần gọi thêm: `reviews_public` và `photos` theo `place_id`, 20 dòng mới nhất.
- Điểm Google:

```js
const { Place } = await google.maps.importLibrary('places')
const p = new Place({ id: place.google_place_id })
await p.fetchFields({ fields: ['rating', 'userRatingCount', 'googleMapsURI'] })
```

  Kết quả chỉ giữ trong một biến `Map` của tab đang mở, không ghi vào `localStorage`, cho đúng điều khoản. Lỗi hoặc hết hạn mức thì ẩn dòng điểm Google, thay bằng link `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=<place_id>`. Dòng điểm có chữ "Google" làm ghi nguồn.
- Chỉ đường: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&destination_place_id=<place_id>`.
- Chia sẻ: `navigator.share({ title, url })`, nếu trình duyệt không có thì sao chép link bằng `navigator.clipboard.writeText` và hiện thông báo "Đã chép link".
- Ảnh: `<img loading="lazy" decoding="async" width height alt>`. Lưới ảnh dùng bản 400 px, bấm vào mới mở bản 1280 px.
- Báo cáo: dùng `<dialog>` có sẵn của trình duyệt, chọn lý do, rồi `insert` vào `reports`.

### 3.7 Viết đánh giá (`review.js`)

1. **Check-in:** `navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })`. Nếu `accuracy > 100` thì báo "Ra chỗ thoáng hơn rồi thử lại nhé". Màn "Bạn đang ở quán" chỉ là gợi ý trên máy (dùng `distanceM`). Kiểm tra thật nằm trong `submit_review`.
2. **Gửi:** `supabase.rpc('submit_review', {...})` nhận về `review_id`. Lỗi từ hàm là một mã ngắn (`too_far`, `already_reviewed_today`, `daily_limit`, `comment_has_contact`, ...), `review.js` đổi mã đó thành câu tiếng Việt.
3. **Ảnh** (sau khi có `review_id`): mỗi ảnh nén thành 2 file, tải lên `<user_id>/<review_id>/<n>.webp` và `<n>_t.webp` với `cacheControl: '31536000'` (đường dẫn không bao giờ đổi), rồi `insert` một dòng vào `photos`. Một ảnh lỗi không làm hỏng đánh giá đã gửi; app báo "1 ảnh chưa lên được" và cho thử lại.

```js
export async function compress(file, maxEdge) {
  if (!file.type.startsWith('image/') || file.size > 10e6) throw new Error('bad_image')
  const bmp = await createImageBitmap(file) // trình duyệt hiện đại tự xoay theo EXIF
  const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const toBlob = type => new Promise(r => c.toBlob(r, type, 0.8))
  let blob = await toBlob('image/webp')
  if (blob.type !== 'image/webp') blob = await toBlob('image/jpeg') // Safari có thể chưa xuất được WebP
  return { blob, width: c.width, height: c.height } // vẽ lại qua canvas nên EXIF (có GPS) đã mất
}
```

Ảnh xem trong trang dùng bản 400 px (khoảng 30 KB) vì Supabase Storage không resize ảnh ở gói miễn phí.

**Đề xuất quán:** form gồm tên, ghim kéo được trên bản đồ (dùng `gmpDraggable` của AdvancedMarker), loại món, khoảng giá. `insert` vào `places`; RLS ép `status = 'pending'`.

### 3.8 Đăng nhập (`auth.js`)

```js
export const isInAppBrowser = ua => /FBAN|FBAV|FB_IAB|Instagram|Zalo/i.test(ua)
```

- Tấm đăng nhập là một `<dialog>`. Trong trình duyệt của Facebook hoặc Zalo thì ẩn nút Google, đưa lựa chọn email lên đầu, thêm nút "Sao chép link để mở bằng Chrome/Safari".
- Google: `signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })`. Trước khi chuyển trang, lưu đường dẫn đang làm vào `sessionStorage['qq:afterLogin']`; quay về thì đọc ra và điều hướng tiếp.
- Email: `signInWithOtp({ email })`, rồi `verifyOtp({ email, token, type: 'email' })`. Không rời trang.
- Client tạo với `auth: { flowType: 'pkce' }`. Sau khi đăng nhập, Supabase trả về `?code=` trên URL thay cho token trong hash, nên router không phải xử lý trường hợp đặc biệt.
- **Xóa tài khoản:** gọi `storage.from('photos').list(uid)` rồi `remove(...)` để xóa file, sau đó gọi `rpc('delete_account')`. Phải xóa file trước, vì cascade trong database không xóa được file trong Storage.

### 3.9 Hiệu năng (mục tiêu Lighthouse ≥ 90)

| Việc | Lý do |
| --- | --- |
| Vẽ khung trang, bộ lọc và danh sách từ dữ liệu đã lưu trước, nạp Maps JS sau | Maps JS là phần nặng nhất và nằm ngoài tầm kiểm soát; không để nó quyết định LCP |
| Be Vietnam Pro qua Google Fonts với `display=swap`, `preconnect` tới `fonts.gstatic.com`, chỉ 3 độ đậm | Tránh chữ trống khi tải |
| Tất cả `<img>` có `width`, `height`, `loading="lazy"` | Không bị CLS, không tải ảnh chưa cuộn tới |
| Ngân sách: JS + CSS của app dưới 150 KB (supabase-js khoảng 45 KB nén) | Kiểm bằng `vite build`, Vite in kích thước từng file |
| Icon là SVG trong `public/`, linh vật dưới 10 KB mỗi file | |

Chạy Lighthouse ngay ngày 07/10 trên bản deploy đầu tiên, không đợi đến 11/10. Nếu Maps JS kéo điểm Performance xuống dưới 90, cách xử lý là chỉ nạp bản đồ khi người dùng chạm vào vùng bản đồ hoặc sau `requestIdleCallback`.

### 3.10 Trợ năng và giao diện

- Biến CSS trên `:root` cho màu của bản thiết kế, đổi sang màu tối trong `@media (prefers-color-scheme: dark)`.
- Ngăn kéo và tấm đăng nhập dùng `<dialog>` để có sẵn bẫy focus và phím Esc.
- Chế độ danh sách là HTML thuần (`<ul>` các `<a href="/quan/12">`), có đủ thông tin như ghim trên bản đồ.
- **Không bao giờ dùng `innerHTML` với dữ liệu người dùng** (tên, nhận xét, món). Luôn gán qua `textContent`. Đây là lớp chặn XSS chính.

## 4. Database (Supabase)

Toàn bộ nằm trong `supabase/schema.sql`, chạy trong SQL Editor. Dưới đây là phần cốt lõi; file thật cần thêm phần bật RLS cho từng bảng.

### 4.1 Bảng

```sql
create table areas (
  id smallint generated always as identity primary key,
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_m int not null default 1500
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30)
);

create table places (
  id bigint generated always as identity primary key,
  google_place_id text unique,
  name text not null,
  category text not null check (category in ('bun_pho_mi','com','banh_mi_xoi','an_vat','do_uong','ca_phe','che')),
  lat double precision not null,
  lng double precision not null,
  address text,
  area_id smallint references areas,
  price_min int,
  price_max int check (price_max >= price_min),
  opening_hours jsonb,
  status text not null default 'pending' check (status in ('pending','visible','hidden')),
  created_by uuid default auth.uid() references profiles on delete set null,
  suggested_by_name text,          -- tên người gợi ý từ comment fanpage (mục 12 bản thiết kế)
  created_at timestamptz not null default now()
);

create table reviews (
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

create table photos (
  id bigint generated always as identity primary key,
  review_id bigint not null references reviews on delete cascade,
  place_id bigint not null references places on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  storage_path text not null unique,      -- bản 1280 px; bản 400 px là <path bỏ .webp>_t.webp
  width int, height int,
  status text not null default 'pending' check (status in ('pending','visible','hidden')),
  created_at timestamptz not null default now()
);

create table reports (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('review','photo')),
  target_id bigint not null,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  reason text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  unique (target_type, target_id, user_id)  -- mỗi người báo một lần, nên "3 báo cáo" = 3 người
);
```

Xóa một dòng trong `auth.users` sẽ xóa dây chuyền: `profiles`, rồi `reviews`, `photos`, `reports` của người đó.

### 4.2 Phân quyền

| Bảng | Đọc (anon và authenticated) | Thêm | Sửa | Xóa |
| --- | --- | --- | --- | --- |
| `areas` | Tất cả | Chỉ nhóm (Table Editor) | Chỉ nhóm | Chỉ nhóm |
| `profiles` | `id`, `display_name` | Trigger khi đăng ký | Dòng của mình | Qua `delete_account` |
| `places` | `status = 'visible'` hoặc do mình đề xuất | Đã đăng nhập, ép `status = 'pending'`, tối đa 5 đề xuất/ngày | Chỉ nhóm | Chỉ nhóm |
| `reviews` | `status = 'visible'` hoặc của mình; **không có cột `checkin_distance_m`** | Chỉ qua `submit_review` | Không ai | Của mình |
| `photos` | `status = 'visible'` hoặc của mình | Của mình, review của mình, tối đa 3/review | Không ai | Của mình |
| `reports` | Không ai | Đã đăng nhập | Không ai | Không ai |

RLS chỉ lọc theo dòng. Để giấu một cột thì cần quyền theo cột:

```sql
revoke select on reviews from anon, authenticated;
grant select (id, place_id, user_id, stars, price_paid, dishes, comment, is_sample, status, review_date, created_at)
  on reviews to anon, authenticated;
```

Hệ quả: truy vấn `select=*` trên `reviews` sẽ bị từ chối, nên `supabase.js` phải liệt kê cột cụ thể.

Ví dụ hai policy tiêu biểu:

```sql
create policy "đọc review đang hiện" on reviews for select
  using (status = 'visible' or user_id = auth.uid());

create policy "thêm ảnh cho review của mình" on photos for insert to authenticated
  with check (
    user_id = auth.uid()
    and storage_path like auth.uid()::text || '/%'
    and exists (select 1 from reviews r where r.id = review_id and r.user_id = auth.uid() and r.place_id = photos.place_id)
    and (select count(*) from photos p where p.review_id = photos.review_id) < 3
  );
```

### 4.3 View

Cả ba view đặt `with (security_invoker = true)` để RLS của người gọi vẫn áp dụng.

- **`place_stats`:** mỗi quán một dòng gồm `review_count`, `avg_stars`, `price_count`, `price_median`, `price_p25`, `price_p75` (dùng `percentile_cont`) và `top_dishes` (3 món nhiều nhất, so khớp `lower(trim(món))`). Chỉ tính đánh giá có `status = 'visible' and not is_sample`. Ngưỡng "dưới 3 thì hiện Mới / giá tham khảo" xử lý ở frontend, view chỉ trả số thô để dễ kiểm.
- **`places_public`:** `places` (đang hiện) nối `place_stats`, kèm `cover_path` là ảnh đang hiện mới nhất. Đây là truy vấn duy nhất lúc mở app.
- **`reviews_public`:** đánh giá đang hiện, kèm `display_name` và `author_review_count` (số đánh giá đang hiện của người viết, dùng để tính huy hiệu Mới đến / Hàng xóm / Thổ địa). View không trả `user_id`.

### 4.4 Hàm và trigger

**`submit_review`**: đường duy nhất để thêm đánh giá.

```sql
create function submit_review(
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
  -- ponytail: danh sách từ cấm viết thẳng trong hàm; sửa bằng create or replace. Chuyển thành bảng nếu cần người không biết SQL sửa
  if p_comment ~* any (array['\mtừ1\M', '\mtừ2\M']) then raise exception 'comment_banned_word'; end if;

  insert into reviews (place_id, user_id, stars, price_paid, dishes, comment, checkin_distance_m)
  values (p_place_id, v_uid, p_stars, p_price_paid,
          array(select distinct trim(d) from unnest(coalesce(p_dishes, '{}')) d where trim(d) <> ''),
          nullif(trim(p_comment), ''), round(v_dist))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'already_reviewed_today';
end $$;

revoke execute on function submit_review from public, anon;
grant execute on function submit_review to authenticated;
```

Tọa độ người dùng chỉ là tham số của hàm, không được ghi vào bảng nào.

**Các trigger và hàm còn lại:**

| Tên | Khi nào | Làm gì |
| --- | --- | --- |
| `handle_new_user` | Sau khi thêm vào `auth.users` | Tạo `profiles` với tên từ Google (`full_name`, cắt còn 30 ký tự); đăng ký bằng email thì đặt "Thực khách" + 4 số ngẫu nhiên. **Không** lấy phần trước @ của email làm tên, vì như vậy là lộ email |
| `set_photo_status` | Trước khi thêm vào `photos` | Ép `status`: `'visible'` nếu người đó đã có từ 2 đánh giá đang hiện trước review này, ngược lại `'pending'` |
| `auto_hide` | Sau khi thêm vào `reports` | Đủ 3 báo cáo cho một mục thì đổi `status` của review hoặc ảnh đó thành `'hidden'` (`security definer`) |
| `delete_account()` | Người dùng gọi qua RPC | `delete from auth.users where id = auth.uid()` (`security definer`), cascade lo phần còn lại |

Khi nhóm khôi phục một nội dung đã bị ẩn tự động, xóa luôn các dòng `reports` của nó; nếu không, báo cáo tiếp theo sẽ ẩn lại ngay.

### 4.5 Storage

- Bucket `photos`: public, `file_size_limit` 1 MB (ảnh sau nén chỉ khoảng 250 KB), `allowed_mime_types` gồm `image/webp` và `image/jpeg`.
- Policy cho phép tải lên: `bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text`. Policy cho phép xóa: chủ sở hữu.
- Giới hạn đã biết: ảnh đang chờ duyệt vẫn mở được nếu ai đó biết chính xác URL. Đường dẫn không được liệt kê ở đâu, nên chấp nhận được trong mùa thi.

### 4.6 Duyệt nội dung

Lưu sẵn 3 truy vấn trong SQL Editor (Saved snippets) để duyệt lúc 12:00 và 21:00:

1. Quán chờ duyệt: `select * from places where status = 'pending'`.
2. Ảnh chờ duyệt, kèm link xem ảnh.
3. Nội dung bị ẩn do báo cáo, kèm lý do.

Duyệt bằng cách sửa ô `status` trong Table Editor. Đánh giá mẫu cũng được tạo ở đây (đặt `is_sample = true`) và xóa trước ngày 11/10 bằng `delete from reviews where is_sample`.

## 5. Cấu hình dịch vụ

### 5.1 Google Cloud

- [ ] Bật **Maps JavaScript API** và **Places API (New)**.
- [ ] **Key prod:** HTTP referrer là `https://<domain-thật>/*`; API restriction chỉ hai API trên.
- [ ] **Key dev:** referrer là `http://localhost:5173/*`. Dùng key riêng để không phải mở key prod cho localhost.
- [ ] Quotas: Map loads 300/ngày; Place Details 30/ngày.
- [ ] Budget alert 1 USD, gửi email cho cả 3 người.
- [ ] Map Management: tạo Map ID loại JavaScript, Vector. Tạo Map Style có bản sáng và tối, tắt "Points of interest" và "Transit", gắn vào Map ID.
- [ ] OAuth consent screen: loại External, scope `email` và `profile`, rồi **bấm Publish (In production)**. Nếu để ở chế độ Testing thì chỉ tài khoản có trong danh sách test user mới đăng nhập được, người ngoài nhóm sẽ bị chặn.
- [ ] OAuth Client ID (Web): redirect URI là `https://<project-ref>.supabase.co/auth/v1/callback`.

### 5.2 Supabase

- [ ] Chạy `schema.sql`, rồi `test.sql` (mục 7).
- [ ] Auth → Providers: bật Google (dán Client ID và secret), bật Email với OTP.
- [ ] Auth → URL Configuration: Site URL là domain thật; Redirect URLs gồm domain thật và `http://localhost:5173`.
- [ ] Auth → Email Templates: mẫu "Magic Link" dùng `{{ .Token }}` (mã 6 số) thay cho link, viết bằng tiếng Việt.
- [ ] Auth → SMTP: cấu hình SMTP riêng (mục 5.4).
- [ ] Bật xác thực 2 bước cho tài khoản của cả 3 người.

### 5.3 Vercel và GitHub

- Repo GitHub để private (chứa dữ liệu sao lưu trong artifact). Nhánh `main` là production; nhánh khác tạo bản preview.
- Biến môi trường trên Vercel: 4 biến `VITE_*`. Bản preview dùng key Google dev nên bản đồ không hiện và tự chuyển sang danh sách. Chấp nhận được, vì bản preview chỉ để kiểm giao diện và luồng.
- Không bao giờ để `service_role` key trong repo hay trong biến `VITE_*` (mọi biến `VITE_*` đều lộ ra trình duyệt).

### 5.4 Email đăng nhập

SMTP mặc định của Supabase chỉ dành cho thử nghiệm: theo hiểu biết hiện tại, nó chỉ gửi tới email của thành viên trong tổ chức Supabase và giới hạn vài email mỗi giờ. Vì vậy người dùng thật (nhất là người mở app trong Facebook, vốn chỉ đăng nhập được bằng email) **sẽ không nhận được mã**. Đây là việc bắt buộc của ngày 07/10, không phải chỉ là phương án dự phòng.

| Cách | Cần gì | Ghi chú |
| --- | --- | --- |
| Resend (gói miễn phí khoảng 100 email/ngày) | Một tên miền riêng đã xác minh DNS | Gửi ổn định nhất. Tên miền `.id.vn` có chương trình miễn phí cho người 18–23 tuổi (cần kiểm lại điều kiện); khi đó dùng luôn tên miền này cho Vercel |
| Brevo (gói miễn phí khoảng 300 email/ngày) | Xác minh một địa chỉ người gửi | Không cần tên miền, nhưng email gửi từ địa chỉ Gmail dễ vào thư rác hơn |

Ngay sau khi cấu hình, gửi thử tới một địa chỉ Gmail và một địa chỉ Outlook không thuộc nhóm, và kiểm tra cả hộp thư rác.

### 5.5 Giám sát và sao lưu

- **UptimeRobot**, 2 monitor 5 phút: (1) trang chủ trên Vercel; (2) `https://<ref>.supabase.co/rest/v1/areas?select=id&limit=1&apikey=<anon>`. Cần kiểm lại việc truyền `apikey` qua query string; gói miễn phí của UptimeRobot có thể không cho thêm header.
- **GitHub Action mỗi đêm** (`.github/workflows/backup.yml`): `supabase db dump --data-only --schema public` rồi lưu thành artifact 14 ngày. Action này đồng thời là một lượt truy cập database mỗi ngày, nên dự án miễn phí không bị tạm dừng kể cả khi UptimeRobot hỏng. Secret cần có: `SUPABASE_DB_URL`. Ảnh trong Storage không được sao lưu; mất ảnh thì ít hại hơn mất đánh giá.

```yaml
on: { schedule: [{ cron: '0 17 * * *' }], workflow_dispatch: {} }   # 00:00 giờ Việt Nam
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - uses: supabase/setup-cli@v1
      - run: supabase db dump --db-url "$DB_URL" --data-only --schema public -f data.sql
        env: { DB_URL: '${{ secrets.SUPABASE_DB_URL }}' }
      - uses: actions/upload-artifact@v4
        with: { name: backup, path: data.sql, retention-days: 14 }
```

## 6. Bảo mật: mối đe dọa và cách chặn

| Mối đe dọa | Chặn bằng |
| --- | --- |
| Ghi thẳng vào `reviews` để bỏ qua check-in | Không có policy `insert` trên `reviews`; chỉ `submit_review` thêm được |
| Sửa hoặc xóa đánh giá của người khác | RLS `user_id = auth.uid()`; không có policy `update` |
| Đọc khoảng cách check-in hoặc email | Quyền theo cột trên `reviews`; email chỉ nằm trong `auth.users`; tên mặc định không lấy từ email |
| XSS qua nhận xét, tên, món | Chỉ dùng `textContent`; ràng buộc độ dài trong database |
| Tải file độc hoặc file lớn | Bucket giới hạn loại file và 1 MB; mỗi người chỉ ghi được vào thư mục của mình |
| Spam đánh giá hoặc đề xuất quán | 1 đánh giá/quán/ngày, 10 đánh giá/ngày, 5 đề xuất/ngày, chặn link và số điện thoại |
| Ảnh xấu lọt lên | Hàng chờ cho tài khoản mới, tự ẩn khi đủ 3 báo cáo, duyệt 2 lần/ngày |
| Đốt tiền Google | Key khóa theo domain và API, giới hạn lượt/ngày (đây mới là thứ thật sự chặn chi tiêu) |
| Làm giả GPS | Không chặn được hoàn toàn. Ghi rõ trên trang Về dự án là xác thực cơ bản |
| Mất dữ liệu | Sao lưu mỗi đêm; `schema.sql` dựng lại được toàn bộ cấu trúc |
| Mất tài khoản quản trị | Xác thực 2 bước trên Supabase, Google Cloud, Vercel, GitHub |

## 7. Kiểm thử kỹ thuật

Bổ sung cho ma trận thiết bị và buổi thử với sinh viên ở mục 11 bản thiết kế.

- **`src/util.test.js`** chạy bằng `node --test`: `isOpenNow` (trong giờ, ngoài giờ, khung qua đêm, ngày nghỉ, `all`), `distanceM` (hai điểm đã biết khoảng cách), `normalizeVi`, `isInAppBrowser` với UA thật của Facebook, Messenger, Zalo, Chrome.
- **`supabase/test.sql`**: chạy trong một transaction rồi `rollback`, nên không để lại dữ liệu:
  - Tạo 2 người dùng giả, 1 quán, vài đánh giá với giá biết trước. Kiểm tra `place_stats` trả đúng trung vị, phân vị, và bỏ qua đánh giá mẫu.
  - `set local role authenticated` và `set local request.jwt.claims` thành người B, thử xóa đánh giá của A: phải xóa 0 dòng.
  - Gọi `submit_review` từ tọa độ cách quán 1 km: phải báo `too_far`. Gọi 2 lần trong ngày: phải báo `already_reviewed_today`.
  - Thêm 3 báo cáo từ 3 người: đánh giá phải chuyển `hidden`.
  - Dùng `assert` trong khối `do $$ ... $$` để có lỗi là dừng ngay.
- **Kiểm từ bên ngoài:** dùng `curl` với anon key gọi `DELETE /rest/v1/reviews?id=eq.<id>`, và `GET /rest/v1/reviews?select=checkin_distance_m`. Cả hai phải bị từ chối.

## 8. Phân việc kỹ thuật theo ngày

| Ngày | Giao diện và bản đồ | Dữ liệu và backend |
| --- | --- | --- |
| 05/10 | Khởi tạo Vite, router, `vercel.json`, deploy trang trống lên Vercel | Google Cloud (billing, 2 key, quota, Map ID và style, OAuth client đã Publish). Tạo dự án Supabase. Bắt đầu đăng ký tên miền nếu chọn Resend |
| 06/10 | Bản đồ với ghim, gom cụm, bộ lọc, tìm kiếm, `util.js` và test | `schema.sql` (bảng, view, RLS), nhập CSV 40 quán, `test.sql` phần `place_stats` |
| 07/10 | Trang quán, điểm Google, chia sẻ, chỉ đường. **Chạy Lighthouse lần đầu** | Auth Google và OTP, **SMTP riêng**, trigger `handle_new_user`, bucket Storage |
| 08/10 | Viết đánh giá, nén ảnh, đề xuất quán, báo cáo | `submit_review`, `set_photo_status`, `auto_hide`, `delete_account`, `test.sql` phần RLS |
| 09/10 | Chế độ danh sách, các màn lỗi, chế độ tối, Của tôi | Chạy ma trận thiết bị cùng nhóm, workflow sao lưu, UptimeRobot |
| 10/10 | Sửa lỗi từ buổi thử với sinh viên | Sửa lỗi; xem lại các truy vấn duyệt nội dung |
| 11/10 | Lighthouse ≥ 90, `og.png` | Xóa đánh giá mẫu, chạy lại `test.sql`, chạy tay workflow sao lưu một lần |
| 12/10 | Đóng băng tính năng | Đóng băng tính năng |

## 9. Câu hỏi kỹ thuật cần chốt hôm nay

- [ ] Chọn Resend (cần tên miền) hay Brevo? Câu này quyết định có cần tên miền riêng hay dùng `.vercel.app`.
- [ ] Tên miền Vercel cụ thể là gì? Cần biết để khóa key Google và điền Redirect URL của Supabase.
- [ ] Ai giữ quyền owner của Google Cloud, Supabase, Vercel? Nên có ít nhất 2 người, để một người ốm không làm tắc cả nhóm.

## 10. Những điểm bổ sung hoặc khác bản thiết kế

| # | Nội dung | Vì sao |
| --- | --- | --- |
| 1 | SMTP riêng là **bắt buộc**, làm ngày 07/10 | SMTP mặc định của Supabase không gửi tới người ngoài nhóm |
| 2 | OAuth consent screen phải được Publish | Ở chế độ Testing, người ngoài nhóm không đăng nhập Google được |
| 3 | Thêm cột `places.suggested_by_name` | Người gợi ý quán qua comment fanpage không có tài khoản trong app, nhưng trang quán cần ghi "Gợi ý bởi [tên]" |
| 4 | Thêm cột `reviews.review_date` theo giờ Việt Nam | Để chỉ mục duy nhất "1 đánh giá/ngày" tính theo ngày Việt Nam, không theo UTC |
| 5 | Quyền theo cột cho `reviews` | RLS không giấu được cột `checkin_distance_m` |
| 6 | Tên hiển thị mặc định không lấy từ email | Tránh lộ một phần email |
| 7 | Mỗi ảnh lưu 2 cỡ (1280 px và 400 px) | Storage miễn phí không resize ảnh; lưới ảnh và danh sách cần ảnh nhỏ để đạt Lighthouse |
| 8 | Ảnh có thể là JPEG thay vì WebP | Safari có thể chưa xuất được WebP qua canvas; EXIF vẫn bị xóa |
| 9 | Xóa file ảnh qua Storage API trước khi xóa tài khoản | `on delete cascade` không xóa được file |
| 10 | Đường dẫn thật (`/quan/12`) + PKCE thay vì hash | Link chia sẻ đẹp hơn, và không xung đột với token OAuth |
| 11 | Hai key Google (prod và dev) | Không phải mở key prod cho localhost hay các domain preview |
| 12 | Sao lưu mỗi đêm bằng GitHub Action | Gói miễn phí của Supabase không có bản sao lưu tải về được; mất đánh giá giữa mùa thi là mất bài |
| 13 | Đặt `Referrer-Policy` rõ ràng | Key khóa theo domain cần header Referer |
| 14 | Ảnh xem trước khi dán link chỉ có một ảnh chung cho cả app | Facebook không chạy JS khi lấy ảnh xem trước. Ảnh riêng cho từng quán cần render phía server, để sau cuộc thi |

## 11. Phương án B: Leaflet (không có billing Google)

Chỉ viết lại `map.js` và phần điểm Google trong `place.js`:

- Leaflet (khoảng 42 KB) + `leaflet.markercluster`. Ghim dùng `L.divIcon` với đúng HTML/SVG của ghim hiện tại.
- Nền bản đồ: CARTO Voyager (sáng) và Dark Matter (tối) trên dữ liệu OpenStreetMap, ghi nguồn "© OpenStreetMap contributors © CARTO". Cần kiểm lại điều khoản sử dụng miễn phí của CARTO.
- Bỏ dòng điểm Google, giữ link "Xem trên Google Maps" và nút chỉ đường (Google Maps URLs miễn phí, không cần key).
- Đề xuất quán: kéo ghim bằng `draggable: true` của Leaflet.

Database, đăng nhập, ảnh và mọi luồng khác giữ nguyên.

## 12. Cần kiểm lại trên trang chính thức

Các điểm sau viết theo hiểu biết đến năm 2026, chưa tra cứu trực tuyến:

- Hạn mức miễn phí của Google: Dynamic Maps khoảng 10.000 lượt/tháng; Place Details có trường `rating` thuộc nhóm Enterprise, khoảng 1.000 lượt/tháng.
- Giới hạn SMTP mặc định của Supabase, và việc Supabase tạm dừng dự án miễn phí sau 7 ngày không hoạt động.
- Hạn mức miễn phí của Resend và Brevo; điều kiện nhận tên miền `.id.vn` miễn phí.
- Gửi anon key Supabase qua query string `?apikey=`, và việc UptimeRobot gói miễn phí có hỗ trợ header tùy chỉnh hay không.
- Yêu cầu ghi nguồn khi hiển thị dữ liệu Places bên ngoài bản đồ Google.
