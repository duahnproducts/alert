# alert / Quán Quen

Bài dự thi "From Idea to Impact" (CLB FPC), hạn nộp **12/10/2026**. Bản chạy được để thử với sinh viên: **10/10/2026**. Từ 12/10 chỉ sửa lỗi, không thêm tính năng.

Sản phẩm: Quán Quen, web app trên điện thoại, bản đồ quán ăn ngon dưới 50k quanh các trường đại học trong một thành phố. Sinh viên check-in GPS tại quán rồi mới được chấm điểm, báo giá thật, chụp ảnh thật. Nhóm 3 người.

## Tài liệu (đọc trước khi code)

| File | Nội dung | Khi nào đọc |
| --- | --- | --- |
| [docs/quan-quen-thiet-ke.md](docs/quan-quen-thiet-ke.md) | Thiết kế sản phẩm: người dùng, phạm vi, 6 màn hình, nhận diện, dữ liệu, kiểm duyệt, ISO 25010, quyền riêng tư, kiểm thử, fanpage, kế hoạch, rủi ro | Mọi việc liên quan đến hành vi, giao diện, câu chữ |
| [docs/quan-quen-ky-thuat.md](docs/quan-quen-ky-thuat.md) | Phương án kỹ thuật: stack, thư mục, router, SQL bảng/RLS/`submit_review`, cấu hình Google/Supabase/Vercel, bảo mật, test, phân việc theo ngày | Mọi việc code, cấu hình, database |

Bản thiết kế là nguồn gốc về sản phẩm; bản kỹ thuật là nguồn gốc về cách làm. Mục 10 bản kỹ thuật liệt kê các chỗ bản kỹ thuật bổ sung hoặc sửa bản thiết kế. Bản gốc của thiết kế (có sơ đồ vẽ) nằm trên Claude Docs, link ở đầu file thiết kế.

## Quyết định đã chốt

- Không server riêng: Vercel (file tĩnh) + Google Maps JS + Supabase (Postgres, Auth, Storage).
- Vite + JavaScript thuần, chỉ 2 gói chạy trên trình duyệt: `@supabase/supabase-js`, `@googlemaps/markerclusterer`.
- Mọi quy tắc tin cậy (quyền, check-in 150 m, giới hạn đánh giá, hàng chờ ảnh, tự ẩn khi đủ 3 báo cáo) nằm trong Postgres (RLS, hàm, trigger), không nằm ở frontend.
- Dữ liệu từ Google chỉ lưu `place_id`; điểm Google không lưu, không gộp với điểm của app.
- Không lưu tọa độ người dùng; xóa EXIF ảnh bằng cách vẽ lại qua canvas.

**Giả định chưa được nhóm xác nhận** (bản thiết kế đánh dấu đã trả lời nhưng không ghi đáp án): nhóm có thẻ nên dùng Google Maps, không dùng Leaflet; viết JS thuần, không React. Nếu sai, xem mục 11 bản kỹ thuật và cập nhật dòng này.

## Quy ước khi code

- Chữ trên giao diện bằng tiếng Việt, giọng thân mật kiểu sinh viên; thông báo lỗi phải nói rõ cần làm gì tiếp.
- Không bao giờ gán dữ liệu người dùng qua `innerHTML`; dùng `textContent`.
- `map.js` là file duy nhất biết đến Google Maps.
- Bảng `reviews` có quyền theo cột: truy vấn phải liệt kê cột, không dùng `select=*`.
- Cấu trúc database chỉ sửa qua `supabase/schema.sql` (chạy lại được từ đầu).
- `service_role` key không bao giờ nằm trong repo hay biến `VITE_*`.
- Ngưỡng hiển thị: dưới 3 đánh giá hiện "Mới"; dưới 3 lượt báo giá hiện "giá tham khảo"; đánh giá `is_sample` không tính vào điểm hay giá.

## Còn mở

- Tên chính thức có giữ "Quán Quen" và linh vật "Bé Bao" không; giữ ngưỡng 50k hay đổi theo thành phố.
- Thành phố và các cụm trường đã chọn chưa được ghi vào tài liệu.
- SMTP: Resend (cần tên miền) hay Brevo; tên miền chính thức trên Vercel.
- Các con số hạn mức, giá dịch vụ viết theo trí nhớ, cần kiểm lại (mục 12 bản kỹ thuật).
