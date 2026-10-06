# Hometown: Phương án kỹ thuật

Viết ngày 05/10/2026, dựa trên [Hometown: Thiết kế sản phẩm](quan-quen-thiet-ke.md) (gọi tắt là "bản thiết kế", trích theo số mục). Tài liệu này trả lời câu "làm bằng gì, cụ thể ra sao" để nhóm 3 người code được ngay từ 06/10. Chỗ nào bổ sung hoặc khác bản thiết kế đều được ghi ở mục 10. Các con số về hạn mức, giá và hành vi của dịch vụ đã được kiểm ngày 05/10/2026; nguồn ở mục 12.

**Đã chốt 06/10/2026:** (1) không có thẻ để mở thanh toán Google Cloud, nên bản đồ dùng **Leaflet** (mục 11), không dùng Google Maps; (2) dùng **JavaScript thuần**. Google Cloud chỉ còn dùng để tạo OAuth client cho nút "Tiếp tục với Google" (miễn phí, không cần thẻ). Các mục bên dưới đã sửa theo quyết định này.

## 1. Tóm tắt quyết định

| Lớp | Chọn | Ghi chú |
| --- | --- | --- |
| Frontend | Vite + JavaScript thuần, ES modules | Build ra file tĩnh; không framework, không thư viện UI |
| Phụ thuộc chạy trên trình duyệt | `@supabase/supabase-js`, `leaflet`, `protomaps-leaflet` | Ba gói. Hai gói bản đồ tải sau khi trang đã hiện; gom cụm tự viết, không thêm `leaflet.markercluster` |
| Điều hướng | History API (`/alert/quan/12`), đường dẫn tương đối theo thẻ `<base>`; `404.html` = `index.html` cho link sâu | Link chia sẻ đẹp, không đụng hash của OAuth |
| Bản đồ | Leaflet 1.9 + `protomaps-leaflet` tự vẽ kiểu chibi từ OpenFreeMap (dữ liệu vector, miễn phí, không key, không giới hạn lượt) | Không dùng `openstreetmap.org`: không kết nối được từ Việt Nam |
| Google Maps | Chỉ link Google Maps URLs: "Chỉ đường" và "Xem đánh giá trên Google Maps" | Không lấy điểm Google, không cần key |
| Dữ liệu | Supabase Postgres, 6 bảng + 3 view + 4 hàm | Mọi quy tắc tin cậy nằm trong database |
| Tài khoản | Supabase Auth: Google OAuth (PKCE) và mã 6 số qua email | **Bắt buộc** SMTP riêng (mục 5.4) |
| Ảnh | Nén trên máy bằng canvas, 2 cỡ (1280 px và 400 px), WebP hoặc JPEG | Supabase Storage, bucket công khai |
| Hosting | GitHub Pages (https://duahnproducts.github.io/alert/), workflow `pages.yml` tự deploy từ nhánh mặc định | Chốt 06/10/2026, không dùng Vercel |
| Giám sát, sao lưu | UptimeRobot + một GitHub Action chạy mỗi đêm | Action vừa sao lưu dữ liệu vừa giữ Supabase không bị tạm dừng |
| Kiểm thử | `node --test` cho hàm thuần, `supabase/test.sql` cho RLS và view | Không dùng framework test |

Nguyên tắc xuyên suốt: **frontend chỉ hiển thị, database quyết định.** Ai sửa được gì, check-in có hợp lệ không, ảnh có phải chờ duyệt không, đều do Postgres (RLS, hàm, trigger) quyết định. Ai cũng có thể lấy được publishable key (key này được thiết kế để công khai), nhưng có key cũng không vượt qua được các quy tắc trên.

**Về key của Supabase.** Dự án tạo sau tháng 11/2025 không còn "anon key" và "service_role key". Frontend dùng **publishable key** (`sb_publishable_…`). **Secret key** (`sb_secret_…`) bỏ qua RLS và chỉ dùng trong dashboard hoặc GitHub Secrets; Supabase tự từ chối nếu secret key được gửi từ trình duyệt. Tên vai trò trong Postgres không đổi: request dùng publishable key chạy dưới vai `anon`, người đã đăng nhập chạy dưới vai `authenticated`. Vì vậy SQL bên dưới vẫn viết `anon` và `authenticated`. Hướng dẫn trên mạng viết trước 2026 nói "anon key" thì hiểu là publishable key.

## 2. Kiến trúc

```text
Điện thoại (Chrome, Safari, trình duyệt trong Facebook/Zalo)
  └─ Web app tĩnh (Vite build, ~6 file JS)
       ├─ HTML/JS/CSS ───────────────> GitHub Pages (file tĩnh; 404.html là app cho link sâu)
       ├─ Dữ liệu bản đồ (vector) ───> OpenFreeMap; protomaps-leaflet vẽ kiểu chibi, Leaflet vẽ ghim, gom cụm trên máy
       ├─ REST/RPC (publishable key + JWT) ─> Supabase PostgREST ──> Postgres (RLS, view, submit_review, trigger)
       ├─ Đăng nhập ─────────────────> Supabase Auth ──> Google OAuth / SMTP riêng (Resend hoặc Brevo)
       └─ Tải ảnh lên/xuống ─────────> Supabase Storage (bucket "photos", thư mục theo user_id)

Công cụ phụ:  GitHub ──push──> Action pages.yml ──> GitHub Pages     GitHub Action (mỗi đêm) ──pg_dump + gpg──> artifact sao lưu
              UptimeRobot ──5 phút──> trang web + một truy vấn đọc Supabase
```

Không có server nào của nhóm. Thứ cần vận hành trong mùa thi chỉ là duyệt nội dung trong Table Editor của Supabase.

## 3. Frontend

### 3.1 Cấu trúc thư mục

```text
quan-quen/
  index.html            khung trang, thẻ Open Graph, preconnect font
  package.json          scripts: dev, build, test
  .env.local            (không commit) VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SITE_URL
  src/
    main.js             router, trạng thái chung, bộ lọc, chế độ danh sách, ngăn kéo
    map.js              nạp Leaflet, nền bản đồ, ghim, gom cụm, chuyển sang danh sách khi lỗi
    place.js            trang quán, link Google Maps, lưới ảnh, báo cáo
    review.js           check-in, nén ảnh, gửi đánh giá, đề xuất quán
    auth.js             tấm đăng nhập, phát hiện trình duyệt trong app, trang Của tôi
    supabase.js         client và mọi truy vấn
    util.js             hàm thuần: isOpenNow, distanceM, normalizeVi, formatPrice, isInAppBrowser
    util.test.js        test cho util.js (node --test)
    style.css
  public/
    icons/              bộ icon tự vẽ (SVG): 7 biểu tượng món, 17 biểu tượng địa danh `lm-*.svg`, 4 biểu cảm Bao
    covers/             7 tranh minh họa quán theo loại món (SVG 640×320, mỗi tranh dưới 5 KB), làm ảnh bìa khi quán chưa có ảnh thật
    og.png              ảnh xem trước 1200×630 khi dán link
  supabase/
    schema.sql          bảng, view, RLS, hàm, trigger, bucket (chạy lại được từ đầu)
    test.sql            kiểm tra RLS và place_stats
  .github/workflows/backup.yml
```

`map.js` là file duy nhất biết đến Leaflet và nguồn ô bản đồ. Đổi thư viện hoặc nguồn ô bản đồ thì chỉ sửa file này.

### 3.2 Điều hướng

| Đường dẫn | Màn | Cần đăng nhập |
| --- | --- | --- |
| `/` | Bản đồ (có `?khu=2` để chọn cụm trường) | Không |
| `/quan/:id` | Chi tiết quán | Không |
| `/quan/:id/danh-gia` | Viết đánh giá | Có |
| `/de-xuat` | Đề xuất quán | Có |
| `/cua-toi` | Của tôi | Có |
| `/gioi-thieu` | Về dự án, chính sách quyền riêng tư | Không |

Router khoảng 30 dòng trong `main.js`: một mảng `[regex, hàm render]`, `history.pushState` khi bấm link nội bộ, nghe sự kiện `popstate`.

App chạy trên GitHub Pages dưới đường dẫn con `/alert/` (tên repo). Thẻ `<base href="%BASE_URL%">` trong `index.html` là `/` khi chạy trên máy và `/alert/` khi build bằng `vite build --base=/alert/`. Vì vậy mọi đường dẫn trong code đều tương đối (`icons/com.svg`, `quan/12`, `./`, `landmarks.json`), không viết `/` ở đầu. Router bỏ phần gốc trước khi so khớp (`appPath()`), và chỉ chặn các link cùng trang nằm dưới đường dẫn gốc.

GitHub Pages không có rewrite: mở thẳng `/alert/quan/12` thì Pages trả `404.html`. Workflow chép `index.html` thành `404.html`, nên trang 404 chính là app và router vẽ đúng màn. Mã trạng thái vẫn là 404, nên Facebook có thể không lấy ảnh xem trước cho link sâu; link trang chủ vẫn có ảnh xem trước bình thường.

GitHub Pages không cho đặt header, nên `Referrer-Policy` đặt bằng thẻ `<meta name="referrer" content="strict-origin-when-cross-origin">`. Không đặt `no-referrer`: giữ Referer để máy chủ bản đồ biết trang nào đang dùng. Không có `X-Content-Type-Options: nosniff`; chấp nhận được vì app không cho tải file lên chính trang này (ảnh nằm trên Supabase Storage).

### 3.3 Tải và lọc dữ liệu

- Khi mở app: đọc bản lưu `localStorage['qq:places:v1']` (nếu có) và vẽ ngay, rồi gọi `places_public` (mục 4.3) một lần để lấy bản mới, khoảng 30 KB cho 50 quán. Lấy được thì lưu lại kèm `savedAt`. Không lấy được thì giữ bản cũ và hiện dòng "Dữ liệu lưu lúc 20:15". Không có cả hai thì hiện Bao buồn và nút thử lại.
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

- Leaflet 1.9 (bản ESM `leaflet/dist/leaflet-src.esm.js` và `leaflet.css`) và `protomaps-leaflet` nạp bằng `import()` động, chỉ sau khi khung trang và danh sách đã vẽ xong (`requestIdleCallback`). `protomaps-leaflet` dùng biến toàn cục `L`, nên gán `window.L` trước khi nạp nó.
- Bản đồ kiểu chibi: lấy TileJSON `https://tiles.openfreemap.org/planet` (đường dẫn ô dữ liệu đổi theo mỗi bản cập nhật), rồi `protomaps-leaflet` vẽ từng ô lên canvas theo `paintRules` và `labelRules` trong `map.js`: nền kem, khuôn viên trường màu lavender, công viên xanh mint, nước xanh baby có viền, nhà màu đào (từ zoom 16), đường trắng dày bo tròn có viền màu theo cấp, tên đường và tên khu bằng font Be Vietnam Pro có viền trắng, tên trường đại học màu tím. Chế độ tối dùng bảng màu "ban đêm" riêng (`PALETTE.dark`), đổi ngay khi máy đổi chế độ. Không vẽ biểu tượng cửa hàng của bản đồ, để bản đồ không quảng cáo quán khác.
- Ghi nguồn đặt ở góc trên bên trái (góc dưới bị ngăn kéo danh sách che). Nút zoom ở góc trên bên phải. `minZoom: 11` để không kéo ra ngoài cỡ một thành phố.
- Mỗi quán là một `L.marker` với `L.divIcon({ html: <div class="pin">…</div> })`, dựng bằng `createElement` (không dùng chuỗi HTML). `title` và `aria-label` là nhãn đọc màn hình ("Bún chả Hương, 35 nghìn, 4,6 sao, cách 300 mét"). Vương miện, trạng thái mờ và mặt trăng là class CSS. Hiệu ứng nảy dùng `@keyframes` và bị tắt trong `@media (prefers-reduced-motion: reduce)`.
- Gom cụm tự viết, khoảng 25 dòng: ở mỗi mức zoom chia màn hình thành ô lưới 64 px, các quán cùng ô gộp thành một bong bóng mây có biểu tượng loại món nhiều nhất và số quán trong huy hiệu hồng. Bấm cụm thì phóng tới vừa các quán trong cụm. Từ zoom 18 trở lên không gộp nữa. Đủ cho vài trăm quán; nhiều hơn thì dùng `leaflet.markercluster`.
- Ghim chibi: đầu tròn phồng màu theo loại món, viền trắng dày, đuôi nhỏ, bóng dưới chân, lắc lư nhẹ lệch nhịp nhau; quán điểm cao có vương miện, quán đang đóng nhạt màu kèm 💤; ghim được chọn nảy lên. Vị trí của bạn là Bao nhỏ có vòng sóng. Mọi chuyển động tắt khi máy bật giảm chuyển động.
- Khi lọc: dùng lại marker đã tạo, chỉ tính lại cụm.
- CSS của Leaflet ép `width: auto` cho ảnh trong lớp ghim, nên cỡ biểu tượng phải đặt bằng selector mạnh hơn (`.leaflet-container .qq-icon .pin img`). `#map` có `isolation: isolate` để các lớp của Leaflet (z-index 400 đến 1000) không đè lên ngăn kéo danh sách.
- **Chuyển sang danh sách khi lỗi:** không tải được thư viện, hoặc sau 8 giây chưa tải được ô bản đồ nào trong khi khung bản đồ đang hiện. Gặp một trong hai trường hợp thì chuyển hẳn sang chế độ danh sách, kèm dòng "Bản đồ đang nghỉ, xem danh sách nhé".

### 3.6 Trang quán (`place.js`)

- Dữ liệu chính lấy từ mảng đã tải. Chỉ đánh giá và ảnh cần gọi thêm: `reviews_public` và `photos` theo `place_id`, 20 dòng mới nhất.
- Không lấy điểm Google. Dòng dưới điểm Hometown là link "Xem đánh giá trên Google Maps": `https://www.google.com/maps/search/?api=1&query=<tên quán>&query_place_id=<place_id>` (không có `place_id` thì dùng tọa độ).
- Chỉ đường: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&destination_place_id=<place_id>`.
- Chia sẻ: `navigator.share({ title, url })`, nếu trình duyệt không có thì sao chép link bằng `navigator.clipboard.writeText` và hiện thông báo "Đã chép link".
- Ảnh: `<img loading="lazy" decoding="async" width height alt>`. Lưới ảnh dùng bản 400 px, bấm vào mới mở bản 1280 px.
- Báo cáo: dùng `<dialog>` có sẵn của trình duyệt, chọn lý do, rồi `insert` vào `reports`.

### 3.7 Viết đánh giá (`review.js`)

1. **Check-in:** `navigator.geolocation.getCurrentPosition(ok, err, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })`. Nếu `accuracy > 100` thì báo "Ra chỗ thoáng hơn rồi thử lại nhé". Màn "Bạn đang ở quán" chỉ là gợi ý trên máy (dùng `distanceM`). Kiểm tra thật nằm trong `submit_review`.
2. **Gửi:** `supabase.rpc('submit_review', {...})` nhận về `review_id`. Lỗi từ hàm là một mã ngắn (`too_far`, `already_reviewed_today`, `daily_limit`, `comment_has_contact`, ...), `review.js` đổi mã đó thành câu tiếng Việt.
3. **Ảnh** (sau khi có `review_id`): mỗi ảnh nén thành 2 file, tải lên `<user_id>/<review_id>/<n>.<đuôi>` và `<n>_t.<đuôi>` (đuôi là `webp` hoặc `jpg`, lấy theo `blob.type` thật) với `contentType` đúng loại và `cacheControl: '31536000'` (đường dẫn không bao giờ đổi), rồi `insert` một dòng vào `photos`. Một ảnh lỗi không làm hỏng đánh giá đã gửi; app báo "1 ảnh chưa lên được" và cho thử lại.

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
  // Safari và mọi trình duyệt trên iOS không xuất được WebP: toBlob không báo lỗi mà trả PNG nặng gấp ~10 lần
  if (blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
  return { blob, width: c.width, height: c.height } // vẽ lại qua canvas nên EXIF (có GPS) đã mất
}
```

Ảnh xem trong trang dùng bản 400 px (khoảng 30 KB) vì Supabase Storage không resize ảnh ở gói miễn phí.

**Đề xuất quán:** form gồm tên, ghim kéo được trên bản đồ (dùng `gmpDraggable` của AdvancedMarker), loại món, khoảng giá. `insert` vào `places`; RLS ép `status = 'pending'`.

### 3.8 Đăng nhập (`auth.js`)

```js
export const isInAppBrowser = ua => /FBAN|FBAV|FB_IAB|Instagram|Zalo/i.test(ua)
```

- Tấm đăng nhập là một `<dialog>`. Trong trình duyệt của Facebook, Messenger, Instagram hoặc Zalo, Google luôn trả lỗi `403 disallowed_useragent` (chuyển sang redirect hay popup đều không giúp được), nên app ẩn nút Google, đưa lựa chọn email lên đầu, và thêm nút mở bằng trình duyệt thật:
  - Android: link `intent://<host><path>#Intent;scheme=https;package=com.android.chrome;end` mở thẳng trang đang xem trong Chrome.
  - iPhone: không có cách mở Safari từ code, nên nút này sao chép link và hướng dẫn "Bấm ⋯ rồi chọn Mở bằng trình duyệt".
- Google: `signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })`. Trước khi chuyển trang, lưu đường dẫn đang làm vào `sessionStorage['qq:afterLogin']`; quay về thì đọc ra và điều hướng tiếp.
- Email: `signInWithOtp({ email })`, rồi `verifyOtp({ email, token, type: 'email' })`. Không rời trang.
- Client tạo với `auth: { flowType: 'pkce' }`. Sau khi đăng nhập, Supabase trả về `?code=` trên URL thay cho token trong hash, nên router không phải xử lý trường hợp đặc biệt.
- **Xóa tài khoản:** gọi `storage.from('photos').list(uid)` rồi `remove(...)` để xóa file, sau đó gọi `rpc('delete_account')`. Phải xóa file trước, vì cascade trong database không xóa được file trong Storage.

### 3.9 Hiệu năng (mục tiêu Lighthouse ≥ 90)

| Việc | Lý do |
| --- | --- |
| Vẽ khung trang, bộ lọc và danh sách từ dữ liệu đã lưu trước, nạp thư viện bản đồ sau (`requestIdleCallback`) | Hai gói bản đồ (khoảng 86 KB nén cả CSS) và dữ liệu bản đồ là phần nặng nhất; không để chúng quyết định LCP |
| Be Vietnam Pro qua Google Fonts với `display=swap`, `preconnect` tới `fonts.gstatic.com`, chỉ 3 độ đậm | Tránh chữ trống khi tải |
| Tất cả `<img>` có `width`, `height`, `loading="lazy"` | Không bị CLS, không tải ảnh chưa cuộn tới |
| Ngân sách: JS + CSS của app dưới 150 KB (supabase-js khoảng 45 KB nén) | Kiểm bằng `vite build`, Vite in kích thước từng file |
| Biểu tượng món, địa danh và linh vật là SVG tự vẽ (1–2 KB mỗi hình, linh vật dưới 1 KB) | SVG nét ở mọi cỡ màn hình; cả bộ 28 hình chưa tới 50 KB, ảnh bitmap 3D thì riêng 7 hình đã gần 200 KB |
| Lưới ảnh và danh sách chỉ dùng ảnh 400 px | Giữ dưới hạn mức 5 GB băng thông của Supabase gói miễn phí |

Chạy Lighthouse ngay ngày 07/10 trên bản deploy đầu tiên, không đợi đến 11/10. Nếu bản đồ kéo điểm Performance xuống dưới 90, cách xử lý là chỉ nạp bản đồ khi người dùng chạm vào vùng bản đồ.

### 3.10 Trợ năng và giao diện

- Biến CSS trên `:root` cho màu của bản thiết kế, đổi sang màu tối trong `@media (prefers-color-scheme: dark)`.
- Ngăn kéo và tấm đăng nhập dùng `<dialog>` để có sẵn bẫy focus và phím Esc.
- Chế độ danh sách là HTML thuần (`<ul>` các `<a href="/quan/12">`), có đủ thông tin như ghim trên bản đồ.
- **Không bao giờ dùng `innerHTML` với dữ liệu người dùng** (tên, nhận xét, món). Luôn gán qua `textContent`. Đây là lớp chặn XSS chính.

### 3.11 Địa danh nổi tiếng (`scripts/landmarks.mjs`, `public/landmarks.json`)

- Dữ liệu tĩnh, không nằm trong Supabase: `node scripts/landmarks.mjs` (Node 20+, không cần gói nào) chạy một truy vấn SPARQL trên Wikidata cho mỗi thành phố trong mảng `CITIES`, lấy thêm tên tác giả, giấy phép, link ảnh cỡ 960 px từ API của Commons và đoạn giới thiệu 3 câu từ Wikipedia tiếng Việt, rồi ghi `public/landmarks.json` (100 địa danh, khoảng 105 KB, nén còn khoảng 30 KB). Mất khoảng 30 giây.
- Truy vấn: trong bán kính 10 km quanh tâm thành phố, có ảnh (P18) là file JPEG, có từ 3 bài Wikipedia các thứ tiếng trở lên (`wikibase:sitelinks`, dùng làm thước đo độ nổi tiếng), là lớp con của một trong các loại công trình hoặc nơi chốn (`KINDS`), không phải sân bay, bệnh viện, nhà ga hay trại giam (trừ trại giam đã thành bảo tàng). Đơn vị hành chính bị bỏ trừ khi đồng thời là công trình, thành cổ hay tượng đài (cây phân loại của Wikidata nối "citadel" lên đơn vị hành chính, nên Hoàng thành Thăng Long từng bị bỏ nhầm). Xếp theo số bài viết, lấy 50 mỗi thành phố; `order` là thứ hạng trong thành phố. Tên ưu tiên tên bài Wikipedia tiếng Việt.
- Loại (`type`) để chọn icon `public/icons/lm-<loại>.svg` (17 icon tự vẽ): hàm `typeOf()` đoán theo tên tiếng Việt trước (mảng `TYPES`, có thứ tự ưu tiên), không khớp thì theo tên lớp tiếng Anh (P31), cuối cùng là `museum` (tòa nhà cổ điển).
- App: sau khi bản đồ vẽ xong, `main.js` tải `/landmarks.json` và gọi `showLandmarks()` trong `map.js`: ghim vàng hình tòa nhà, không gộp cụm với quán, nằm dưới ghim quán. Chip "Địa danh" bật/tắt lớp này. Để bản đồ không rối, số địa danh hiện theo zoom: zoom 12 trở xuống 5 nơi đầu mỗi thành phố, zoom 13 là 12, zoom 14 là 25, từ zoom 15 hiện hết (`lmLimit` trong `map.js`). Lỗi tải file thì bản đồ vẫn chạy, chỉ thiếu địa danh.
- Bấm ghim: `openLandmark()` trong `place.js` mở tấm trượt có ảnh thật (chỉ tải lúc này), chip loại địa danh có icon, tên, mô tả, khoảng cách, đoạn giới thiệu, tối đa 3 quán trong vòng 2 km, dòng ghi công "Ảnh: tác giả · giấy phép · Wikimedia Commons. Nội dung: Wikipedia (CC BY-SA 4.0)" có link, và nút "Chỉ đường".
- Mọi chữ lấy từ Wikidata/Wikipedia đều gán qua `textContent` (hàm `h()`), không qua `innerHTML`; tên tác giả trên Commons là HTML nên script đã bóc thẻ trước khi ghi file.

### 3.12 Bản demo (khi chưa nối Supabase)

- `DEMO = !import.meta.env.VITE_SUPABASE_URL` trong `supabase.js`. Khi đó `fetchPlaces`, `fetchReviews` đọc `public/demo.json`, `fetchPhotos` trả rỗng, không đọc hay ghi bản lưu trong `localStorage` (để dữ liệu thật và demo không lẫn nhau).
- `demo.json` tạo bằng `node scripts/demo-data.mjs` (số ngẫu nhiên có hạt giống, chạy lại ra đúng dữ liệu cũ): 4 cụm trường, 32 quán tên tự đặt rải trong bán kính khoảng 700 m quanh tâm cụm, 3–9 đánh giá mẫu mỗi quán (`is_sample: true`), điểm, trung vị và phân vị giá tính sẵn theo đúng cách của `place_stats`, cùng `landmarkNotes`: 1–2 câu cảm nhận mẫu cho mỗi địa danh theo loại.
- Nhãn: `<html class="demo">` bật dải "Bản demo" (`.demo-only`) ở trang chủ, mọi trang con và trang Về dự án; `priceShort(p, true)` ghi "Giá mẫu"; trang quán ghi "đánh giá mẫu", ẩn nút "Chỉ đường" và link Google Maps của quán minh họa. `requireLogin()` và `openLogin()` hiện thông báo "bản demo chưa mở" thay cho đăng nhập.
- Khai `VITE_SUPABASE_URL` (biến của workflow `pages.yml`) là app tự chuyển sang dữ liệu thật, không phải sửa code.

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
  storage_path text not null unique,      -- bản 1280 px, vd '<uid>/<review_id>/1.webp'; bản 400 px là '…/1_t.webp' (cùng đuôi)
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

### 5.1 Google Cloud (chỉ cho đăng nhập Google)

Không cần thanh toán: Google Cloud chỉ dùng cho đăng nhập Google. Không bật Maps API, không tạo key Maps.

- [ ] OAuth consent screen (trong Console mới nằm ở mục Google Auth Platform: Branding, Audience): loại External, scope `email` và `profile`, rồi ở mục Audience **bấm Publish app (In production)**. Nếu để ở chế độ Testing thì chỉ tài khoản có trong danh sách test user mới đăng nhập được, người ngoài nhóm sẽ bị chặn. Hai scope này không nhạy cảm, nên không phải chờ Google xét duyệt.
- [ ] OAuth Client ID (Web): redirect URI là `https://<project-ref>.supabase.co/auth/v1/callback`.

### 5.2 Supabase

- [ ] Chạy `schema.sql`, rồi `test.sql` (mục 7).
- [ ] Auth → Providers: bật Google (dán Client ID và secret), bật Email với OTP.
- [ ] Auth → URL Configuration: Site URL là domain thật; Redirect URLs gồm domain thật và `http://localhost:5173`.
- [ ] Auth → Email Templates: mẫu "Magic Link" dùng `{{ .Token }}` (mã 6 số) thay cho link, viết bằng tiếng Việt.
- [ ] Auth → SMTP: cấu hình SMTP riêng (mục 5.4). Sau đó vào Auth → Rate Limits nâng giới hạn gửi email (mặc định sau khi bật SMTP riêng khoảng 30 email/giờ) cho khớp hạn mức của nhà cung cấp.
- [ ] Settings → API Keys: chép publishable key vào biến `VITE_SUPABASE_PUBLISHABLE_KEY`. Secret key chỉ dán vào GitHub Secrets nếu thật sự cần.
- [ ] Bật xác thực 2 bước cho tài khoản của cả 3 người.

### 5.3 GitHub và GitHub Pages

- Repo GitHub công khai (GitHub Pages miễn phí chỉ chạy với repo công khai). Vì vậy bản sao lưu database được mã hóa bằng gpg trước khi lưu thành artifact (mục 5.5).
- Settings → Pages → Source: **GitHub Actions**. Workflow `.github/workflows/pages.yml` chạy khi push vào nhánh mặc định: `npm ci`, `npm test`, `vite build --base=/<tên repo>/`, chép `index.html` thành `404.html`, rồi deploy. Trang ở https://duahnproducts.github.io/alert/.
- Biến build (Settings → Secrets and variables → Actions → **Variables**): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SITE_URL` workflow tự điền theo tên repo. Bản đồ không cần key. Chưa khai biến Supabase thì app vẫn mở được (bản đồ, địa danh), danh sách quán báo không tải được.
- Không bao giờ để secret key (`sb_secret_…`) trong repo hay trong biến `VITE_*` (mọi biến `VITE_*` đều lộ ra trình duyệt).

### 5.4 Email đăng nhập

SMTP mặc định của Supabase chỉ dành cho thử nghiệm: nó **chỉ gửi tới email của thành viên trong tổ chức Supabase** và tối đa 2 email mỗi giờ. Vì vậy người dùng thật (nhất là người mở app trong Facebook, vốn chỉ đăng nhập được bằng email) **sẽ không nhận được mã**. Đây là việc bắt buộc của ngày 07/10, không phải chỉ là phương án dự phòng.

| Cách | Cần gì | Ghi chú |
| --- | --- | --- |
| Resend (miễn phí 100 email/ngày, 3.000 email/tháng) | Một tên miền riêng đã xác minh DNS | Gửi ổn định nhất. VNNIC tặng tên miền `.id.vn` miễn phí 2 năm cho công dân từ đủ 18 đến 23 tuổi, chương trình đã gia hạn đến hết năm 2026; đăng ký qua nhà đăng ký tên miền, cần xác minh danh tính bằng CCCD (eKYC). Khi đó có thể gắn luôn tên miền này cho GitHub Pages |
| Brevo (miễn phí 300 email/ngày) | Xác minh một địa chỉ người gửi | Không cần tên miền, nhưng email gửi từ địa chỉ Gmail dễ vào thư rác hơn; email có chân trang quảng cáo của Brevo |

Ngay sau khi cấu hình, gửi thử tới một địa chỉ Gmail và một địa chỉ Outlook không thuộc nhóm, và kiểm tra cả hộp thư rác.

### 5.5 Giám sát và sao lưu

- **UptimeRobot**, 2 monitor 5 phút: (1) trang chủ https://duahnproducts.github.io/alert/; (2) `https://<ref>.supabase.co/rest/v1/areas?select=id&limit=1&apikey=<publishable key>`. Gói miễn phí của UptimeRobot không cho thêm header tùy chỉnh, nên key phải đi qua tham số `apikey` trên URL; Supabase bản cloud chấp nhận cách này. Trước khi tạo monitor, chạy thử đúng URL đó bằng `curl` và xác nhận nhận về mã 200.
- **GitHub Action mỗi đêm** (`.github/workflows/backup.yml`): `supabase db dump --data-only --schema public`, mã hóa bằng `gpg --symmetric` với secret `BACKUP_PASSPHRASE` (repo công khai nên ai cũng tải được artifact), rồi lưu thành artifact 14 ngày. Chưa khai secret thì workflow bỏ qua, không báo lỗi. Action này đồng thời là một lượt truy cập database mỗi ngày, nên dự án miễn phí không bị tạm dừng kể cả khi UptimeRobot hỏng. Secret cần có: `SUPABASE_DB_URL`. Ảnh trong Storage không được sao lưu; mất ảnh thì ít hại hơn mất đánh giá.

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
| Máy chủ bản đồ quá tải hoặc ngừng | OpenFreeMap không giới hạn lượt; không tải trước dữ liệu, `minZoom` 11; lỗi thì app tự chuyển sang danh sách; không có dịch vụ nào gắn thẻ nên không thể bị tính tiền |
| Làm giả GPS | Không chặn được hoàn toàn. Ghi rõ trên trang Về dự án là xác thực cơ bản |
| Mất dữ liệu | Sao lưu mỗi đêm; `schema.sql` dựng lại được toàn bộ cấu trúc |
| Mất tài khoản quản trị | Xác thực 2 bước trên Supabase, Google Cloud, GitHub |

## 7. Kiểm thử kỹ thuật

Bổ sung cho ma trận thiết bị và buổi thử với sinh viên ở mục 11 bản thiết kế.

- **`src/util.test.js`** chạy bằng `node --test`: `isOpenNow` (trong giờ, ngoài giờ, khung qua đêm, ngày nghỉ, `all`), `distanceM` (hai điểm đã biết khoảng cách), `normalizeVi`, `isInAppBrowser` với UA thật của Facebook, Messenger, Zalo, Chrome.
- **`supabase/test.sql`**: chạy trong một transaction rồi `rollback`, nên không để lại dữ liệu:
  - Tạo 2 người dùng giả, 1 quán, vài đánh giá với giá biết trước. Kiểm tra `place_stats` trả đúng trung vị, phân vị, và bỏ qua đánh giá mẫu.
  - `set local role authenticated` và `set local request.jwt.claims` thành người B, thử xóa đánh giá của A: phải xóa 0 dòng.
  - Gọi `submit_review` từ tọa độ cách quán 1 km: phải báo `too_far`. Gọi 2 lần trong ngày: phải báo `already_reviewed_today`.
  - Thêm 3 báo cáo từ 3 người: đánh giá phải chuyển `hidden`.
  - Dùng `assert` trong khối `do $$ ... $$` để có lỗi là dừng ngay.
- **Kiểm từ bên ngoài:** dùng `curl` với publishable key gọi `DELETE /rest/v1/reviews?id=eq.<id>`, và `GET /rest/v1/reviews?select=checkin_distance_m`. Cả hai phải bị từ chối.
- **Ảnh từ iPhone:** tải một ảnh chụp bằng iPhone lên, kiểm tra trong Storage rằng file là JPEG thật (không phải PNG mang đuôi `.webp`), dưới 300 KB, và không còn EXIF.

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

- [ ] Chọn Resend (cần tên miền) hay Brevo? Câu này quyết định có cần tên miền riêng hay dùng `github.io`.
- [x] Tên miền: https://duahnproducts.github.io/alert/ (GitHub Pages). Có tên miền riêng thì đổi Redirect URL của Supabase và build với `--base=/`.
- [ ] Ai giữ quyền owner của Google Cloud, Supabase, GitHub? Nên có ít nhất 2 người, để một người ốm không làm tắc cả nhóm.

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
| 8 | Ảnh là JPEG trên iOS, WebP ở nơi khác | Safari và mọi trình duyệt trên iOS không xuất được WebP qua canvas (trả PNG mà không báo lỗi); EXIF vẫn bị xóa |
| 9 | Xóa file ảnh qua Storage API trước khi xóa tài khoản | `on delete cascade` không xóa được file |
| 10 | Đường dẫn thật (`/quan/12`) + PKCE thay vì hash | Link chia sẻ đẹp hơn, và không xung đột với token OAuth |
| 11 | (Bỏ từ 06/10) Hai key Google Maps | Không còn dùng Google Maps |
| 12 | Sao lưu mỗi đêm bằng GitHub Action | Gói miễn phí của Supabase không có bản sao lưu tải về được; mất đánh giá giữa mùa thi là mất bài |
| 13 | Đặt `Referrer-Policy` rõ ràng | Key khóa theo domain cần header Referer |
| 14 | Ảnh xem trước khi dán link chỉ có một ảnh chung cho cả app | Facebook không chạy JS khi lấy ảnh xem trước. Ảnh riêng cho từng quán cần render phía server, để sau cuộc thi |
| 15 | Publishable key và secret key thay cho anon key và service_role key | Dự án Supabase tạo sau 11/2025 chỉ có key kiểu mới |
| 16 | Bộ icon tự vẽ bằng SVG (món ăn và địa danh), thay cho Fluent Emoji | Có phong cách riêng đồng bộ với Bao, nhẹ hơn, không phụ thuộc giấy phép bên ngoài |
| 17 | (Bỏ từ 06/10) Ghi nguồn điểm Google | App không còn lấy điểm Google |
| 18 | Trích Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025/NĐ-CP | Nghị định 13/2023/NĐ-CP đã bị thay thế từ 01/01/2026 |
| 19 | Nút mở Chrome bằng link `intent://` trên Android | Người dùng trong Facebook/Zalo vẫn đăng nhập Google được mà không phải tự sao chép link |
| 20 | Quán chưa có ảnh thật dùng tranh minh họa theo loại món (`public/covers/`), nhãn "Hình minh họa" | Trang quán không trống trong lúc chờ ảnh thật, mà không bịa ảnh cho quán có thật |
| 21 | Bản đồ dùng Leaflet + `protomaps-leaflet`, tự vẽ kiểu chibi từ dữ liệu OpenFreeMap; bỏ điểm Google | Không có thẻ để mở thanh toán Google Cloud; người dùng muốn bản đồ dễ thương hơn bản đồ thường |
| 22 | Không dùng `tile.openstreetmap.org` | Không kết nối được từ mạng ở Việt Nam (kiểm 06/10/2026) |
| 23 | Gom cụm tự viết theo lưới thay cho `leaflet.markercluster` | Vài trăm quán thì 25 dòng là đủ, bớt một gói phụ thuộc |
| 24 | Thêm địa danh nổi tiếng của Hà Nội và TP. Hồ Chí Minh, có ảnh thật; dữ liệu tĩnh từ Wikidata/Wikipedia/Commons (mục 3.11) | Người dùng yêu cầu; Google Places cần thẻ và cấm lưu dữ liệu |
| 25 | Hosting bằng GitHub Pages thay cho Vercel; đường dẫn tương đối theo `<base>`, `404.html` cho link sâu, sao lưu mã hóa | Người dùng muốn truy cập qua GitHub như các dự án trước; repo công khai |
| 26 | Bản demo có nhãn khi chưa nối Supabase: quán tên tự đặt, đánh giá mẫu (mục 3.12) | Chưa có người dùng thật; nội dung mẫu luôn có nhãn, không gắn cho quán có thật |

## 11. Phương án B: Leaflet (đang dùng từ 06/10/2026)

Không có thẻ để mở thanh toán Google Cloud nên app dùng phương án này. Chỉ `map.js` và phần điểm Google trong `place.js` thay đổi so với phương án Google Maps:

- Leaflet 1.9 (khoảng 43 KB nén, thêm 6 KB CSS) và `protomaps-leaflet` 5.1 (khoảng 37 KB nén), tải sau lần vẽ đầu. Ghim dùng `L.divIcon`; gom cụm tự viết (mục 3.5).
- Bản đồ: `protomaps-leaflet` vẽ dữ liệu vector của OpenFreeMap (schema OpenMapTiles) lên canvas theo kiểu chibi tự đặt (mục 3.5). OpenFreeMap không cần đăng ký hay key, không giới hạn lượt, cho dùng cả thương mại, chỉ cần ghi nguồn "OpenFreeMap © OpenMapTiles Data from OpenStreetMap".
- Đã thử và bỏ: `tile.openstreetmap.org` (không kết nối được từ Việt Nam); CARTO (cần key, nền ảnh có sẵn nên không đổi được nét vẽ); MapLibre GL (vẽ đẹp nhưng khoảng 300 KB nén, dễ kéo Lighthouse dưới 90).
- Bỏ dòng điểm Google, giữ link "Xem đánh giá trên Google Maps" và nút chỉ đường (Google Maps URLs miễn phí, không cần key).
- Đề xuất quán: kéo ghim bằng `draggable: true` của Leaflet, hoặc chạm vào bản đồ để dời ghim.

Database, đăng nhập, ảnh và mọi luồng khác giữ nguyên.

## 12. Đã kiểm chứng và nguồn

Kiểm ngày 05/10/2026. Nếu đọc tài liệu này sau ngày nộp bài, kiểm lại trước khi dựa vào các con số.

| Điều đã kiểm | Kết quả | Nguồn |
| --- | --- | --- |
| Hạn mức miễn phí Google Maps (từ 03/2025, tính riêng từng SKU) | Essentials 10.000, Pro 5.000, Enterprise 1.000 lượt/tháng; Dynamic Maps thuộc Essentials | [Pricing categories](https://developers.google.com/maps/billing-and-pricing/pricing-categories), [Billing FAQ](https://developers.google.com/maps/billing-and-pricing/faq) |
| Place Details với `rating`, `userRatingCount` | Tính theo nhóm Enterprise; `googleMapsUri` thuộc Pro; request tính theo trường đắt nhất | [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details) |
| Ghi nguồn và lưu dữ liệu Places | Ngoài bản đồ Google phải có logo Google Maps, hoặc chữ "Google Maps" nếu chỗ hẹp; chỉ `place_id` được lưu không thời hạn | [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) |
| Google chặn đăng nhập trong trình duyệt nhúng | `403 disallowed_useragent` trong Facebook, Messenger, Instagram, Zalo; chỉ cách mở trình duyệt thật mới qua được | [Google OAuth: embedded webviews](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/) |
| SMTP mặc định của Supabase | Chỉ gửi tới thành viên nhóm, 2 email/giờ | [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| Supabase tạm dừng dự án miễn phí | Sau 7 ngày ít hoạt động; phải bật lại bằng tay trong dashboard | [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing) |
| Key kiểu mới của Supabase | Dự án tạo sau 11/2025 chỉ có publishable key và secret key | [API keys](https://supabase.com/docs/guides/api/api-keys) |
| Đổi cỡ ảnh trong Supabase Storage | Chỉ có từ gói Pro | [Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) |
| Truyền `apikey` qua URL | Supabase cloud chấp nhận | [supabase/supabase#28930](https://github.com/supabase/supabase/issues/28930) |
| UptimeRobot gói miễn phí | Không có header tùy chỉnh | [UptimeRobot pricing](https://uptimerobot.com/pricing/) |
| Resend, Brevo gói miễn phí | Resend 100/ngày, 3.000/tháng; Brevo 300/ngày | [Resend pricing](https://resend.com/pricing), [Brevo pricing](https://www.brevo.com/pricing/) |
| Tên miền `.id.vn` miễn phí | Công dân từ đủ 18 đến 23 tuổi, miễn phí 2 năm, gia hạn chương trình đến hết 2026 | [Thư viện Pháp luật](https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/chinh-sach-moi/64708/mien-phi-2-nam-su-dung-ten-mien-id-vn-cho-cong-dan-viet-nam-tu-du-18-den-23-tuoi), [Bộ KH&CN](https://mst.gov.vn/khoi-tao-hien-dien-so-voi-ten-mien-quoc-gia-viet-nam-vn-197260908161420492.htm) |
| Safari xuất WebP qua canvas | Không hỗ trợ, kể cả Safari 26; `toBlob` trả PNG mà không báo lỗi | [Can I use](https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp) |
| Điều khoản CARTO Basemaps | Bắt buộc API key; phi thương mại miễn phí 5 triệu lượt tải ô bản đồ/tháng; ghi nguồn OSM và CARTO | [CARTO Basemap Terms](https://carto.com/legal/basemap-terms/) |
| Key CARTO (kiểm 06/10/2026) | Xin miễn phí, không cần tài khoản; URL dạng `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=<key>` | [Request an API key for basemaps](https://www.carto.com/basemaps/apikey/) |
| `openstreetmap.org` từ Việt Nam (kiểm 06/10/2026) | Cả trang chính và `tile.openstreetmap.org` không kết nối được (lỗi kết nối, lỗi TLS); CARTO và `tile.openstreetmap.fr` vào được | Thử bằng `curl` trên máy ở Việt Nam |
| Wikidata, Wikipedia, Wikimedia Commons (kiểm 06/10/2026) | Truy vấn SPARQL, API Wikipedia và Commons đều vào được từ Việt Nam; ảnh trên `thumb.wikimedia.org` tải được (150–330 KB ở cỡ 960 px). Ảnh Commons cần ghi tác giả và giấy phép; nội dung Wikipedia theo CC BY-SA 4.0 | [Wikidata Query Service](https://query.wikidata.org/), [Commons: Reusing content](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) |
| OpenFreeMap (kiểm 06/10/2026) | Không đăng ký, không key, không giới hạn lượt, cho dùng thương mại; ghi nguồn "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; TileJSON, ô dữ liệu và font đều vào được từ Việt Nam | [openfreemap.org](https://openfreemap.org/) |

Chưa kiểm được trước khi có dự án thật, nhóm tự thử:

- Truyền **publishable key** (key kiểu mới) qua `?apikey=` cho UptimeRobot: nguồn trên xác nhận với key kiểu cũ. Thử bằng `curl` (mục 5.5).
- Điểm Lighthouse khi có bản đồ: chỉ đo được trên bản deploy thật.
- Trình duyệt của Facebook và Zalo trên máy thật có cho lấy vị trí GPS không: nằm trong ma trận thiết bị của bản thiết kế, mục 11.
