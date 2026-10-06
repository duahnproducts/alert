# alert / Quán Quen

Bài dự thi "From Idea to Impact" (CLB FPC), hạn nộp **12/10/2026**. Bản chạy được để thử với sinh viên: **10/10/2026**. Từ 12/10 chỉ sửa lỗi, không thêm tính năng.

Sản phẩm: Quán Quen, web app trên điện thoại, bản đồ quán ăn ngon dưới 50k quanh các trường đại học ở Hà Nội và TP. Hồ Chí Minh, kèm các địa danh nổi tiếng có ảnh thật. Sinh viên check-in GPS tại quán rồi mới được chấm điểm, báo giá thật, chụp ảnh thật. Một người làm (tài liệu cũ ghi nhóm 3 người). Đích cuối: một đường link công khai, ai bấm vào cũng dùng được.

## Tài liệu (đọc trước khi code)

| File | Nội dung | Khi nào đọc |
| --- | --- | --- |
| [docs/quan-quen-thiet-ke.md](docs/quan-quen-thiet-ke.md) | Thiết kế sản phẩm: người dùng, phạm vi, 6 màn hình, nhận diện, dữ liệu, kiểm duyệt, ISO 25010, quyền riêng tư, kiểm thử, fanpage, kế hoạch, rủi ro | Mọi việc liên quan đến hành vi, giao diện, câu chữ |
| [docs/quan-quen-ky-thuat.md](docs/quan-quen-ky-thuat.md) | Phương án kỹ thuật: stack, thư mục, router, SQL bảng/RLS/`submit_review`, cấu hình Supabase/GitHub Pages/nền bản đồ, bảo mật, test, phân việc theo ngày | Mọi việc code, cấu hình, database |

Bản thiết kế là nguồn gốc về sản phẩm; bản kỹ thuật là nguồn gốc về cách làm. Mục 10 bản kỹ thuật liệt kê các chỗ bản kỹ thuật bổ sung hoặc sửa bản thiết kế. Hai file trong `docs/` là **bản chuẩn**; bản nháp trên Claude Docs (link ở đầu file thiết kế) cũ hơn, không dùng làm căn cứ. Khi sửa một quyết định, sửa cả hai file cho thống nhất.

## Quyết định đã chốt

- Không server riêng: GitHub Pages (file tĩnh, https://duahnproducts.github.io/alert/) + Leaflet + Supabase (Postgres, Auth, Storage). Không dùng Vercel (chốt 06/10/2026). Workflow `pages.yml` chỉ deploy từ nhánh mặc định của repo.
- App chạy dưới đường dẫn con `/alert/`: mọi đường dẫn trong code là tương đối theo thẻ `<base>` (vd `icons/x.svg`, `quan/12`, `./`), không viết `/` ở đầu.
- Vite + JavaScript thuần, 3 gói chạy trên trình duyệt: `@supabase/supabase-js`, `leaflet`, `protomaps-leaflet` (vẽ bản đồ chibi từ dữ liệu vector).
- Bản đồ: không có thẻ thanh toán nên không dùng Google Maps (chốt 06/10/2026, mục 11 bản kỹ thuật). App tự vẽ bản đồ kiểu chibi (màu kẹo, đường to bo tròn, ghim tròn phồng) từ dữ liệu vector của OpenFreeMap: miễn phí, không key, không giới hạn lượt. Không dùng `openstreetmap.org`: không kết nối được từ Việt Nam.
- Mọi quy tắc tin cậy (quyền, check-in 150 m, giới hạn đánh giá, hàng chờ ảnh, tự ẩn khi đủ 3 báo cáo) nằm trong Postgres (RLS, hàm, trigger), không nằm ở frontend.
- Không lấy điểm Google. `place_id` của Google (không bắt buộc) chỉ dùng để link "Chỉ đường" và "Xem đánh giá trên Google Maps" mở đúng quán.
- Không lưu tọa độ người dùng; xóa EXIF ảnh bằng cách vẽ lại qua canvas.

Google Cloud chỉ còn dùng cho nút "Tiếp tục với Google" (OAuth, miễn phí, không cần thẻ).

## Quy ước khi code

- Chữ trên giao diện bằng tiếng Việt, giọng thân mật kiểu sinh viên; thông báo lỗi phải nói rõ cần làm gì tiếp.
- Không bao giờ gán dữ liệu người dùng qua `innerHTML`; dùng `textContent`.
- `map.js` là file duy nhất biết đến Leaflet và nguồn ô bản đồ.
- Bảng `reviews` có quyền theo cột: truy vấn phải liệt kê cột, không dùng `select=*`.
- Cấu trúc database chỉ sửa qua `supabase/schema.sql` (chạy lại được từ đầu).
- Supabase dùng key kiểu mới: frontend dùng publishable key (`sb_publishable_…`, biến `VITE_SUPABASE_PUBLISHABLE_KEY`); secret key (`sb_secret_…`) không bao giờ nằm trong repo hay biến `VITE_*`. Dự án tạo sau 11/2025 không có anon key/service_role key, nên hướng dẫn cũ nói "anon key" thì hiểu là publishable key. Vai trò Postgres vẫn là `anon` và `authenticated`.
- Nén ảnh: luôn kiểm `blob.type` sau `toBlob('image/webp')`; iOS trả PNG mà không báo lỗi, khi đó dùng JPEG.
- Email đăng nhập bắt buộc đi qua SMTP riêng (Resend hoặc Brevo); SMTP mặc định của Supabase chỉ gửi tới thành viên nhóm.
- Ghi nguồn bản đồ ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap") phải luôn nhìn thấy rõ: đặt ở góc trên, vì góc dưới bị ngăn kéo danh sách che.
- Địa danh nổi tiếng là dữ liệu tĩnh `public/landmarks.json`, tạo bằng `node scripts/landmarks.mjs` từ Wikidata/Wikipedia/Commons, không lấy từ Google. Chỉ giữ địa danh có ảnh chụp thật; mọi ảnh phải hiện tên tác giả và giấy phép kèm link (yêu cầu của giấy phép CC).
- Ngưỡng hiển thị: dưới 3 đánh giá hiện "Mới"; dưới 3 lượt báo giá hiện "giá tham khảo"; đánh giá `is_sample` không tính vào điểm hay giá.

## Còn mở

- Tên chính thức có giữ "Quán Quen" và linh vật "Bé Bao" không; giữ ngưỡng 50k hay đổi theo thành phố.
- Thành phố đã chốt (06/10/2026): Hà Nội và TP. Hồ Chí Minh. Các cụm trường chưa được ghi vào tài liệu.
- SMTP: Resend (cần tên miền) hay Brevo; có gắn tên miền riêng cho GitHub Pages không.
- Hạn mức, giá và hành vi dịch vụ đã kiểm ngày 05/10/2026 (bảng nguồn ở mục 12 bản kỹ thuật). Còn 3 điểm chỉ thử được khi có dự án thật, liệt kê cuối mục 12.
