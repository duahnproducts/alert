// Sinh dữ liệu demo có nhãn cho bản chưa nối Supabase: node scripts/demo-data.mjs → public/demo.json
// Mọi thứ ở đây là MINH HỌA: tên quán tự đặt (cố ý không trùng quán thật), đánh giá và người viết là mẫu.
// App hiện dòng "Bản demo" trên đầu trang, nhãn "Mẫu" ở mỗi đánh giá, "Giá mẫu" thay cho "Giá thật".
// Khi đã nối Supabase (có VITE_SUPABASE_URL), app không dùng file này nữa.
import { readFileSync, writeFileSync } from 'node:fs'

// Số ngẫu nhiên có hạt giống: chạy lại ra đúng dữ liệu cũ
let seed = 20261006
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = a => a[Math.floor(rand() * a.length)]
const int = (a, b) => a + Math.floor(rand() * (b - a + 1))
const shuffle = a => a.map(x => [rand(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1])

const AREAS = [
  { id: 1, name: 'ĐH Bách khoa Hà Nội', center_lat: 21.0058, center_lng: 105.8431, radius_m: 1500 },
  { id: 2, name: 'ĐHQG Hà Nội (Cầu Giấy)', center_lat: 21.0379, center_lng: 105.7823, radius_m: 1500 },
  { id: 3, name: 'ĐH Bách khoa TP.HCM', center_lat: 10.7725, center_lng: 106.6580, radius_m: 1500 },
  { id: 4, name: 'Làng Đại học Thủ Đức', center_lat: 10.8700, center_lng: 106.8030, radius_m: 2000 },
]

// Tên quán tự đặt theo phong cách chibi của app, để không ai nhầm với quán thật
const PLACES = {
  bun_pho_mi: ['Phở Mèo Mập', 'Bún Chả Nhà Mây', 'Mì Vằn Thắn Cá Heo', 'Bún Bò Sóc Nâu', 'Hủ Tiếu Gà Con', 'Bún Riêu Cua Nhỏ', 'Phở Cuốn Mây Trắng'],
  com: ['Cơm Tấm Gấu Trúc', 'Cơm Rang Bếp Thỏ', 'Cơm Nhà Bé Bao', 'Cơm Gà Chíp Chíp', 'Cơm Văn Phòng Nai Con', 'Cơm Niêu Heo Hồng'],
  banh_mi_xoi: ['Bánh Mì Thỏ Ngọc', 'Xôi Cô Tiên', 'Bánh Mì Cú Mèo', 'Xôi Gấc Hạt Đậu', 'Bánh Mì Chim Sẻ', 'Xôi Lá Dứa Ếch Xanh'],
  an_vat: ['Xiên Que Chú Cún', 'Nem Chua Rán Mây Hồng', 'Bánh Tráng Mèo Lười', 'Ốc Nhỏ Vui Vẻ', 'Bột Chiên Mèo Hồng', 'Khoai Lắc Gà Bông'],
  do_uong: ['Trà Sữa Bé Bao', 'Trà Chanh Cá Vàng', 'Sinh Tố Dâu Tây Nhỏ', 'Trà Đào Hươu Cao Cổ', 'Trà Sữa Mây Tím', 'Nước Mía Cún Con'],
  ca_phe: ['Cà Phê Cú Đêm', 'Cà Phê Sách Gấu Bông', 'Cà Phê Muối Hải Cẩu', 'Cà Phê Mèo Mun', 'Cà Phê Lá Me', 'Cà Phê Sóc Chuột'],
  che: ['Chè Cô Tiên Nhỏ', 'Chè Khúc Bạch Mây', 'Tào Phớ Thỏ Trắng', 'Kem Dừa Chim Cánh Cụt', 'Chè Thái Cá Vàng', 'Sữa Chua Nếp Cẩm Thỏ'],
}
const DISHES = {
  bun_pho_mi: ['Phở bò', 'Bún chả', 'Bún bò', 'Mì vằn thắn', 'Hủ tiếu', 'Quẩy'],
  com: ['Cơm tấm sườn', 'Cơm rang dưa bò', 'Cơm gà', 'Canh chua', 'Trứng ốp'],
  banh_mi_xoi: ['Bánh mì pate', 'Bánh mì trứng', 'Xôi xéo', 'Xôi gấc', 'Xôi thịt'],
  an_vat: ['Xiên nướng', 'Nem chua rán', 'Bánh tráng trộn', 'Ốc luộc', 'Khoai lang kén'],
  do_uong: ['Trà sữa trân châu', 'Trà chanh', 'Sinh tố bơ', 'Trà đào', 'Sữa chua lắc'],
  ca_phe: ['Cà phê sữa đá', 'Bạc xỉu', 'Cà phê muối', 'Cacao nóng'],
  che: ['Chè khúc bạch', 'Chè thập cẩm', 'Tào phớ', 'Kem dừa', 'Chè bưởi'],
}
const PRICE = { bun_pho_mi: [30, 45], com: [30, 45], banh_mi_xoi: [15, 25], an_vat: [20, 35], do_uong: [20, 35], ca_phe: [20, 35], che: [15, 30] }
const HOURS = {
  bun_pho_mi: { all: [['06:00', '13:30'], ['17:00', '21:30']] },
  com: { all: [['10:00', '14:00'], ['17:00', '21:00']], 0: [] },
  banh_mi_xoi: { all: [['06:00', '10:30'], ['16:00', '22:00']] },
  an_vat: { all: [['15:00', '23:00']] },
  do_uong: { all: [['08:00', '22:30']] },
  ca_phe: { all: [['07:00', '23:00']] },
  che: { all: [['13:00', '23:30']] },
}
const COMMENTS = {
  5: ['Ngon xỉu, ăn xong muốn quay lại liền', 'Đáng tiền lắm, phần ăn đầy đặn', 'Quán sạch sẽ, cô chủ dễ thương', 'Ăn một lần là ghiền luôn', 'Giá sinh viên mà chất lượng ổn áp'],
  4: ['Ngon, hơi đông giờ trưa nên chờ chút', 'Ổn trong tầm giá, sẽ quay lại', 'Vị vừa miệng, chỗ ngồi hơi chật', 'Đồ ăn nóng hổi, phục vụ nhanh'],
  3: ['Tạm ổn, không có gì đặc biệt', 'Vị hơi nhạt so với mình', 'Được cái gần trường, tiện ghé'],
  2: ['Hôm mình đến đồ ăn hơi nguội', 'Chờ khá lâu, chắc hôm đó đông'],
}
const NAMES = ['Mèo Ú', 'Hà Thổ Địa', 'Minh Đói Bụng', 'Tuấn Kều', 'Linh Ăn Vặt', 'Bé Na', 'Khoa K67', 'Ngọc Trà Sữa',
  'Phúc Năm Nhất', 'Thực khách 4821', 'Thực khách 0937', 'Vy Cà Phê', 'An Đi Học', 'Long Mập', 'Trang Hay Ăn']
const AUTHOR_COUNT = Object.fromEntries(NAMES.map(n => [n, int(1, 20)]))

const percentile = (sorted, q) => { // giống percentile_cont của Postgres
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo))
}

const today = new Date('2026-10-06T12:00:00+07:00')
const places = [], reviews = {}
let placeId = 1, reviewId = 1
for (const area of AREAS) {
  // Mỗi cụm 8 quán, đủ 7 loại món, đặt rải trong bán kính khoảng 700 m quanh tâm cụm
  const cats = shuffle([...Object.keys(PLACES), pick(Object.keys(PLACES))])
  for (const category of cats) {
    const name = PLACES[category].splice(int(0, PLACES[category].length - 1), 1)[0] ?? `${pick(DISHES[category])} Nhỏ Xinh`
    const [lo, hi] = PRICE[category]
    const quality = rand() // quán "ngon" thì sao cao hơn
    const n = int(3, 9)
    const list = []
    for (let i = 0; i < n; i++) {
      const stars = Math.max(2, Math.min(5, Math.round(3.4 + quality * 1.8 + (rand() - 0.5) * 1.6)))
      const ago = int(0, 40)
      const date = new Date(today - ago * 864e5)
      const display_name = pick(NAMES)
      list.push({
        id: reviewId++, stars, price_paid: int(lo, hi) * 1000,
        dishes: shuffle(DISHES[category]).slice(0, int(1, 2)),
        comment: rand() < 0.85 ? pick(COMMENTS[stars]) : null,
        is_sample: true, review_date: date.toISOString().slice(0, 10), created_at: date.toISOString(),
        display_name, author_review_count: AUTHOR_COUNT[display_name],
      })
    }
    list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    const prices = list.map(r => r.price_paid).sort((a, b) => a - b)
    const tally = {}
    for (const r of list) for (const d of r.dishes) tally[d] = (tally[d] ?? 0) + 1
    const angle = rand() * 2 * Math.PI, dist = 150 + rand() * 550
    places.push({
      id: placeId, google_place_id: null, name, category,
      lat: +(area.center_lat + (dist * Math.cos(angle)) / 111320).toFixed(6),
      lng: +(area.center_lng + (dist * Math.sin(angle)) / (111320 * Math.cos(area.center_lat * Math.PI / 180))).toFixed(6),
      address: `Gần ${area.name} (địa chỉ minh họa)`, area_id: area.id,
      price_min: lo * 1000, price_max: hi * 1000, opening_hours: HOURS[category], suggested_by_name: null,
      review_count: list.length, avg_stars: Math.round(list.reduce((s, r) => s + r.stars, 0) / list.length * 10) / 10,
      price_count: prices.length, price_median: percentile(prices, 0.5), price_p25: percentile(prices, 0.25), price_p75: percentile(prices, 0.75),
      top_dishes: Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n })),
      cover_path: null, cover_at: null,
    })
    reviews[placeId++] = list
  }
}

// Cảm nhận mẫu cho địa danh: câu chung chung theo loại, không nói sai sự thật về nơi nào
const NOTES = {
  temple: ['Yên tĩnh, hợp ghé buổi sáng sớm', 'Kiến trúc đẹp, nhớ ăn mặc lịch sự nhé', 'Chụp ảnh lên màu rất xinh'],
  church: ['Kiến trúc đẹp, chụp ảnh rất ăn ảnh', 'Buổi tối lên đèn lung linh', 'Gần đây có nhiều quán ăn vặt'],
  museum: ['Đi một buổi chiều là vừa, học được nhiều thứ', 'Sinh viên nhớ mang thẻ, có khi được giảm giá', 'Trong phòng mát, đi trưa hè cũng ổn'],
  lake: ['Chiều hoàng hôn ngồi hóng gió thích lắm', 'Đi dạo một vòng rồi kiếm gì ăn gần đó', 'Sáng sớm nhiều người tập thể dục'],
  park: ['Nhiều cây xanh, hợp đi dạo cuối tuần', 'Mang đồ ăn ra ngồi picnic vui phết', 'Chiều tối mát mẻ, đông vui'],
  zoo: ['Đi cả ngày không hết, nhớ mang nước', 'Rủ hội bạn đi chơi cuối tuần rất vui'],
  bridge: ['Lên cầu ngắm thành phố về đêm đẹp lắm', 'Chụp ảnh hoàng hôn ở đây xịn xò'],
  tower: ['Lên cao ngắm cả thành phố, đáng thử một lần', 'Buổi tối lên đèn rất đẹp'],
  theatre: ['Kiến trúc đẹp, chụp ảnh bên ngoài cũng thích', 'Thử xem một buổi diễn cho biết'],
  stadium: ['Hôm có trận thì không khí cực sôi động', 'Xung quanh nhiều quán ăn đêm'],
  market: ['Đồ ăn vặt nhiều vô kể, nhớ hỏi giá trước', 'Đi chợ đêm vui lắm, nhớ giữ đồ cẩn thận'],
  palace: ['Đi tham quan học được nhiều lịch sử', 'Kiến trúc đẹp, chụp ảnh rất hợp'],
  post: ['Ghé gửi bưu thiếp cho bạn bè, kỷ niệm dễ thương', 'Kiến trúc cổ chụp ảnh rất đẹp'],
  hotel: ['Kiến trúc đẹp, đi ngang chụp ảnh cũng thích'],
  street: ['Buổi tối đông vui, nhiều đồ ăn ngon', 'Đi bộ dạo phố cuối tuần rất chill'],
  school: ['Khuôn viên đẹp, nhiều góc chụp ảnh'],
  monument: ['Ghé chụp ảnh check-in một lần cho biết', 'Buổi sáng sớm không khí trang nghiêm'],
}
const landmarks = JSON.parse(readFileSync(new URL('../public/landmarks.json', import.meta.url), 'utf8'))
const landmarkNotes = Object.fromEntries(landmarks.map(l => [l.id,
  shuffle(NOTES[l.type] ?? NOTES.monument).slice(0, int(1, 2)).map(text => ({ text, by: pick(NAMES), stars: int(4, 5) }))]))

writeFileSync(new URL('../public/demo.json', import.meta.url), JSON.stringify({ areas: AREAS, places, reviews, landmarkNotes }))
console.log(`Đã ghi ${places.length} quán minh họa, ${reviewId - 1} đánh giá mẫu, cảm nhận mẫu cho ${landmarks.length} địa danh vào public/demo.json`)
