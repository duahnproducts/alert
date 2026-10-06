# Hometown: Thiết kế sản phẩm

Bản trong repo là **bản chuẩn**, cập nhật ngày 05/10/2026: các con số về hạn mức, giá và quy định đã được kiểm trên trang chính thức (nguồn ở cuối tài liệu), và đã thống nhất với [phương án kỹ thuật](quan-quen-ky-thuat.md). Bản nháp đầu tiên (có sơ đồ vẽ) nằm trên Claude Docs, có thể cũ hơn bản này: https://claude.ai/code/artifact/eb3e82df-65aa-44b2-8470-35029f08e2e5

**Cập nhật 06/10/2026: bản đồ chibi tự vẽ, không dùng Google Maps.** Không có thẻ để mở thanh toán Google Cloud, nên app làm theo phương án B (rủi ro đầu tiên ở mục 14). App tự vẽ bản đồ kiểu chibi (màu kẹo, đường to bo tròn, ghim tròn phồng) từ dữ liệu miễn phí của OpenFreeMap, không cần key. Máy chủ chính của OpenStreetMap (`openstreetmap.org`) không kết nối được từ mạng ở Việt Nam (kiểm ngày 06/10/2026), nên không dùng. Trang quán không còn dòng điểm Google; thay bằng link "Xem đánh giá trên Google Maps". Nút "Chỉ đường" ban đầu mở Google Maps qua link; nay mở trang chỉ đường ngay trong app (Màn 2), Google Maps còn làm nút dự phòng. Đăng nhập bằng Google vẫn giữ: OAuth của Google không cần thanh toán. Các mục dưới đây đã sửa theo quyết định này.

Tài liệu này mô tả sản phẩm làm gì và vì sao. Cách làm cụ thể (SQL, cấu hình dịch vụ, cấu trúc code) nằm trong phương án kỹ thuật.

## 1. Tóm tắt

Hometown là bản đồ các quán ăn ngon dưới 50k quanh các trường đại học ở Hà Nội và TP. Hồ Chí Minh. Sinh viên và người dân địa phương chấm điểm, báo giá thật và chụp ảnh thật; mỗi quán hiện trên bản đồ bằng một biểu tượng dễ thương.

- **Cho ai:** sinh viên 18–24 tuổi, đặc biệt là tân sinh viên mới lên thành phố, chưa biết ăn ở đâu và phải tiêu tiền kỹ.
- **Lời hứa:** quán ngon vì người ăn thật nói ngon, không phải vì được quảng cáo.
- **Phạm vi dự thi:** hai thành phố (Hà Nội, TP. Hồ Chí Minh), 3–5 cụm trường, 30–50 quán do nhóm tự đi ăn và chụp.

|  | Google Maps | Foody / ShopeeFood | Hometown |
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

1. **11:30, giữa hai ca học, có 15 phút.** Mở app ở cổng trường, lọc "đang mở cửa", xếp theo gần nhất hoặc rẻ nhất, chọn quán.
2. **21:00, đi làm thêm về.** Tìm quán còn mở trên đường về trọ.
3. **Cuối tuần rủ bạn đi ăn.** Lướt bản đồ tìm quán có ảnh đẹp, gửi link quán vào nhóm chat; ăn xong thì viết đánh giá ngay tại bàn.

## 3. Phạm vi bản dự thi

Bản dự thi là một web app chạy trên điện thoại, có bản đồ, trang quán và chức năng viết đánh giá có check-in. Mọi thứ khác để sau cuộc thi.

**Làm**

- Bản đồ có biểu tượng theo loại món; lọc theo loại món, "đang mở cửa"; xếp theo gần nhất, điểm cao hoặc rẻ nhất; chọn thành phố (Hà Nội / TP. Hồ Chí Minh).
- Chế độ danh sách, thay cho bản đồ khi bản đồ lỗi hoặc người dùng dùng trình đọc màn hình.
- Trang quán: ảnh thật, giá thật, điểm của app, link xem đánh giá trên Google Maps, giờ mở cửa, chỉ đường, chia sẻ.
- Đăng nhập Google, chỉ bắt buộc khi viết đánh giá.
- Viết đánh giá: check-in GPS, số sao, giá đã trả, món đã ăn, một câu nhận xét, tối đa 3 ảnh.
- Đề xuất quán mới; nhóm duyệt rồi mới lên bản đồ.
- Nút báo cáo đánh giá hoặc ảnh sai.
- 100 địa danh nổi tiếng của Hà Nội và TP. Hồ Chí Minh trên bản đồ: ghim vàng, icon theo loại (chùa đền, nhà thờ, bảo tàng, hồ, công viên, sở thú, cầu, cao ốc, nhà hát, sân vận động, chợ, dinh thự, bưu điện, khách sạn, phố, tượng đài), bật/tắt bằng chip "Địa danh". Thu nhỏ bản đồ chỉ hiện các địa danh nổi tiếng nhất, phóng to dần hiện thêm. Bấm vào thì hiện ảnh chụp thật, mô tả ngắn, tên tác giả và giấy phép của ảnh, quán ngon trong vòng 2 km và nút chỉ đường. Dữ liệu lấy từ Wikidata, Wikipedia tiếng Việt và Wikimedia Commons (xem mục 6), không lấy từ Google.
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
- **Bản demo (chốt 06/10/2026):** trong lúc chưa có người dùng thật, app chạy bản demo có nhãn: khoảng 200 quán **tên tự đặt** (cố ý không trùng quán thật), mỗi thành phố 100 quán rải đều khắp nội thành, mỗi quán vài đánh giá mẫu, mỗi địa danh vài câu cảm nhận mẫu. Đầu mọi trang có dải "Bản demo: quán và đánh giá là minh họa", mỗi đánh giá có nhãn "Mẫu", giá ghi "Giá mẫu", điểm ghi "đánh giá mẫu"; quán minh họa vẫn có chỉ đường để giám khảo xem thử, trang chỉ đường ghi rõ "Quán minh họa, không có thật ở vị trí này" (chốt 06/10/2026: bài dự thi, chưa có người dùng thật). Đăng nhập, viết đánh giá, đề xuất quán hiện thông báo "bản demo chưa mở". Khi nối Supabase, app tự chuyển sang dữ liệu thật. Không tạo đánh giá giả trông như thật: như vậy là nói sai về quán có thật và đi ngược lời hứa "đánh giá thật" của app.

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

- **Thanh trên:** logo và linh vật nhỏ; ô tìm theo tên quán hoặc tên món (tìm trong dữ liệu của app, không gọi API); chip thành phố ("Hà Nội ▾"), không có ô chọn cụm trường. Lần đầu mở app hỏi "Bạn đang ở đâu?" (Hà Nội / TP. Hồ Chí Minh), chọn xong mới hiện bản đồ thành phố đó, mở ra là nội thành phủ kín màn hình; bản đồ chỉ kéo trong nội thành, không ra tỉnh lân cận.
- **Hàng bộ lọc cuộn ngang:** chọn thành phố, "Đang mở", "Địa danh", rồi các loại món có biểu tượng (mục 5). Không có nút lọc giá (bỏ ngày 06/10/2026); muốn tìm quán rẻ thì xếp theo "rẻ nhất" trong ngăn kéo danh sách.
- **Bản đồ toàn màn:** mỗi quán là một biểu tượng theo loại món. Thu nhỏ bản đồ thì các quán gần nhau gộp thành một cụm có số. Nút "Vị trí của tôi" chỉ xin quyền GPS khi được bấm.
- **Thẻ "Gợi ý quanh bạn"** (nổi trên mép ngăn kéo; laptop và chế độ danh sách thì nằm đầu danh sách):
  - Chưa có vị trí: Bao mời "Đói chưa? Cho Bao biết bạn đang ở đâu nhé", ghi rõ vị trí chỉ dùng trên máy, không lưu, không gửi đi; nút "Chia sẻ vị trí". App chỉ xin quyền GPS khi người dùng bấm nút này hoặc nút "Vị trí của tôi". Đã cho phép từ lần trước thì app tự lấy vị trí, không hỏi lại.
  - **Vị trí mặc định** (chốt 06/10/2026): chưa chia sẻ (bấm "Để sau" ở thẻ mời) hoặc đã chặn vị trí thì app coi như bạn đang ở ĐH Kinh tế Quốc dân (đang chọn Hà Nội) hoặc ĐH Kinh tế TP.HCM (đang chọn TP.HCM). Khoảng cách trong danh sách, thẻ xem nhanh, trang quán ("Cách 450 m từ ĐH Kinh tế Quốc dân") và cách xếp "gần nhất" đều tính từ đó. Thẻ đổi thành "Gợi ý quanh ĐH Kinh tế Quốc dân" kèm dòng "Bạn chưa chia sẻ vị trí nên Bao tạm tính khoảng cách từ đây" và nút "Dùng vị trí của tôi"; tìm trong 5 km (vị trí mặc định chỉ là ước lượng). Đã chia sẻ vị trí nhưng đang xem thành phố kia (vd ở Hà Nội mà chọn TP.HCM) thì cũng tính từ vị trí mặc định của thành phố đang xem, thẻ ghi "Bạn đang ở ngoài TP. Hồ Chí Minh nên Bao tính khoảng cách từ đây", không hiện khoảng cách hơn 1.000 km. Bản đồ vẫn mở ra phủ kín nội thành như cũ.
  - Có vị trí: đang đứng ở thành phố kia thì đổi thành phố; Bao trên bản đồ đi theo bạn theo thời gian thực (bản đồ không tự kéo theo; bấm "Vị trí của tôi" để về chỗ bạn); xếp danh sách theo khoảng cách (tính lại mỗi khi bạn đi thêm 30 m), và thẻ gợi ý 3 quán trong 2 km, không đang đóng cửa, theo các bộ lọc đang bật. Thứ tự: số sao trừ khoảng cách, mỗi km trừ 1 sao; quán dưới 3 đánh giá tính 3,5 sao. Không có quán nào thì nói rõ cần bỏ bớt bộ lọc hoặc kéo bản đồ.
  - Chạm ghim thì thẻ xem nhanh thế chỗ; bấm × ở thẻ mời là "Để sau" (chuyển sang gợi ý quanh vị trí mặc định), bấm × ở thẻ gợi ý thì ẩn thẻ.
- **Chạm vào biểu tượng:** hiện thẻ xem nhanh ở đáy gồm ảnh, tên, giá thật, điểm, khoảng cách và nút "Xem quán".
- **Ngăn kéo từ đáy lên:** danh sách các quán đang hiện trên bản đồ, sắp theo khoảng cách hoặc theo điểm. Nút "Bản đồ / Danh sách" chuyển hẳn sang chế độ danh sách.
- **Không có kết quả:** linh vật và câu "Chưa có quán nào khớp, thử bỏ bớt bộ lọc nhé".

### Màn 2: Chi tiết quán

- **Ảnh bìa:** ảnh thật mới nhất, nhãn "Ảnh thật · 3 ngày trước". Quán chưa có ảnh thật thì hiện tranh vẽ quán vỉa hè theo loại món, nhãn "Hình minh họa · chưa có ảnh thật". Không dùng ảnh do máy tạo trông như ảnh chụp, vì như vậy là bịa "ảnh thật".
- **Thông tin:** tên, loại món, địa chỉ, khoảng cách, "Đang mở · đóng lúc 21:00".
- **Khối điểm:** dòng lớn "Hometown 4,6★ (23 đánh giá)"; dòng nhỏ là link "Xem đánh giá trên Google Maps". App không lấy và không hiện điểm Google (mục 10).
- **Giá thật:** "Thường 35k · từ 30k đến 45k · theo 18 người đã ăn".
- **Món được nhắc nhiều:** các chip như "Bún chả (12)", "Nem (5)".
- **Lưới ảnh thật,** rồi **danh sách đánh giá** mới nhất trước. Mỗi đánh giá gồm tên hiển thị, huy hiệu "Đã check-in", số sao, giá đã trả, món, một câu, ảnh, ngày và nút "Báo cáo".
- **Thanh đáy cố định:** "Chỉ đường", "Viết đánh giá", biểu tượng chia sẻ.
- **Chỉ đường ngay trong app** (`/quan/:id/chi-duong`), không phải rời sang Google Maps:
  - Chọn "Xe máy", "Ô tô" hoặc "Đi bộ", mỗi nút có icon chibi tự vẽ (xe tay ga hồng, ô tô vàng, bạn sinh viên đeo ba lô); mặc định đi bộ nếu quán cách dưới 1,5 km. Dòng tóm tắt kèm giờ tới nơi: "1,2 km · khoảng 15 phút đi bộ · tới nơi lúc 12:45"; đang đi thì giờ tới nơi tính lại theo phần đường còn lại. Chọn cách đi nào thì icon đó chạy dọc tuyến từ chỗ bạn tới quán trong vài giây, nét đường mọc dần phía sau như animation máy bay bay trên bản đồ, rồi mờ đi khi tới quán. Bản đồ có đường đi, ghim quán và Bao ở vị trí của bạn, rồi danh sách từng bước bằng tiếng Việt ("Rẽ phải vào Phố Giảng Võ · 230 m").
  - Bao đi theo vị trí thật của bạn. Bản đồ giữ khung cả tuyến, chỉ dời khi Bao sắp ra khỏi khung; bạn tự kéo hoặc zoom thì bản đồ để yên 15 giây cho bạn xem.
  - Đi lệch khỏi đường quá 40 m (hoặc quá sai số GPS lúc đó) thì Bao báo "Bạn đi khác đường rồi" và tự tìm đường mới từ chỗ bạn đứng, tối đa 30 giây một lần.
  - Người dùng đã tự chọn xe máy, ô tô hay đi bộ thì app giữ lựa chọn đó khi vẽ lại đường; chưa chọn thì app tự chọn theo quãng đường (dưới 1,5 km là đi bộ). Cách quán dưới 50 m thì hiện "Tới nơi rồi! Chúc bạn ăn ngon" và nút "Ăn xong viết đánh giá".
  - Ghi rõ trên trang: để vẽ đường, vị trí của bạn và của quán được gửi tới máy chủ tìm đường của FOSSGIS (Đức); app không lưu vị trí. Kèm ghi nguồn OpenStreetMap và link "Sửa bản đồ" (điều kiện dùng máy chủ).
  - Bản demo: quán minh họa vẫn có "Chỉ đường" để xem thử tính năng; đầu trang ghi "Quán minh họa, không có thật ở vị trí này: đường đi chỉ để xem thử tính năng".
  - **Điểm xuất phát dự phòng** (chốt 06/10/2026): bị từ chối vị trí, không lấy được vị trí, hoặc bạn cách quán trên 30 km (thường là máy tính đoán sai vị trí) thì đường vẽ từ ĐH Kinh tế Quốc dân (quán ở Hà Nội) hoặc ĐH Kinh tế TP.HCM (quán ở TP.HCM), kèm một dòng nói rõ lý do, ví dụ "Bạn chưa cho phép vị trí nên Bao chỉ đường từ ĐH Kinh tế Quốc dân. Muốn đi từ chỗ bạn thì cho phép vị trí cho trang này rồi tải lại nhé". Nhờ vậy trang luôn có đường, giám khảo mở trên laptop hay ở xa vẫn xem được. Sau đó lấy được vị trí gần quán thì vẽ lại từ chỗ bạn.
  - Luôn có nút "Mở bằng Google Maps". Máy chủ tìm đường lỗi thì nói rõ và chỉ sang nút này.

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
- Google chặn đăng nhập bên trong trình duyệt của Facebook, Messenger, Instagram và Zalo (lỗi `403 disallowed_useragent`); code của app không vượt qua được. Khi phát hiện đang ở trong các trình duyệt này, app ẩn nút Google, để lựa chọn email lên đầu, và thêm dòng "Mở bằng Chrome/Safari". Trên Android, nút này mở thẳng Chrome; trên iPhone, nút này sao chép link.
- Đăng nhập bằng email: nhập email, nhận mã 6 số, gõ mã ngay trong app. Cách này không cần rời trình duyệt.

### Màn 5: Đề xuất quán mới

- Các trường: tên quán, vị trí (kéo ghim trên bản đồ hoặc dùng vị trí hiện tại), loại món, khoảng giá, ảnh (không bắt buộc).
- Trạng thái "Chờ duyệt"; nhóm duyệt trong vòng 24 giờ.

### Màn 6: Của tôi và Về dự án

- **Của tôi:** các đánh giá đã viết, nút xóa từng đánh giá, đổi tên hiển thị, đăng xuất, xóa tài khoản.
- **Về dự án:** cách tính điểm và giá thật, nguồn dữ liệu, chính sách quyền riêng tư, thành viên nhóm, link fanpage, liên hệ báo lỗi.

## 5. Nhận diện hình ảnh

Bản đồ trông như một tấm bản đồ ẩm thực vẽ tay kiểu chibi: nền kem, khuôn viên trường màu lavender, công viên xanh mint, hồ nước xanh baby có viền, đường trắng dày bo tròn, chữ tròn trịa có viền trắng. Bản đồ không vẽ biểu tượng cửa hàng, nên mọi điểm nhấn đều là biểu tượng món ăn của app và bản đồ không quảng cáo quán khác. Chế độ tối là bản đồ "ban đêm" tím đậm.

**Biểu tượng theo loại món**

| Loại món | Mã trong database | Biểu tượng | Màu nền của ghim |
| --- | --- | --- | --- |
| Bún, phở, mì | `bun_pho_mi` | Bát phở bốc khói, có đũa | Vàng #F6C445 |
| Cơm | `com` | Bát cơm xanh, cơm trắng đầy ngọn | Xanh lá #7BC67E |
| Bánh mì, xôi | `banh_mi_xoi` | Ổ bánh mì nằm nghiêng | Cam #E8A15A |
| Ăn vặt | `an_vat` | Xiên que ba viên | Hồng #FF8FB1 |
| Trà sữa, đồ uống | `do_uong` | Ly trà sữa trân châu có ống hút | Tím #B79CED |
| Cà phê học bài | `ca_phe` | Tách cà phê có phin | Nâu #A47551 |
| Chè, tráng miệng | `che` | Cốc chè ba lớp có đá | Xanh ngọc #6CC5C0 |

Bộ biểu tượng do nhóm tự vẽ (cập nhật 06/10/2026, thay cho Fluent Emoji): 7 biểu tượng món và 17 biểu tượng địa danh, cùng một phong cách với Bao. Viền nâu đậm #3A2A1F bo tròn, màu kẹo pastel, và mỗi hình có khuôn mặt chibi (mắt tròn có đốm sáng, má hồng, miệng cười). Mỗi hình là một file SVG 64 × 64 khoảng 1–2 KB trong `public/icons/`, nét ở mọi cỡ màn hình, không cần ghi nguồn hay giấy phép của bên ngoài.

**Quy tắc vẽ ghim trên bản đồ**

- Ghim hình giọt nước 40 × 48 px, viền trắng 3 px, biểu tượng món ở giữa.
- Quán có điểm từ 4,5 và tối thiểu 5 đánh giá được thêm vương miện nhỏ.
- Quán đang đóng cửa thì mờ đi 50% và có hình mặt trăng nhỏ.
- Ghim đang được chọn phóng to 1,25 lần và nảy nhẹ trong 200 ms. Nếu máy bật chế độ giảm chuyển động thì không nảy.
- Thu nhỏ bản đồ thì các quán gộp thành cụm: hình tròn màu kem, có số quán và biểu tượng của loại món nhiều nhất trong cụm.

**Linh vật "Bao"** là một chiếc bánh bao có mặt, dùng 4 biểu cảm:

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

Toàn bộ dữ liệu của app nằm trong 6 bảng Postgres trên Supabase. Từ Google, app chỉ lưu `place_id` (không bắt buộc) để link "Mở bằng Google Maps" (trang chỉ đường) và "Xem đánh giá trên Google Maps" mở đúng quán; app không lấy điểm Google. Với khoảng 50 quán, app tải hết một lần (dưới 50 KB) rồi lọc ngay trên máy, không cần phân trang.

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| `areas` (cụm trường) | `id`, `name`, `center_lat`, `center_lng`, `radius_m` | 3–5 dòng, nhóm nhập tay |
| `places` (quán) | `id`, `google_place_id`, `name`, `category`, `lat`, `lng`, `address`, `area_id`, `price_min`, `price_max`, `opening_hours` (JSON theo thứ), `status` (chờ duyệt / hiện / ẩn), `created_by`, `suggested_by_name` | `price_min`, `price_max` là khoảng giá nhóm ghi lúc khảo sát. `suggested_by_name` là tên người gợi ý quán qua comment fanpage (họ không có tài khoản trong app) |
| `reviews` (đánh giá) | `id`, `place_id`, `user_id`, `stars` (1–5), `price_paid` (đồng), `dishes` (mảng chữ), `comment` (≤ 200 ký tự), `checkin_distance_m`, `is_sample`, `status`, `review_date`, `created_at` | Mỗi người mỗi quán tối đa 1 đánh giá/ngày, chặn bằng chỉ mục duy nhất trên `review_date` (ngày theo giờ Việt Nam). `checkin_distance_m` không bao giờ được trả ra ngoài |
| `photos` (ảnh) | `id`, `review_id`, `place_id`, `storage_path`, `width`, `height`, `status` | File ảnh nằm trong Supabase Storage |
| `reports` (báo cáo) | `id`, `target_type` (đánh giá / ảnh), `target_id`, `user_id`, `reason` | Đủ 3 báo cáo thì nội dung tự ẩn |
| `profiles` | `id` (trùng tài khoản), `display_name` | Không bao giờ trả email ra ngoài |

**Các con số hiển thị** được tính bằng một view SQL `place_stats`, không lưu riêng:

- **Điểm Hometown:** trung bình số sao của các đánh giá đang hiện. Quán có dưới 3 đánh giá hiện chữ "Mới" thay cho điểm.
- **Giá thật:** trung vị của `price_paid`, kèm khoảng từ phân vị 25 đến phân vị 75. Quán có dưới 3 lượt báo giá thì hiện khoảng giá của nhóm, ghi là "giá tham khảo".
- **Xếp theo "rẻ nhất":** dùng giá thật nếu có, nếu chưa có thì dùng `price_max`.
- **Món được nhắc nhiều:** 3 món xuất hiện nhiều nhất trong `dishes`.

**Hai nguồn dữ liệu luôn tách riêng**

|  | Dữ liệu của app | Nền bản đồ và Google Maps |
| --- | --- | --- |
| Gồm | Quán, giờ mở cửa, đánh giá, giá thật, ảnh | Dữ liệu bản đồ (OpenFreeMap, từ OpenStreetMap); đường đi (Valhalla của FOSSGIS, từ OpenStreetMap); link sang Google Maps |
| Lưu ở đâu | Supabase, lưu lâu dài | Không lưu; chỉ giữ `place_id` để dựng link |
| Khi không lấy được | Hiện dữ liệu đã lưu trên máy kèm giờ lưu; không có thì hiện linh vật buồn và nút thử lại | Ô bản đồ không tải được trong 8 giây thì chuyển sang chế độ danh sách |

**Địa danh nổi tiếng (không nằm trong database)**

- Lấy bằng script `scripts/landmarks.mjs`, ghi ra file tĩnh `public/landmarks.json`; app tải file này sau khi bản đồ đã vẽ. Chạy lại script khi muốn cập nhật.
- Nguồn: Wikidata (vị trí, loại, độ nổi tiếng), Wikipedia tiếng Việt (tên, đoạn giới thiệu), Wikimedia Commons (ảnh). Không dùng Google: Places API cần thẻ thanh toán và điều khoản cấm lưu lại dữ liệu, ảnh.
- Độ "nổi tiếng" đo bằng số ngôn ngữ Wikipedia có bài viết; nơi nổi tiếng hơn hiện trước khi thu nhỏ bản đồ. Mỗi thành phố lấy khoảng 100 địa danh có bài Wikipedia, quanh trung tâm (Hà Nội: hồ Hoàn Kiếm, 15 km; TP. Hồ Chí Minh: chợ Bến Thành, 10 km).
- Chỉ giữ địa danh có ảnh chụp thật (file JPEG) và thuộc loại công trình hoặc nơi chốn: tòa nhà, đền chùa, nhà thờ, bảo tàng, hồ, công viên, cầu, quảng trường, chợ, di tích. Bỏ sự kiện, tổ chức, đơn vị hành chính, sân bay, bệnh viện, nhà ga, trại giam (trừ nơi đã thành bảo tàng như Hỏa Lò). Mỗi địa danh được xếp vào một loại để chọn icon, đoán theo tên tiếng Việt ("Chùa…", "Cầu…", "Nhà hát…") rồi đến loại trên Wikidata.
- Ảnh luôn ghi tên tác giả và giấy phép (CC BY, CC BY-SA, phạm vi công cộng…) kèm link tới trang ảnh, đoạn giới thiệu ghi "Wikipedia (CC BY-SA 4.0)", đúng yêu cầu của các giấy phép này.

**Cách nhập dữ liệu ban đầu**

1. Nhóm điền Google Sheet, mỗi quán một dòng với các cột giống bảng `places`.
2. Lấy tọa độ: chạm giữ vào quán trên Google Maps rồi sao chép tọa độ. Lấy `place_id` bằng công cụ Place ID Finder trong tài liệu của Google.
3. Xuất CSV, nhập vào bảng bằng chức năng "Import data from CSV" của Supabase.
4. Đánh giá và ảnh do nhóm gửi qua chính app khi đến ăn. Nhờ vậy luồng check-in được thử thật ngay trong tuần làm.

## 7. Kiến trúc kỹ thuật

App không có server riêng. Trình duyệt gọi thẳng các dịch vụ có gói miễn phí: GitHub Pages phục vụ file tĩnh, OpenFreeMap trả dữ liệu bản đồ để app tự vẽ kiểu chibi, Supabase giữ dữ liệu, tài khoản và ảnh. Quyền đọc ghi được kiểm soát bằng Row Level Security của Postgres, không phải bằng code ở frontend.

Sơ đồ kiến trúc (dạng chữ):

```text
Điện thoại người dùng (Chrome, Safari, Facebook, Zalo)
  └─ Web app Hometown (HTML, CSS, JS thuần; nén ảnh, check-in GPS; lưu tạm dữ liệu quán khi mất kết nối)
       ├─ tải trang ─────────────> GitHub Pages (file tĩnh, tự deploy khi push lên nhánh mặc định)
       ├─ dữ liệu bản đồ ────────> OpenFreeMap (miễn phí, không key); app tự vẽ kiểu chibi, ghim và gom cụm ngay trên máy
       └─ publishable key + RLS ─> Supabase (Auth: Google, mã email qua SMTP riêng; Postgres + RLS, submit_review; Storage: ảnh đã nén)
                                                                           <── UptimeRobot (ping 5 phút)
                                                                           <── GitHub Action (sao lưu mỗi đêm)
```

Mọi mũi tên đều xuất phát từ trình duyệt hoặc công cụ phụ. Không có máy chủ nào của nhóm cần vận hành trong mùa thi.

Dự án Supabase tạo sau tháng 11/2025 không còn "anon key" và "service_role key". Thay vào đó là **publishable key** (`sb_publishable_…`, được thiết kế để công khai, dùng ở frontend) và **secret key** (`sb_secret_…`, không bao giờ rời dashboard).

| Thành phần | Chọn | Lý do |
| --- | --- | --- |
| Frontend | Vite + JavaScript thuần (nếu nhóm quen React thì dùng React, thiết kế không đổi) | Nhẹ, build ra file tĩnh |
| Bản đồ | Leaflet 1.9 + `protomaps-leaflet`, tự vẽ kiểu chibi từ dữ liệu vector của OpenFreeMap; ghim `L.divIcon` bằng HTML, gom cụm tự viết theo lưới | Không cần thẻ, không cần key; tự chọn được màu, nét, chữ cho ra chất chibi |
| Chỉ đường | Valhalla trên máy chủ miễn phí của FOSSGIS (`valhalla1.openstreetmap.de`), chế độ `motor_scooter` (xe máy), `auto` (ô tô) và `pedestrian` (đi bộ), câu chỉ dẫn `vi-VN` | Miễn phí, không cần key, có sẵn chế độ xe máy và tiếng Việt. Điều kiện: ghi nguồn OSM kèm link sửa bản đồ, tối đa 1 yêu cầu/giây, không dùng nặng. Là máy chủ demo nên luôn giữ nút Google Maps dự phòng |
| Google Maps | Chỉ dùng link Google Maps URLs cho "Mở bằng Google Maps" và "Xem đánh giá trên Google Maps" | Miễn phí, không cần key |
| Dữ liệu và tài khoản | Supabase: Postgres, Auth (Google và mã qua email), Storage | Miễn phí, có sẵn đăng nhập và phân quyền theo dòng |
| Gửi đánh giá | Hàm Postgres `submit_review` gọi qua RPC | Kiểm tra khoảng cách check-in và giới hạn 1 đánh giá/ngày ngay trong database |
| Ảnh | Nén trên máy bằng canvas thành 2 cỡ: cạnh dài 1280 px để xem lớn, 400 px cho lưới ảnh và danh sách; chất lượng 0,8. Dùng WebP, riêng Safari và mọi trình duyệt trên iOS dùng JPEG (các trình duyệt này không xuất được WebP) | Bản lớn khoảng 150–250 KB, bản nhỏ khoảng 30 KB. Vẽ lại qua canvas cũng xóa luôn thông tin EXIF (có GPS nhà riêng). Supabase gói miễn phí không tự đổi cỡ ảnh, nên app phải tự làm |
| Hosting | GitHub Pages: https://duahnproducts.github.io/alert/ (chốt 06/10/2026, không dùng Vercel) | Miễn phí với repo công khai, tự deploy mỗi lần push |
| Email đăng nhập | SMTP riêng qua Resend hoặc Brevo | Email mặc định của Supabase chỉ gửi tới thành viên nhóm, tối đa 2 email/giờ, nên không dùng được cho người dùng thật |
| Giám sát, sao lưu | UptimeRobot gọi 5 phút một lần vào trang web và một truy vấn đọc nhẹ; GitHub Action sao lưu dữ liệu mỗi đêm | Báo khi app sập, đồng thời giữ Supabase không bị tạm dừng (dự án miễn phí bị tạm dừng sau 7 ngày ít hoạt động, phải vào dashboard bật lại bằng tay) |

**Chi phí và hạn mức** (đã kiểm ngày 05/10/2026, nguồn ở cuối tài liệu)

| Dịch vụ | Miễn phí | Giới hạn tự đặt |
| --- | --- | --- |
| OpenFreeMap (dữ liệu bản đồ) | Không giới hạn lượt, không cần đăng ký | Không cần |
| Supabase Free | 500 MB database, 1 GB lưu trữ file, 5 GB băng thông, 50.000 người dùng hoạt động/tháng | 1 GB chứa được khoảng 5.000 ảnh. Băng thông là giới hạn dễ chạm nhất khi bài được chia sẻ mạnh, nên mọi chỗ xem nhiều ảnh dùng bản 400 px |
| GitHub Pages | Đủ cho một web tĩnh nhỏ (giới hạn mềm 100 GB băng thông/tháng) | Không cần |
| Resend / Brevo (SMTP) | Resend 100 email/ngày (3.000/tháng); Brevo 300 email/ngày | Đặt giới hạn gửi email của Supabase Auth cho khớp |
| UptimeRobot Free | Monitor 5 phút; không cho thêm header tùy chỉnh | Truyền key qua tham số `?apikey=` |

Không có dịch vụ nào cần thẻ thanh toán. Google Cloud chỉ dùng để tạo OAuth client cho nút "Tiếp tục với Google", việc này miễn phí.

**Cấu trúc thư mục, SQL và cấu hình từng dịch vụ:** xem [phương án kỹ thuật](quan-quen-ky-thuat.md), mục 3 đến mục 5.

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

Bản 2023 của ISO/IEC 25010 có 9 đặc tính chất lượng sản phẩm: Functional suitability, Performance efficiency, Compatibility, Interaction capability, Reliability, Security, Maintainability, Flexibility và Safety (đã đối chiếu ngày 05/10/2026). So với bản 2011, Usability đổi thành Interaction capability, Portability đổi thành Flexibility, và Safety là đặc tính mới. Bảng dưới đây cho mỗi đặc tính một cách đáp ứng và một cách đo, để đưa thẳng vào trang Về dự án và caption.

| Đặc tính | Hometown đáp ứng thế nào | Đo bằng gì, đạt khi nào |
| --- | --- | --- |
| Phù hợp chức năng | Đủ vòng tìm quán, xem, đi, đánh giá; giá thật là trung vị, không bị một giá bất thường kéo lệch | Chạy view `place_stats` trên bộ dữ liệu biết trước kết quả |
| Hiệu năng | JS và CSS của app dưới 150 KB lúc mở (không tính thư viện bản đồ khoảng 86 KB, tải sau khi trang đã hiện); ảnh nén sẵn 2 cỡ, chỉ tải khi cuộn tới | Lighthouse mobile: LCP dưới 2,5 giây, điểm Performance từ 90 |
| Tương thích | Chạy trên Chrome Android, Safari iOS, trình duyệt trong Facebook và Zalo | Bảng thử thiết bị ở mục 11 qua hết |
| Khả năng tương tác (trước đây gọi là khả năng sử dụng) | Xem không cần đăng nhập, chế độ danh sách, tương phản 4,5:1 | 8/10 người thử tìm được quán trong 30 giây; Lighthouse Accessibility từ 90 |
| Tin cậy | Nền bản đồ lỗi thì chuyển sang danh sách; Supabase lỗi thì hiện dữ liệu đã lưu trên máy kèm giờ lưu | UptimeRobot không ghi nhận lần sập nào trong mùa thi |
| Bảo mật | Row Level Security trên mọi bảng; không đưa secret key ra frontend | Dùng publishable key thử sửa đánh giá của người khác: phải bị từ chối |
| Bảo trì | Khoảng 6 file JS, toàn bộ cấu trúc database trong `schema.sql`, tự deploy từ GitHub | Người ngoài nhóm đọc README và chạy được app trong 15 phút |
| Linh hoạt (trước đây gọi là khả chuyển) | Thêm cụm trường chỉ cần thêm dòng vào `areas` và `places`, không sửa code; thêm thành phố thì thêm một dòng khung bản đồ trong `util.js` | Demo thêm một cụm trường mới trong 5 phút |
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
| Vị trí lúc mở trang chỉ đường (không lưu) | Vẽ đường tới quán | Máy chủ tìm đường của FOSSGIS (Đức), ghi vào nhật ký máy chủ của họ; nhóm không nhận |

Không thu: tọa độ của người dùng, lịch sử duyệt, danh bạ, và không có công cụ phân tích hay quảng cáo của bên thứ ba. Vị trí dùng cho "Gợi ý quanh bạn" chỉ nằm trong bộ nhớ của tab, tính ngay trên máy, không gửi đi; vị trí chỉ rời máy khi check-in (gửi một lần cho `submit_review`) và khi mở trang chỉ đường (gửi cho máy chủ tìm đường).

- Tấm đăng nhập có một dòng đồng ý, kèm link tới trang chính sách quyền riêng tư viết bằng lời dễ hiểu.
- Căn cứ pháp lý hiện hành: **Luật Bảo vệ dữ liệu cá nhân 2025** (hiệu lực từ 01/01/2026) và **Nghị định 356/2025/NĐ-CP** hướng dẫn thi hành luật này. Nghị định 356 thay thế Nghị định 13/2023/NĐ-CP, nên không trích Nghị định 13 nữa. Nhóm cần đọc phần về sự đồng ý của chủ thể dữ liệu trước khi viết trang chính sách. Hình ảnh được Nghị định 356 nhắc đến trong nhóm dữ liệu cần bảo vệ chặt hơn, nên trang chính sách phải nói rõ ảnh được dùng thế nào và xóa bằng cách nào.
- "Xóa tài khoản" xóa luôn mọi đánh giá và ảnh của người đó, bằng ràng buộc `on delete cascade` trong database.

**Bảo mật**

- Bật Row Level Security trên cả 6 bảng:
  - Ai cũng đọc được dòng đang hiện.
  - Người dùng chỉ sửa hoặc xóa dòng của mình.
  - Muốn thêm đánh giá phải đi qua hàm `submit_review`.
- Kho ảnh: mỗi người chỉ được tải lên thư mục `<user_id>/` của mình; ai cũng xem được ảnh.
- Supabase publishable key được thiết kế để công khai; secret key không bao giờ nằm trong code frontend hay trên GitHub (nếu bị dùng từ trình duyệt, Supabase tự từ chối).
- Tài khoản Supabase và Google Cloud của nhóm bật xác thực 2 bước.

**Điều khoản nền bản đồ và Google Maps**

- Ghi nguồn "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" luôn hiện rõ ở góc trên bản đồ, có link tới trang bản quyền. Góc dưới bị ngăn kéo danh sách che nên không đặt ở đó.
- Không tải trước hàng loạt ô bản đồ; chỉ tải phần người dùng đang xem. Mức zoom nhỏ nhất là 11 (cỡ một thành phố).
- App không lấy, không lưu, không sao chép điểm hay đánh giá của Google. Nút "Mở bằng Google Maps" và link xem đánh giá dùng Google Maps URLs (`https://www.google.com/maps/dir/?api=1&destination=...`), không tốn phí.
- Máy chủ tìm đường của FOSSGIS: trang chỉ đường ghi nguồn OpenStreetMap kèm link "Sửa bản đồ"; mỗi lần mở trang chỉ gửi 1 yêu cầu cho mỗi chế độ đi (đổi qua lại không hỏi lại), không tìm đường cho quãng trên 30 km.

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
- [ ] Từ chối quyền vị trí: bản đồ vẫn hiện ở thành phố đã chọn, không báo lỗi đỏ; thẻ đổi thành "Gợi ý quanh ĐH Kinh tế Quốc dân" (Hà Nội) hoặc "… UEH" (TP.HCM), khoảng cách trong danh sách và trang quán tính từ trường đó.
- [ ] Từ chối quyền vị trí rồi bấm "Chỉ đường" ở một quán Hà Nội và một quán TP.HCM: đường vẽ từ ĐH Kinh tế Quốc dân và từ UEH, có dòng nói rõ lý do.
- [ ] Bấm "Chia sẻ vị trí" khi đang ở gần trường: thẻ gợi ý 3 quán đang mở, bấm vào mở đúng trang quán. Mở lại app: không hỏi lại, tự gợi ý. Thử cả trong trình duyệt của Facebook và Zalo.
- [ ] Bấm "Chỉ đường" khi đang ở gần quán: có đường đi, các bước tiếng Việt, Bao đi theo khi bạn đi, cố ý rẽ sai một ngã thì app tự tìm đường mới, tới quán thì hiện "Tới nơi rồi!". Thử cả trong trình duyệt của Facebook và Zalo.
- [ ] Chặn `valhalla1.openstreetmap.de` (DevTools → Network request blocking): trang chỉ đường báo lỗi kèm nút thử lại, nút "Mở bằng Google Maps" vẫn dùng được.
- [ ] Đăng nhập bằng mã email ngay trong trình duyệt của Facebook.
- [ ] Viết đánh giá khi đang ở quán thì gửi được; ở nhà thì bị từ chối kèm lời giải thích.
- [ ] Tải ảnh 8 MB chụp từ iPhone: file lưu trên Storage dưới 300 KB và không còn EXIF.
- [ ] Chặn máy chủ nền bản đồ (DevTools → Network request blocking): sau 8 giây app chuyển sang chế độ danh sách, không trắng trang.
- [ ] Tải ảnh từ iPhone: file lưu là JPEG (không phải PNG mang đuôi `.webp`).
- [ ] Dùng publishable key gọi API xóa đánh giá của người khác: bị từ chối.
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

- Nút "Chia sẻ Hometown" trong app trỏ về bài dự thi trên fanpage, không trỏ về link app, và có dòng nhắc "Nhớ follow fanpage nhé".
- Nút chia sẻ từng quán vẫn gửi link quán, vì đây là tính năng thật người dùng cần khi rủ bạn đi ăn.
- Trang quán do người xem gợi ý ghi "Gợi ý bởi \[tên\]". Đây là lý do để người đó khoe với bạn bè.

**Kịch bản sau khi bài lên fanpage**

1. **Giờ đầu:** mỗi thành viên nhóm gửi bài vào nhóm lớp và nhóm ký túc xá mình đang tham gia, kèm một câu hỏi thật: "Quán nào quanh trường mình xứng được lên bản đồ?"
2. **Mỗi ngày:** nhóm trả lời mọi comment trong 2 giờ. Mỗi quán được thêm lên bản đồ thì reply "Đã thêm \[quán\], cảm ơn \[tag người gợi ý\]".
3. **Cuối tuần:** comment cập nhật kèm ảnh: "Tuần này bản đồ có thêm 12 quán do các bạn gợi ý".

**Bản nháp caption**

> Ăn trưa quanh trường mà vẫn được dưới 50k? Có đấy, nhưng không nằm trong mấy bài quảng cáo đâu.
>
> Hometown là bản đồ ăn ngon giá sinh viên quanh \[cụm trường\], do chính sinh viên chấm điểm. Muốn đánh giá phải check-in tại quán. Giá hiển thị là giá người ăn thật đã trả. Ảnh là ảnh chụp tại bàn, không phải ảnh studio.
>
> Nhóm tự đi ăn \[X\] quán trong 7 ngày để làm bản đồ đầu tiên. Giờ đến lượt bạn: Comment tên quán ruột của bạn, nhóm sẽ đến ăn thử và đưa lên bản đồ, ghi tên bạn là người gợi ý. Share về nhóm lớp để cả lớp có bản đồ ăn rẻ. (Nhớ follow fanpage để lượt tương tác được tính nhé.)

**Ảnh nộp kèm (4 ảnh)**

1. Bản đồ đầy biểu tượng món ăn: ảnh chính, dùng để thu hút người xem.
2. Trang quán có dòng "Giá thật: 35k" và hai điểm đặt cạnh nhau.
3. Màn check-in "Bạn đang ở quán".
4. Linh vật Bao và bộ biểu tượng.

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
- [ ] **07/10:** trang quán có điểm Google; đăng nhập bằng Google và bằng mã email hoạt động, email gửi qua SMTP riêng và đã tới được hộp thư của người ngoài nhóm. Đã đọc điều khoản Google Maps Platform. Deploy bản đầu lên Vercel và chạy Lighthouse lần đầu.
- [ ] **08/10:** viết đánh giá có check-in, nén ảnh, `submit_review`, báo cáo, đề xuất quán.
- [ ] **09/10:** hoàn thiện giao diện, chế độ danh sách, các trường hợp lỗi. Trang Về dự án và chính sách quyền riêng tư. Chạy hết ma trận thiết bị.
- [ ] **10/10:** thử với 5–10 sinh viên, sửa các lỗi họ gặp. Có tối thiểu 30 quán có ảnh thật.
- [ ] **11/10:** Lighthouse từ 90. Ảnh xem trước khi dán link. Xóa hết đánh giá mẫu. Bật UptimeRobot. Chụp 4 ảnh nộp, chốt caption.
- [ ] **12/10:** nộp bài qua form của BTC. Từ đây chỉ sửa lỗi, không thêm tính năng.

## 14. Rủi ro, dự phòng, câu hỏi còn mở

Rủi ro lớn nhất là app ngừng chạy giữa mùa thi, vì theo thể lệ như vậy là mất bài. Mọi rủi ro dưới đây đều có phương án xử lý mà không phải viết lại app. Bảng xếp theo mức độ nghiêm trọng, nặng nhất trước.

| Rủi ro | Dấu hiệu | Xử lý |
| --- | --- | --- |
| **Đã xảy ra (06/10):** không có thẻ để mở billing Google Cloud | Biết ngay ngày 05/10 | Đã đổi sang bản đồ tự vẽ kiểu chibi từ dữ liệu OpenFreeMap (miễn phí, không key). Ghim, biểu tượng và luồng giữ nguyên. Bỏ điểm Google, thay bằng link "Xem đánh giá trên Google Maps" |
| Máy chủ bản đồ bị chặn hoặc quá tải khi bài được chia sẻ mạnh | Bản đồ trống, app tự chuyển sang danh sách | OpenFreeMap không giới hạn lượt; nếu bị chặn, đổi nguồn dữ liệu trong `map.js` |
| Máy chủ tìm đường của FOSSGIS (bản demo) chậm, chặn hoặc ngừng | Trang chỉ đường báo "Máy chủ tìm đường chưa trả lời" | Người dùng vẫn có nút "Mở bằng Google Maps". Nếu kéo dài, đổi nút "Chỉ đường" ở trang quán về link Google Maps (`gmapsDir` trong `place.js`) |
| Email mã đăng nhập không tới | Người ngoài nhóm báo không nhận được mã | Email mặc định của Supabase chỉ gửi tới thành viên nhóm (2 email/giờ), nên SMTP riêng qua Resend hoặc Brevo là việc **bắt buộc** của ngày 07/10, không phải dự phòng. Sau khi cấu hình, nâng giới hạn gửi email trong Supabase Auth và gửi thử tới Gmail, Outlook của người ngoài nhóm |
| Supabase đổi hệ thống key | Hướng dẫn trên mạng nói "anon key" nhưng dashboard không có | Dùng publishable key (`sb_publishable_…`) ở mọi chỗ tài liệu cũ nói anon key |
| Ảnh hoặc lời lẽ xấu lọt lên đúng lúc BTC chấm | Có báo cáo, hoặc phát hiện khi duyệt | Hàng chờ ảnh cho tài khoản mới, tự ẩn khi đủ 3 báo cáo, duyệt 2 lần mỗi ngày |
| Supabase bị tạm dừng hoặc sập | UptimeRobot báo | Ping định kỳ giữ dự án hoạt động. App hiện dữ liệu đã lưu trên máy kèm giờ lưu |
| Không đi ăn đủ 30 quán | Ngày 08/10 có dưới 15 quán | Thu về 2 cụm trường. 20 quán thật tốt hơn 50 quán có dữ liệu rỗng |
| Chủ quán phản đối đánh giá tiêu cực | Có tin nhắn hoặc comment | Quy định chỉ đánh giá trải nghiệm, không xúc phạm. Có kênh liên hệ trên trang Về dự án. Nhóm trả lời trong 24 giờ |
| Trùng ý tưởng với đội làm đề du lịch | Thấy bài tương tự trên fanpage | Caption và ảnh đầu tiên nhấn vào "giá thật" và "phải check-in mới được đánh giá" |

**Câu hỏi còn mở (cần trả lời trong ngày 05/10)**

| Câu hỏi | Trạng thái | Đáp án |
| --- | --- | --- |
| Thành phố nào, những cụm trường nào? | Đã trả lời | Hà Nội và TP. Hồ Chí Minh (chốt 06/10/2026). Cụm trường: *cần ghi vào đây* |
| Nhóm có thẻ để mở billing Google Cloud không? (quyết định dùng Google Maps hay Leaflet) | Đã trả lời | Không có thẻ (06/10/2026): dùng Leaflet, tự vẽ bản đồ chibi từ dữ liệu OpenFreeMap |
| Nhóm quen React hay JavaScript thuần? | Đã trả lời | *Cần ghi vào đây.* Phương án kỹ thuật tạm giả định là JavaScript thuần |
| Tên chính thức có giữ "Quán Quen" và linh vật "Bé Bao" không? | Đã trả lời | Đổi thành **Hometown**, linh vật **Bao** (chốt 06/10/2026). Tên file tài liệu `quan-quen-*.md` giữ nguyên để không gãy liên kết |
| Giữ ngưỡng 50k, hay đổi theo mặt bằng giá của thành phố đã chọn? | Chưa trả lời | |
| Gửi email đăng nhập qua Resend (cần tên miền riêng) hay Brevo? | Chưa trả lời | Xem mục 5.4 phương án kỹ thuật |

## Nguồn

Thể lệ cuộc thi "From Idea to Impact" do nhóm cung cấp. Các con số và quy định dưới đây được kiểm ngày 05/10/2026:

- Hạn mức miễn phí của Google Maps Platform theo nhóm SKU: [Pricing categories](https://developers.google.com/maps/billing-and-pricing/pricing-categories), [Billing FAQ](https://developers.google.com/maps/billing-and-pricing/faq).
- Trường nào của Place Details thuộc nhóm nào: [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details).
- Ghi nguồn và lưu trữ dữ liệu Places: [Policies and attributions for Places API](https://developers.google.com/maps/documentation/places/web-service/policies).
- Supabase tạm dừng dự án miễn phí: [Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing). Không đổi cỡ ảnh ở gói miễn phí: [Storage Image Transformations](https://supabase.com/docs/guides/storage/serving/image-transformations). Key mới: [API keys](https://supabase.com/docs/guides/api/api-keys).
- Giới hạn của email mặc định trong Supabase: [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- Gói miễn phí của Resend: [Resend pricing](https://resend.com/pricing). UptimeRobot không có header tùy chỉnh ở gói miễn phí: [UptimeRobot pricing](https://uptimerobot.com/pricing/).
- Safari không xuất WebP qua canvas: [Can I use: toBlob webp](https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp).
- ISO/IEC 25010:2023: [arc42 quality model](https://quality.arc42.org/standards/iso-25010).
- Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025/NĐ-CP: [LuatVietnam](https://luatvietnam.vn/tin-van-ban-moi/da-co-nghi-dinh-356-huong-dan-luat-bao-ve-du-lieu-ca-nhan-2025-186-106267-article.html).

Điều khoản sử dụng Google Maps Platform và chính sách quyền riêng tư vẫn cần nhóm tự đọc bản gốc (mục 10); tài liệu này không thay cho việc đọc điều khoản.
