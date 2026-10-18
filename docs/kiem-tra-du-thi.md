# Kiểm tra Hometown — 18/10/2026

## Tình trạng công khai

- URL: https://duahnproducts.github.io/alert/
- GitHub Pages API xác nhận `public: true`, `https_enforced: true`, `build_type: workflow`.
- Trình duyệt mở không cần đăng nhập; bản đồ và danh sách 55 quán demo ở Hà Nội tải được. Nhãn demo hiển thị.
- Repo công khai và Issues được bật.
- Actions Variables rỗng: chưa có kết nối Supabase cho bản triển khai.
- Backup run 39060626538 bỏ qua toàn bộ bước dump và upload do thiếu cấu hình. Không có bằng chứng sao lưu dữ liệu thật.

## Các lỗi đã sửa

- Lần tải demo lỗi HTTP/mạng không khóa vĩnh viễn nút thử lại.
- Cache dữ liệu thật sai cấu trúc không được dùng để khởi động app.
- Tải thành công danh sách rỗng không bị báo nhầm thành lỗi mạng.
- Font bên ngoài lỗi không làm hỏng bản đồ; tải TileJSON có kiểm HTTP, giới hạn chờ và cho phép thử lại thư viện sau lỗi.
- Ghim địa danh chỉ thuộc thành phố đang xem, cập nhật cả khi chuyển thành phố mà mức zoom giữ nguyên.
- Link bỏ qua bản đồ mở chế độ danh sách và đưa focus tới danh sách.
- Ghi chú giá tham khảo trong demo không còn nhận là dữ liệu khảo sát thật.
- Xóa tên nhóm 3 người, email giả và link Facebook chung; dùng repo/Issues đã xác minh. Metadata chia sẻ mô tả rõ dữ liệu demo.
- Build cục bộ có URL ảnh chia sẻ mặc định, không còn `%VITE_SITE_URL%` chưa thay thế.

## Kiểm chứng

- `npm ci`: 0 lỗ hổng được npm audit báo tại thời điểm kiểm tra.
- `npm test`: 18 phép thử hàm thuần đạt.
- Bộ chỉ đường: 310 phép thử đạt, 1 phép thử gọi tuyến thật bỏ qua mặc định. Tuyến và ô bản đồ được giả lập, không phải kiểm thử tải hay chứng minh dịch vụ ngoài luôn hoạt động.
- `tests/readiness.spec.js`: 5 phép thử khôi phục mạng, danh sách rỗng, bỏ qua bản đồ, chuyển thành phố và thông tin giới thiệu đạt.
- `npm run build`: thành công. CI Pages phải chạy lại toàn bộ trên commit cuối trước khi công bố kết quả triển khai.

## Điều kiện còn thiếu cho sản phẩm nhiều tài khoản

1. Dự án Supabase, chạy `schema.sql` và `test.sql`, khai URL/publishable key trong Actions Variables.
2. Cấu hình Google OAuth cho người ngoài nhóm, redirect `/alert/`; SMTP riêng và thử nhận mã bằng ít nhất hai tài khoản ngoài nhóm.
3. Quán, ảnh và đánh giá thật được khảo sát; không đổi nhãn demo để giả thành dữ liệu thật.
4. Tên người dự thi và link bài thi chính thức do chủ dự án cung cấp.
5. Kiểm tra Safari/iOS, trình duyệt Facebook/Zalo trên thiết bị thật, Lighthouse mobile và tải đồng thời. Chưa xác minh các mục này.

Không thể cam kết “hết tất cả lỗi” hoặc “mọi người đều dùng được” dựa vào một phiên kiểm thử. Đủ căn cứ xác nhận bản demo công khai sau khi workflow deploy cuối thành công; chưa đủ căn cứ xác nhận nền tảng đóng góp dữ liệu thật.

## Khôi phục nếu bản sửa làm hỏng luồng chính

Commit trước kiểm tra: `29940ff`. Nếu trang chủ, danh sách hoặc trang chỉ đường không mở sau deploy, revert commit sửa lỗi (giữ lịch sử, không force push) và chờ workflow Pages hoàn tất. Bản sửa không thay cấu trúc database.
