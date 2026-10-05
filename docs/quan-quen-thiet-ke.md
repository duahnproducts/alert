# Quán Quen: Thiết kế sản phẩm

Bản xuất từ tài liệu Claude Docs ngày 05/10/2026. Bản gốc (có sơ đồ vẽ): https://claude.ai/code/artifact/eb3e82df-65aa-44b2-8470-35029f08e2e5

## 1. Tóm tắt

Quán Quen (tên tạm) là bản đồ các quán ăn ngon dưới 50k quanh các trường đại học trong một thành phố. Sinh viên và người dân địa phương chấm điểm, báo giá thật và chụp ảnh thật; mỗi quán hiện trên bản đồ bằng một biểu tượng dễ thương.

- **Cho ai:** sinh viên 18–24 tuổi, đặc biệt là tân sinh viên mới lên thành phố, chưa biết ăn ở đâu và phải tiêu tiền kỹ.
- **Lời hứa:** quán ngon vì người ăn thật nói ngon, không phải vì được quảng cáo.
- **Phạm vi dự thi:** một thành phố, 3–5 cụm trường, 30–50 quán do nhóm tự đi ăn và chụp.

|  | Google Maps | Foody / ShopeeFood | Quán Quen |
| --- | --- | --- | --- |
| Ai chấm điểm | Bất kỳ ai, kể cả khách du lịch và đánh giá mua | Khách đặt món, quán có trả phí quảng cáo | Người đã check-in GPS tại quán |
| Giá | Khoảng giá chung chung | Giá menu giao hàng, thường cao hơn ăn tại chỗ | "Giá thật": số tiền người ăn báo lại |
| Ảnh | Lẫn ảnh quán tự đăng | Ảnh món do quán chụp | Chỉ ảnh chụp tại quán, có nhãn "Ảnh thật" |
| Phạm vi | Toàn cầu | Toàn quốc | Quanh trường, dưới 50k |
| Cảm giác | Bản đồ công cụ | Danh sách bán hàng | Bản đồ vui, biểu tượng dễ thương |

| Chỉ số thành công | Mục tiêu | Đo bằng cách nào |
| --- | --- | --- |
| Tìm được một quán vừa ý từ lúc mở app | ≤ 30 giây | Bấm giờ khi thử với 5–10 sinh viên |
| Quán có ảnh thật và giá thật lúc nộp bài | ≥ 30 quán | Đếm trong database |
| Đánh giá mới từ người ngoài nhóm trong mùa thi | ≥ 50 | Đếm trong database |
| Điểm Lighthouse (mobile) | ≥ 90 ở cả 4 mục | Chạy Lighthouse |
| App chạy liên tục trong mùa thi | Không sập lần nào | Theo dõi bằng UptimeRobot (miễn phí) |

## 2. Người dùng và bối cảnh

Người dùng cần trả lời nhanh câu "gần đây ăn gì ngon mà rẻ" và tin được câu trả lời. App cũng cần một nhóm nhỏ người sẵn lòng đóng góp đánh giá.

| Chân dung | Hoàn cảnh | Cần gì từ app | Ràng buộc |
| --- | --- | --- | --- |
| **Tân sinh viên** (Minh, 18 tuổi, từ tỉnh lên, ở trọ) | Chưa biết khu nào, sợ bị chặt chém | Quán gần trường hoặc phòng trọ, giá thật, đường đi | Tiền ăn khoảng 50–60k/ngày (giả định, cần hỏi lại khi thử), dùng máy Android tầm trung |
| **"Thổ địa"** (Hà, 21 tuổi, năm ba) | Biết nhiều quán ngon, hay được bạn hỏi | Đăng đánh giá nhanh, được ghi nhận là người gợi ý | Không muốn viết dài; chỉ đăng khi đang ngồi ở quán |
| **Người xem từ fanpage** | Thấy bài dự thi, bấm link trong Facebook | Lướt bản đồ cho vui, tìm quán quen của mình | Mở trong trình duyệt của Facebook, chỉ ở lại dưới 1 phút |

**Ba tình huống dùng chính**

1. **11:30, giữa hai ca học, có 15 phút.** Mở app ở cổng trường, lọc "đang mở cửa" và "dưới 30k", chọn quán gần nhất.
2. **21:00, đi làm thêm về.** Tìm quán còn mở trên đường về trọ.
3. **Cuối tuần rủ bạn đi ăn.** Lướt bản đồ tìm quán có ảnh đẹp, gửi link quán vào nhóm chat; ăn xong thì viết đánh giá ngay tại bàn.

## 3. Phạm vi bản dự thi

Bản dự thi là một web app chạy trên điện thoại, có bản đồ, trang quán và chức năng viết đánh giá có check-in. Mọi thứ khác để sau cuộc thi.

**Làm**

- Bản đồ có biểu tượng theo loại món; lọc theo giá (dưới 30k, 30–50k), loại món, "đang mở cửa", cụm trường.
- Chế độ danh sách, thay cho bản đồ khi bản đồ lỗi hoặc người dùng dùng trình đọc màn hình.
- Trang quán: ảnh thật, giá thật, điểm của app, điểm Google, giờ mở cửa, chỉ đường, chia sẻ.
- Đăng nhập Google, chỉ bắt buộc khi viết đánh giá.
- Viết đánh giá: check-in GPS, số sao, giá đã trả, món đã ăn, một câu nhận xét, tối đa 3 ảnh.
- Đề xuất quán mới; nhóm duyệt rồi mới lên bản đồ.
- Nút báo cáo đánh giá hoặc ảnh sai.
- Trang "Về dự án": cách tính điểm, nguồn dữ liệu, cam kết không nhận tiền từ quán.

**Cố ý không làm**

- Tìm kiếm mọi thành phố qua Places API: tốn tiền theo lượt và làm mất điểm khác biệt "một thành phố, người địa phương".
- Đặt món, giao hàng, mã giảm giá, quán trả tiền để lên đầu.
- Chatbot hoặc AI gợi ý món.
- Theo dõi người dùng khác, nhắn tin, bình luận lồng nhau.
- App native và trang quản trị riêng. Nhóm duyệt nội dung ngay trong bảng dữ liệu của Supabase.

**Dữ liệu lúc nộp bài: dùng dữ liệu thật nhưng ít**

Không cần dữ liệu lớn, nhưng không nên bịa đánh giá cho quán có thật. Đánh giá bịa làm người dùng hiểu sai về một quán có thật, đi ngược lời hứa "không quảng cáo" của chính app, và BTC chấm điểm "đóng góp thực tế".

- **Thông tin quán** (tên, vị trí, giờ mở cửa): lấy thật, gắn với `place_id` của Google.
- **Đánh giá và ảnh:** chỉ do nhóm viết khi đã ăn thật. Ba người, mỗi người khoảng 10 quán trong tuần là đủ 30 quán.
- **Chỗ nào cần lấp đầy để demo:** dùng đánh giá mẫu có nhãn "Mẫu" hiển thị rõ, và xóa hết trước khi đăng bài lên fanpage.

## 4. Màn hình và luồng

App có 6 màn. Người chỉ xem thì không bao giờ phải đăng nhập; đăng nhập chỉ xuất hiện khi bấm "Viết đánh giá" hoặc "Đề xuất quán".

Sơ đồ luồng màn hình (dạng chữ):

```text
Bản đồ ──> Chi tiết quán ──> [Đã đăng nhập?] ──rồi──> Viết đánh giá (check-in trong 150 m)
  │                               │chưa                         ▲
  ├──> Đề xuất quán               └──> Đăng nhập (Google hoặc mã email) ──quay lại màn đang làm──┘
  │        └── cũng cần đăng nhập ──> Đăng nhập
  └──> Của tôi, Về dự án
```

Điểm rẽ duy nhất là đăng nhập, và nó chỉ xuất hiện khi người dùng muốn viết đánh giá hoặc đề xuất quán.

### Màn 1: Bản đồ (trang chủ)

- **Thanh trên:** logo và linh vật nhỏ; ô tìm theo tên quán hoặc tên món (tìm trong dữ liệu của app, không gọi API); chip chọn cụm trường, ví dụ "Quanh: ĐH Bách khoa ▾".
- **Hàng bộ lọc cuộn ngang:** "Dưới 30k", "30–50k", "Đang mở", rồi các loại món có biểu tượng (mục 5).
- **Bản đồ toàn màn:** mỗi quán là một biểu tượng theo loại món. Thu nhỏ bản đồ thì các quán gần nhau gộp thành một cụm có số. Nút "Vị trí của tôi" chỉ xin quyền GPS khi được bấm.
- **Chạm vào biểu tượng:** hiện thẻ xem nhanh ở đáy gồm ảnh, tên, giá thật, điểm, khoảng cách và nút "Xem quán".
- **Ngăn kéo từ đáy lên:** danh sách các quán đang hiện trên bản đồ, sắp theo khoảng cách hoặc theo điểm. Nút "Bản đồ / Danh sách" chuyển hẳn sang chế độ danh sách.
- **Không có kết quả:** linh vật và câu "Chưa có quán nào khớp, thử bỏ bớt bộ lọc nhé".

### Màn 2: Chi tiết quán

- **Ảnh bìa:** ảnh thật mới nhất, nhãn "Ảnh thật · 3 ngày trước".
- **Thông tin:** tên, loại món, địa chỉ, khoảng cách, "Đang mở · đóng lúc 21:00".
- **Khối điểm, hai dòng tách biệt:** dòng lớn "Quán Quen 4,6★ (23 đánh giá)"; dòng nhỏ "Google 4,3★ (1.204)" có ghi nguồn. Không gộp hai điểm thành một (mục 10).
- **Giá thật:** "Thường 35k · từ 30k đến 45k · theo 18 người đã ăn".
- **Món được nhắc nhiều:** các chip như "Bún chả (12)", "Nem (5)".
- **Lưới ảnh thật,** rồi **danh sách đánh giá** mới nhất trước. Mỗi đánh giá gồm tên hiển thị, huy hiệu "Đã check-in", số sao, giá đã trả, món, một câu, ảnh, ngày và nút "Báo cáo".
- **Thanh đáy cố định:** "Chỉ đường" (mở Google Maps), "Viết đánh giá", biểu tượng chia sẻ.

### Màn 3: Viết đánh giá

1. **Check-in:** app lấy vị trí. Cách quán trong 150 m thì hiện "Bạn đang ở quán" và cho viết tiếp. Xa hơn thì giải thích lý do và không cho gửi.
2. **Nội dung, trên cùng một màn:**
   - Sao 1–5, hiển thị bằng 5 khuôn mặt.
   - Giá đã trả: bàn phím số, có nút gợi ý 25k, 30k, 35k, 40k.
   - Món đã ăn: chọn từ chip có sẵn hoặc gõ thêm.
   - Một câu nhận xét, tối đa 200 ký tự.
   - Tối đa 3 ảnh, chụp trực tiếp hoặc chọn từ máy.
3. **Gửi:** đánh giá hiện ngay, linh vật nói "Cảm ơn thổ địa!". Mỗi người chỉ được đánh giá mỗi quán một lần mỗi ngày.

### Màn 4: Đăng nhập (tấm trượt lên)

- Hai lựa chọn: "Tiếp tục với Google" và "Nhận mã qua email".
- Google chặn đăng nhập bên trong trình duyệt của Facebook và Zalo. Khi phát hiện đang ở trong hai trình duyệt này, app ẩn nút Google, để lựa chọn email lên đầu, và thêm dòng "Mở bằng Chrome/Safari" có nút sao chép link.
- Đăng nhập bằng email: nhập email, nhận mã 6 số, gõ mã ngay trong app. Cách này không cần rời trình duyệt.

### Màn 5: Đề xuất quán mới

- Các trường: tên quán, vị trí (kéo ghim trên bản đồ hoặc dùng vị trí hiện tại), loại món, khoảng giá, ảnh (không bắt buộc).
- Trạng thái "Chờ duyệt"; nhóm duyệt trong vòng 24 giờ.

### Màn 6: Của tôi và Về dự án

- **Của tôi:** các đánh giá đã viết, nút xóa từng đánh giá, đổi tên hiển thị, đăng xuất, xóa tài khoản.
- **Về dự án:** cách tính điểm và giá thật, nguồn dữ liệu, chính sách quyền riêng tư, thành viên nhóm, link fanpage, liên hệ báo lỗi.

## 5. Nhận diện hình ảnh

Bản đồ trông như một tấm bản đồ ẩm thực vẽ tay: nền nhạt, mọi điểm nhấn đều là biểu tượng món ăn của app. App ẩn nhãn cửa hàng và các điểm trên bản đồ gốc của Google, để biểu tượng không bị lẫn và bản đồ không quảng cáo quán khác.

**Biểu tượng theo loại món**

| Loại món | Biểu tượng | Màu nền của ghim |
| --- | --- | --- |
| Bún, phở, mì | Bát mì bốc khói | Vàng #F6C445 |
| Cơm | Bát cơm có mặt cười | Xanh lá #7BC67E |
| Bánh mì, xôi | Ổ bánh mì | Cam #E8A15A |
| Ăn vặt | Xiên que | Hồng #FF8FB1 |
| Trà sữa, đồ uống | Ly trân châu | Tím #B79CED |
| Cà phê học bài | Ly cà phê và quyển sách | Nâu #A47551 |
| Chè, tráng miệng | Cốc chè | Xanh ngọc #6CC5C0 |

Bộ biểu tượng lấy từ [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) của Microsoft, kiểu 3D dễ thương, giấy phép MIT. Nhớ kiểm tra lại giấy phép trong repo trước khi dùng. Loại nào không có hình phù hợp thì nhóm tự vẽ bằng SVG.

**Quy tắc vẽ ghim trên bản đồ**

- Ghim hình giọt nước 40 × 48 px, viền trắng 3 px, biểu tượng món ở giữa.
- Quán có điểm từ 4,5 và tối thiểu 5 đánh giá được thêm vương miện nhỏ.
- Quán đang đóng cửa thì mờ đi 50% và có hình mặt trăng nhỏ.
- Ghim đang được chọn phóng to 1,25 lần và nảy nhẹ trong 200 ms. Nếu máy bật chế độ giảm chuyển động thì không nảy.
- Thu nhỏ bản đồ thì các quán gộp thành cụm: hình tròn màu kem, có số quán và biểu tượng của loại món nhiều nhất trong cụm.

**Linh vật "Bé Bao"** (tên tạm) là một chiếc bánh bao có mặt, dùng 4 biểu cảm:

- **Vui:** khi gửi đánh giá thành công.
- **Đói:** khi đang tải.
- **Buồn:** khi không có kết quả hoặc bị lỗi.
- **Ngủ:** khi quán đã đóng cửa.

Mỗi biểu cảm là một file SVG dưới 10 KB.

**Màu, chữ và giọng văn**

- Nền kem #FFF8EF, chữ nâu đậm #3A2A1F.
- Nút chính màu cam đất #C2410C, chữ trắng. Không dùng cam pastel làm nền cho chữ trắng vì không đủ tương phản.
- Có chế độ tối: nền #1F1A17, chữ #F5EDE4. Bản đồ dùng bản phong cách tối tương ứng.
- Một font duy nhất: Be Vietnam Pro (Google Fonts, hiển thị tốt tiếng Việt), độ đậm 400, 600 và 800. Chữ thân bài 16 px, không chữ nào dưới 13 px.
- Bo góc 16 px cho thẻ, 999 px cho chip; bóng đổ nhẹ, một mức duy nhất.
- Giọng văn thân mật kiểu sinh viên, ví dụ "Đói chưa? Quanh đây có 12 quán dưới 50k nè". Thông báo lỗi vẫn phải nói rõ cần làm gì tiếp.

**Trợ năng (dễ thương nhưng phải đọc được)**

- Chữ đạt tương phản tối thiểu 4,5:1, vùng chạm tối thiểu 44 × 44 px.
- Không phân biệt loại món chỉ bằng màu; mỗi loại có hình dáng biểu tượng riêng.
- Mỗi ghim có nhãn đọc cho trình đọc màn hình, ví dụ "Bún chả Hương, 35 nghìn, 4,6 sao, cách 300 mét".
- Chế độ danh sách có đủ mọi thông tin của bản đồ, dành cho người không dùng được bản đồ.
- Ảnh tự có mô tả thay thế, ví dụ "Ảnh món tại Bún chả Hương, do Minh chụp ngày 08/10".

## 6. Dữ liệu

Toàn bộ dữ liệu của app nằm trong 6 bảng Postgres trên Supabase. Từ Google, app chỉ lưu `place_id`; điểm Google được lấy lại mỗi khi mở trang quán. Với khoảng 50 quán, app tải hết một lần (dưới 50 KB) rồi lọc ngay trên máy, không cần phân trang.

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| `areas` (cụm trường) | `id`, `name`, `center_lat`, `center_lng`, `radius_m` | 3–5 dòng, nhóm nhập tay |
| `places` (quán) | `id`, `google_place_id`, `name`, `category`, `lat`, `lng`, `address`, `area_id`, `price_min`, `price_max`, `opening_hours` (JSON theo thứ), `status` (chờ duyệt / hiện / ẩn), `created_by` | `price_min`, `price_max` là khoảng giá nhóm ghi lúc khảo sát |
| `reviews` (đánh giá) | `id`, `place_id`, `user_id`, `stars` (1–5), `price_paid` (đồng), `dishes` (mảng chữ), `comment` (≤ 200 ký tự), `checkin_distance_m`, `is_sample`, `status`, `created_at` | Mỗi người mỗi quán tối đa 1 đánh giá/ngày, chặn bằng chỉ mục duy nhất |
| `photos` (ảnh) | `id`, `review_id`, `place_id`, `storage_path`, `width`, `height`, `status` | File ảnh nằm trong Supabase Storage |
| `reports` (báo cáo) | `id`, `target_type` (đánh giá / ảnh), `target_id`, `user_id`, `reason` | Đủ 3 báo cáo thì nội dung tự ẩn |
| `profiles` | `id` (trùng tài khoản), `display_name` | Không bao giờ trả email ra ngoài |

**Các con số hiển thị** được tính bằng một view SQL `place_stats`, không lưu riêng:

- **Điểm Quán Quen:** trung bình số sao của các đánh giá đang hiện. Quán có dưới 3 đánh giá hiện chữ "Mới" thay cho điểm.
- **Giá thật:** trung vị của `price_paid`, kèm khoảng từ phân vị 25 đến phân vị 75. Quán có dưới 3 lượt báo giá thì hiện khoảng giá của nhóm, ghi là "giá tham khảo".
- **Bộ lọc "dưới 50k":** dùng giá thật nếu có, nếu chưa có thì dùng `price_max`.
- **Món được nhắc nhiều:** 3 món xuất hiện nhiều nhất trong `dishes`.

**Hai nguồn dữ liệu luôn tách riêng**

|  | Dữ liệu của app | Dữ liệu từ Google |
| --- | --- | --- |
| Gồm | Quán, giờ mở cửa, đánh giá, giá thật, ảnh | Điểm sao và số lượt đánh giá trên Google |
| Lưu ở đâu | Supabase, lưu lâu dài | Không lưu, chỉ giữ `place_id` |
| Khi không lấy được | App không có dữ liệu, hiện linh vật buồn và nút thử lại | Ẩn dòng điểm Google, thay bằng link "Xem trên Google Maps" |

**Cách nhập dữ liệu ban đầu**

1. Nhóm điền Google Sheet, mỗi quán một dòng với các cột giống bảng `places`.
2. Lấy tọa độ: chạm giữ vào quán trên Google Maps rồi sao chép tọa độ. Lấy `place_id` bằng công cụ Place ID Finder trong tài liệu của Google.
3. Xuất CSV, nhập vào bảng bằng chức năng "Import data from CSV" của Supabase.
4. Đánh giá và ảnh do nhóm gửi qua chính app khi đến ăn. Nhờ vậy luồng check-in được thử thật ngay trong tuần làm.

## 7. Kiến trúc kỹ thuật

App không có server riêng. Trình duyệt gọi thẳng ba dịch vụ có gói miễn phí: Vercel phục vụ file tĩnh, Google Maps vẽ bản đồ và trả điểm Google, Supabase giữ dữ liệu, tài khoản và ảnh. Quyền đọc ghi được kiểm soát bằng Row Level Security của Postgres, không phải bằng code ở frontend.

Sơ đồ kiến trúc (dạng chữ):

```text
Điện thoại người dùng (Chrome, Safari, Facebook, Zalo)
  └─ Web app Quán Quen (HTML, CSS, JS thuần; nén ảnh, check-in GPS; lưu tạm dữ liệu quán khi mất kết nối)
       ├─ tải trang ────────────> Vercel (file tĩnh, tự deploy khi push)  <── GitHub (mã nguồn)
       ├─ key khóa domain ──────> Google Maps Platform (Maps JS: bản đồ, ghim, gom cụm; Place: điểm Google, không lưu)
       └─ anon key + RLS ───────> Supabase (Auth: Google, mã email; Postgres + RLS, submit_review; Storage: ảnh WebP)
                                                                           <── UptimeRobot (ping 5 phút)
```

Mọi mũi tên đều xuất phát từ trình duyệt hoặc công cụ phụ. Không có máy chủ nào của nhóm cần vận hành trong mùa thi.

| Thành phần | Chọn | Lý do |
| --- | --- | --- |
| Frontend | Vite + JavaScript thuần (nếu nhóm quen React thì dùng React, thiết kế không đổi) | Nhẹ, build ra file tĩnh |
| Bản đồ | Google Maps JavaScript API, Advanced Markers, thư viện `@googlemaps/markerclusterer` | Ghim tùy biến bằng HTML/SVG; phong cách bản đồ cấu hình qua Map ID |
| Điểm Google | Lớp `Place` của Maps JS, `fetchFields` với ba trường `rating`, `userRatingCount`, `googleMapsURI` | Gọi từ trình duyệt bằng key đã khóa theo domain, không cần proxy |
| Dữ liệu và tài khoản | Supabase: Postgres, Auth (Google và mã qua email), Storage | Miễn phí, có sẵn đăng nhập và phân quyền theo dòng |
| Gửi đánh giá | Hàm Postgres `submit_review` gọi qua RPC | Kiểm tra khoảng cách check-in và giới hạn 1 đánh giá/ngày ngay trong database |
| Ảnh | Nén trên máy bằng canvas: cạnh dài tối đa 1280 px, WebP chất lượng 0,8 | Mỗi ảnh khoảng 150–250 KB; vẽ lại qua canvas cũng xóa luôn thông tin EXIF (có GPS nhà riêng) |
| Hosting | Vercel (gói Hobby), tên miền `.vercel.app` | Tự deploy mỗi lần push GitHub |
| Giám sát | UptimeRobot gọi 5 phút một lần vào một truy vấn đọc nhẹ | Báo khi app sập, đồng thời giữ Supabase không bị tạm dừng (dự án miễn phí bị tạm dừng sau một thời gian không hoạt động) |

**Chi phí và hạn mức.** Các con số dưới đây viết theo trí nhớ, cần mở trang giá chính thức kiểm lại ngày 05/10.

| Dịch vụ | Miễn phí khoảng | Giới hạn tự đặt |
| --- | --- | --- |
| Google Maps JS, lượt tải bản đồ | 10.000 lượt/tháng | 300 lượt/ngày trong Google Cloud Console |
| Google Place Details có trường `rating` | Khoảng 1.000 lượt/tháng | 30 lượt/ngày; vượt thì hiện link "Xem trên Google Maps" |
| Supabase Free | 500 MB database, 1 GB lưu trữ file | 1 GB chứa được khoảng 5.000 ảnh, dư cho mùa thi |
| Vercel Hobby | Đủ cho một web tĩnh nhỏ | Không cần |

Tài khoản Google Cloud cần thẻ thanh toán. Ngoài giới hạn lượt gọi, đặt thêm cảnh báo ngân sách ở mức 1 USD. Giới hạn lượt gọi mới thật sự chặn chi tiêu; cảnh báo ngân sách chỉ gửi email.

**Cấu trúc thư mục**

```text
quan-quen/
  index.html
  src/
    main.js         điều hướng giữa các màn
    map.js          bản đồ, ghim, gom cụm
    place.js        trang quán, điểm Google
    review.js       check-in, nén ảnh, gửi đánh giá
    supabase.js     tạo client, các truy vấn
    style.css
  public/icons/     biểu tượng món và linh vật (SVG)
  supabase/schema.sql   bảng, view, RLS, hàm submit_review
```

## 8. Đánh giá và ảnh

App giữ được chữ "thật" nhờ ba lớp. Thứ nhất, chỉ người đang ở quán mới được viết đánh giá. Thứ hai, database giới hạn số lượng và chặn quảng cáo. Thứ ba, cộng đồng báo cáo và nhóm duyệt mỗi ngày.

**Lớp 1: Check-in GPS**

- Trình duyệt lấy vị trí với độ chính xác cao, chờ tối đa 10 giây. Sai số trên 100 m thì báo "Ra chỗ thoáng hơn rồi thử lại nhé".
- Hàm `submit_review` tự tính khoảng cách từ vị trí người dùng đến quán. Khoảng cách trừ sai số vượt 150 m thì từ chối.
- Database chỉ lưu `checkin_distance_m`, không lưu tọa độ của người dùng.
- Giới hạn: vị trí gửi từ trình duyệt có thể bị làm giả. Trang Về dự án nói rõ đây là xác thực cơ bản, đủ chặn người viết bừa từ nhà.

**Lớp 2: Giới hạn trong database**

- Mỗi người: 1 đánh giá cho mỗi quán mỗi ngày, tối đa 10 đánh giá mỗi ngày.
- Mỗi đánh giá: tối đa 3 ảnh, chỉ nhận file ảnh, file gốc tối đa 10 MB trước khi nén.
- Chặn link, số điện thoại và danh sách từ tục trong phần nhận xét, để không ai dùng app để quảng cáo.
- Đánh giá mẫu (`is_sample`) không bao giờ được tính vào điểm hay giá thật.

**Lớp 3: Báo cáo và duyệt**

- Phần chữ của đánh giá hiện ngay sau khi gửi.
- Ảnh của tài khoản có dưới 2 đánh giá đã duyệt sẽ vào hàng chờ. Đổi lại, app chậm hơn một chút nhưng tránh được ảnh xấu lọt lên đúng lúc BTC đang chấm.
- Đủ 3 người khác nhau báo cáo thì nội dung tự ẩn, bằng trigger trong Postgres.
- Nhóm duyệt hàng chờ 2 lần mỗi ngày (12:00 và 21:00) ngay trong bảng dữ liệu của Supabase: khôi phục hoặc xóa.

**Ghi nhận người đóng góp.** Chân dung "thổ địa" ở mục 2 cần được ghi nhận, nên cạnh tên người viết có một huy hiệu tính từ số đánh giá đã hiện. Huy hiệu không cần thêm bảng dữ liệu nào:

| Số đánh giá | Huy hiệu |
| --- | --- |
| 1–4 | Mới đến |
| 5–14 | Hàng xóm |
| 15 trở lên | Thổ địa |

## 9. Chất lượng theo ISO/IEC 25010

Bản 2023 của ISO/IEC 25010 có 9 đặc tính chất lượng sản phẩm. Bảng dưới đây cho mỗi đặc tính một cách đáp ứng và một cách đo, để đưa thẳng vào trang Về dự án và caption. Nên đối chiếu lại tên các đặc tính với văn bản chuẩn trước khi nộp.

| Đặc tính | Quán Quen đáp ứng thế nào | Đo bằng gì, đạt khi nào |
| --- | --- | --- |
| Phù hợp chức năng | Đủ vòng tìm quán, xem, đi, đánh giá; giá thật là trung vị, không bị một giá bất thường kéo lệch | Chạy view `place_stats` trên bộ dữ liệu biết trước kết quả |
| Hiệu năng | JS và CSS của app dưới 150 KB (không tính script Google Maps); ảnh WebP, chỉ tải khi cuộn tới | Lighthouse mobile: LCP dưới 2,5 giây, điểm Performance từ 90 |
| Tương thích | Chạy trên Chrome Android, Safari iOS, trình duyệt trong Facebook và Zalo | Bảng thử thiết bị ở mục 11 qua hết |
| Khả năng tương tác (trước đây gọi là khả năng sử dụng) | Xem không cần đăng nhập, chế độ danh sách, tương phản 4,5:1 | 8/10 người thử tìm được quán trong 30 giây; Lighthouse Accessibility từ 90 |
| Tin cậy | Google lỗi thì chuyển sang danh sách; Supabase lỗi thì hiện dữ liệu đã lưu trên máy kèm giờ lưu | UptimeRobot không ghi nhận lần sập nào trong mùa thi |
| Bảo mật | Row Level Security trên mọi bảng; key Google khóa theo domain; không đưa service key ra frontend | Dùng anon key thử sửa đánh giá của người khác và gọi Maps từ domain lạ: cả hai phải bị từ chối |
| Bảo trì | Khoảng 6 file JS, toàn bộ cấu trúc database trong `schema.sql`, tự deploy từ GitHub | Người ngoài nhóm đọc README và chạy được app trong 15 phút |
| Linh hoạt (trước đây gọi là khả chuyển) | Thêm thành phố hoặc cụm trường chỉ cần thêm dòng vào `areas` và `places`, không sửa code | Demo thêm một cụm trường mới trong 5 phút |
| An toàn | Không lưu vị trí người dùng; xóa EXIF trong ảnh; ẩn nội dung khi bị báo cáo; không đánh giá vệ sinh an toàn thực phẩm thay cơ quan chức năng | Thả một ảnh có GPS vào app rồi kiểm tra file đã lưu không còn EXIF |

## 10. Quyền riêng tư, bảo mật, điều khoản Google

App chỉ thu những gì cần để hiện một đánh giá, và người dùng xóa được tất cả bằng một nút.

**Thu và không thu**

| Thu | Mục đích | Ai thấy |
| --- | --- | --- |
| Email | Đăng nhập | Chỉ người dùng và Supabase Auth |
| Tên hiển thị | Hiện cạnh đánh giá | Mọi người |
| Đánh giá, ảnh (đã xóa EXIF) | Nội dung của app | Mọi người |
| Khoảng cách lúc check-in | Hiện huy hiệu "Đã check-in" | Chỉ nhóm |

Không thu: tọa độ của người dùng, lịch sử duyệt, danh bạ, và không có công cụ phân tích hay quảng cáo của bên thứ ba.

- Tấm đăng nhập có một dòng đồng ý, kèm link tới trang chính sách quyền riêng tư viết bằng lời dễ hiểu.
- Việt Nam có quy định về bảo vệ dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP, và Luật Bảo vệ dữ liệu cá nhân có hiệu lực từ 2026). Nhóm cần đọc phần về sự đồng ý trước khi viết trang chính sách.
- "Xóa tài khoản" xóa luôn mọi đánh giá và ảnh của người đó, bằng ràng buộc `on delete cascade` trong database.

**Bảo mật**

- Bật Row Level Security trên cả 6 bảng:
  - Ai cũng đọc được dòng đang hiện.
  - Người dùng chỉ sửa hoặc xóa dòng của mình.
  - Muốn thêm đánh giá phải đi qua hàm `submit_review`.
- Kho ảnh: mỗi người chỉ được tải lên thư mục `<user_id>/` của mình; ai cũng xem được ảnh.
- Supabase anon key được thiết kế để công khai; service role key không bao giờ nằm trong code frontend hay trên GitHub.
- Key Google: giới hạn theo domain (domain thật và `localhost`), chỉ cho dùng Maps JavaScript API và Places API.
- Tài khoản Supabase và Google Cloud của nhóm bật xác thực 2 bước.

**Điều khoản Google Maps Platform**

Nhóm cần đọc bản gốc trước ngày 07/10. Các điểm dưới đây là cách thiết kế để an toàn:

- Điểm Google luôn có ghi nguồn "Google" bên cạnh, và không lưu vào database.
- Không gộp điểm Google với điểm của app, không sao chép hay cào đánh giá trên Google.
- Nút chỉ đường dùng link Google Maps URLs (`https://www.google.com/maps/dir/?api=1&destination=...`), không tốn phí.
- Ẩn các điểm của Google trên nền bản đồ bằng tính năng tùy biến phong cách mà Google cung cấp, không phủ lớp che lên bản đồ.

## 11. Kiểm thử

Phần lớn người dùng sẽ mở app từ bài đăng trên fanpage, tức là trong trình duyệt của Facebook. Vì vậy trình duyệt này được thử kỹ nhất.

**Ma trận thiết bị.** Mỗi ô phải chạy được mọi kịch bản ở dưới.

| Thiết bị | Chrome / Safari | Trong Facebook | Trong Zalo |
| --- | --- | --- | --- |
| Android tầm trung (2–3 GB RAM) | Bắt buộc | Bắt buộc | Bắt buộc |
| iPhone (iOS 16 trở lên) | Bắt buộc | Bắt buộc | Bắt buộc |
| Laptop (cho giám khảo mở) | Bắt buộc | Không cần | Không cần |

**Kịch bản thử**

- [ ] Mở app lần đầu trên mạng 4G yếu (giả lập "Slow 4G" trong DevTools): bản đồ hiện trong 3 giây.
- [ ] Từ chối quyền vị trí: bản đồ vẫn hiện ở cụm trường mặc định, không báo lỗi đỏ.
- [ ] Đăng nhập bằng mã email ngay trong trình duyệt của Facebook.
- [ ] Viết đánh giá khi đang ở quán thì gửi được; ở nhà thì bị từ chối kèm lời giải thích.
- [ ] Tải ảnh 8 MB chụp từ iPhone: file lưu trên Storage dưới 300 KB và không còn EXIF.
- [ ] Tắt key Google (hoặc chặn domain): app chuyển sang chế độ danh sách, không trắng trang.
- [ ] Dùng anon key gọi API xóa đánh giá của người khác: bị từ chối.
- [ ] Lighthouse mobile đạt từ 90 ở cả 4 mục.

**Thử với sinh viên (ngày 10/10, 5–10 người ngoài nhóm)**

1. Đưa link qua Messenger, không giải thích gì thêm.
2. Giao việc: "Tìm một quán bún dưới 40k đang mở gần trường và mở chỉ đường." Bấm giờ từ lúc mở link đến lúc bấm "Chỉ đường".
3. Hỏi 3 câu: Chỗ nào làm bạn khựng lại? Bạn có tin giá hiển thị không, vì sao? Bạn có gửi app cho bạn bè không?
4. Ghi lại thời gian trung vị và 3 câu nói hay nhất để dùng trong caption (xin phép trước khi trích).

## 12. Chiến lược tương tác trên fanpage

Mỗi comment vừa cộng 20 điểm vừa là một gợi ý quán mới cho bản đồ. Vì vậy toàn bộ chiến lược xoay quanh một vòng lặp: người xem gợi ý quán, nhóm đến ăn và thêm quán lên bản đồ, nhóm tag người gợi ý, người đó quay lại bài để react và share.

Theo thể lệ: react +10, comment +20, share +50. Chỉ tính tương tác của tài khoản có follow fanpage, và BTC kiểm tra từng lượt.

**Cơ chế trong app**

- Nút "Chia sẻ Quán Quen" trong app trỏ về bài dự thi trên fanpage, không trỏ về link app, và có dòng nhắc "Nhớ follow fanpage nhé".
- Nút chia sẻ từng quán vẫn gửi link quán, vì đây là tính năng thật người dùng cần khi rủ bạn đi ăn.
- Trang quán do người xem gợi ý ghi "Gợi ý bởi \[tên\]". Đây là lý do để người đó khoe với bạn bè.

**Kịch bản sau khi bài lên fanpage**

1. **Giờ đầu:** mỗi thành viên nhóm gửi bài vào nhóm lớp và nhóm ký túc xá mình đang tham gia, kèm một câu hỏi thật: "Quán nào quanh trường mình xứng được lên bản đồ?"
2. **Mỗi ngày:** nhóm trả lời mọi comment trong 2 giờ. Mỗi quán được thêm lên bản đồ thì reply "Đã thêm \[quán\], cảm ơn \[tag người gợi ý\]".
3. **Cuối tuần:** comment cập nhật kèm ảnh: "Tuần này bản đồ có thêm 12 quán do các bạn gợi ý".

**Bản nháp caption**

> Ăn trưa quanh trường mà vẫn được dưới 50k? Có đấy, nhưng không nằm trong mấy bài quảng cáo đâu.
>
> Quán Quen là bản đồ ăn ngon giá sinh viên quanh \[cụm trường\], do chính sinh viên chấm điểm. Muốn đánh giá phải check-in tại quán. Giá hiển thị là giá người ăn thật đã trả. Ảnh là ảnh chụp tại bàn, không phải ảnh studio.
>
> Nhóm tự đi ăn \[X\] quán trong 7 ngày để làm bản đồ đầu tiên. Giờ đến lượt bạn: Comment tên quán ruột của bạn, nhóm sẽ đến ăn thử và đưa lên bản đồ, ghi tên bạn là người gợi ý. Share về nhóm lớp để cả lớp có bản đồ ăn rẻ. (Nhớ follow fanpage để lượt tương tác được tính nhé.)

**Ảnh nộp kèm (4 ảnh)**

1. Bản đồ đầy biểu tượng món ăn: ảnh chính, dùng để thu hút người xem.
2. Trang quán có dòng "Giá thật: 35k" và hai điểm đặt cạnh nhau.
3. Màn check-in "Bạn đang ở quán".
4. Linh vật Bé Bao và bộ biểu tượng.

**Không làm**

- Không mua like, không dùng tài khoản phụ.
- Không tham gia nhóm "đổi tương tác".
- Không comment vào bài của đội khác.
- Không đăng trùng một nội dung vào nhiều nhóm trong vài phút.

Thể lệ hủy bài khi bị cảnh cáo quá 2 lần, và hủy quyền dự thi nếu gian lận.

## 13. Kế hoạch 05–12/10

Ngày 10/10 có bản chạy được để thử với sinh viên, ngày 12/10 nộp bài. Việc đi ăn và chụp ảnh chạy song song suốt 5 ngày, vì đây là nguồn dữ liệu thật duy nhất.

**Phân vai (nhóm 3 người)**

| Vai | Phụ trách | Cùng làm |
| --- | --- | --- |
| Giao diện và bản đồ | 6 màn hình, ghim, bộ lọc, chế độ danh sách, Lighthouse | Đi ăn và đánh giá khoảng 10 quán |
| Dữ liệu và backend | Supabase, `schema.sql`, RLS, `submit_review`, đăng nhập, nhập dữ liệu, key Google | Đi ăn và đánh giá khoảng 10 quán |
| Nội dung và truyền thông | Biểu tượng, linh vật, trang Về dự án, buổi thử, caption, ảnh nộp | Đi ăn và đánh giá khoảng 10 quán |

**Đầu ra từng ngày**

- [ ] **05/10:** chốt tên, thành phố và 3–5 cụm trường. Tạo Google Cloud (billing, key, Map ID, giới hạn lượt gọi) và dự án Supabase. Sheet có 40 quán ứng viên.
- [ ] **06/10:** `schema.sql` gồm bảng, view, RLS. Bản đồ hiện ghim từ dữ liệu thật, lọc được. Bộ biểu tượng và linh vật xong. Bắt đầu đi ăn.
- [ ] **07/10:** trang quán có điểm Google; đăng nhập bằng Google và bằng mã email hoạt động. Đã đọc điều khoản Google Maps Platform. Deploy bản đầu lên Vercel.
- [ ] **08/10:** viết đánh giá có check-in, nén ảnh, `submit_review`, báo cáo, đề xuất quán.
- [ ] **09/10:** hoàn thiện giao diện, chế độ danh sách, các trường hợp lỗi. Trang Về dự án và chính sách quyền riêng tư. Chạy hết ma trận thiết bị.
- [ ] **10/10:** thử với 5–10 sinh viên, sửa các lỗi họ gặp. Có tối thiểu 30 quán có ảnh thật.
- [ ] **11/10:** Lighthouse từ 90. Ảnh xem trước khi dán link. Xóa hết đánh giá mẫu. Bật UptimeRobot. Chụp 4 ảnh nộp, chốt caption.
- [ ] **12/10:** nộp bài qua form của BTC. Từ đây chỉ sửa lỗi, không thêm tính năng.

## 14. Rủi ro, dự phòng, câu hỏi còn mở

Rủi ro lớn nhất là app ngừng chạy giữa mùa thi, vì theo thể lệ như vậy là mất bài. Mọi rủi ro dưới đây đều có phương án xử lý mà không phải viết lại app. Bảng xếp theo mức độ nghiêm trọng, nặng nhất trước.

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| Nhóm không có thẻ để mở billing Google Cloud | Biết ngay ngày 05/10 | Đổi sang Leaflet và nền bản đồ miễn phí có ghi nguồn (ví dụ CARTO Voyager trên dữ liệu OpenStreetMap). Ghim, biểu tượng và luồng giữ nguyên. Bỏ điểm Google, thay bằng link "Xem trên Google Maps" |
| Hết hạn mức Google khi bài được chia sẻ mạnh | Console báo chạm giới hạn ngày | Giới hạn lượt gọi đã chặn chi tiêu. App tự chuyển sang chế độ danh sách và ẩn điểm Google |
| Email mã đăng nhập không tới | Dịch vụ email mặc định của Supabase chỉ gửi vài email mỗi giờ, dành cho thử nghiệm | Cấu hình SMTP riêng qua gói miễn phí của Resend hoặc Brevo ngay ngày 07/10 |
| Ảnh hoặc lời lẽ xấu lọt lên đúng lúc BTC chấm | Có báo cáo, hoặc phát hiện khi duyệt | Hàng chờ ảnh cho tài khoản mới, tự ẩn khi đủ 3 báo cáo, duyệt 2 lần mỗi ngày |
| Supabase bị tạm dừng hoặc sập | UptimeRobot báo | Ping định kỳ giữ dự án hoạt động. App hiện dữ liệu đã lưu trên máy kèm giờ lưu |
| Không đi ăn đủ 30 quán | Ngày 08/10 có dưới 15 quán | Thu về 2 cụm trường. 20 quán thật tốt hơn 50 quán có dữ liệu rỗng |
| Chủ quán phản đối đánh giá tiêu cực | Có tin nhắn hoặc comment | Quy định chỉ đánh giá trải nghiệm, không xúc phạm. Có kênh liên hệ trên trang Về dự án. Nhóm trả lời trong 24 giờ |
| Trùng ý tưởng với đội làm đề du lịch | Thấy bài tương tự trên fanpage | Caption và ảnh đầu tiên nhấn vào "giá thật" và "phải check-in mới được đánh giá" |

**Câu hỏi còn mở (cần trả lời trong ngày 05/10)**

- [x] Thành phố nào, những cụm trường nào?
- [ ] Tên chính thức có giữ "Quán Quen" và linh vật "Bé Bao" không?
- [x] Nhóm có thẻ để mở billing Google Cloud không? Câu này quyết định dùng Google Maps hay Leaflet.
- [x] Nhóm quen React hay JavaScript thuần?
- [ ] Giữ ngưỡng 50k, hay đổi theo mặt bằng giá của thành phố đã chọn?

Nguồn: thể lệ cuộc thi "From Idea to Impact" do bạn cung cấp. Tài liệu này chưa tra cứu trực tuyến: các con số về giá, hạn mức và điều khoản của Google, Supabase, Vercel là viết theo trí nhớ, cần kiểm lại trên trang chính thức.
