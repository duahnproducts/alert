// Sinh dữ liệu demo có nhãn cho bản chưa nối Supabase: node scripts/demo-data.mjs → public/demo.json
// Mọi thứ ở đây là MINH HỌA: tên quán tự đặt (cố ý không trùng quán thật), đánh giá và người viết là mẫu.
// App hiện dòng "Bản demo" trên đầu trang, nhãn "Mẫu" ở mỗi đánh giá, "Giá mẫu" thay cho "Giá thật".
// Khi đã nối Supabase (có VITE_SUPABASE_URL), app không dùng file này nữa. Cần mạng: vị trí quán lấy theo đường phố trên OpenFreeMap.
import { readFileSync, writeFileSync } from 'node:fs'
import { VectorTile } from '@mapbox/vector-tile' // có sẵn trong node_modules, đi kèm protomaps-leaflet
import Pbf from 'pbf'

// Số ngẫu nhiên có hạt giống: chạy lại ra đúng dữ liệu cũ
let seed = 20261006
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = a => a[Math.floor(rand() * a.length)]
const int = (a, b) => a + Math.floor(rand() * (b - a + 1))
const shuffle = a => a.map(x => [rand(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1])

const AREAS = [
  { id: 1, name: 'ĐH Bách khoa Hà Nội', center_lat: 21.0058, center_lng: 105.8431, radius_m: 1500 },
  { id: 2, name: 'ĐHQG Hà Nội (Cầu Giấy)', center_lat: 21.0379, center_lng: 105.7823, radius_m: 1500 },
  { id: 3, name: 'ĐH Ngoại thương (Chùa Láng)', center_lat: 21.0227, center_lng: 105.8050, radius_m: 1500 },
  { id: 4, name: 'Học viện Bưu chính (Hà Đông)', center_lat: 20.9810, center_lng: 105.7875, radius_m: 1500 },
  { id: 5, name: 'ĐH Bách khoa TP.HCM', center_lat: 10.7725, center_lng: 106.6580, radius_m: 1500 },
  { id: 6, name: 'Làng Đại học Thủ Đức', center_lat: 10.8700, center_lng: 106.8030, radius_m: 2000 },
  { id: 7, name: 'ĐH Kinh tế TP.HCM (Quận 3)', center_lat: 10.7832, center_lng: 106.6950, radius_m: 1500 },
  { id: 8, name: 'ĐH Tôn Đức Thắng (Quận 7)', center_lat: 10.7326, center_lng: 106.6993, radius_m: 1500 },
]

// Mỗi thành phố 100 quán rải đều khắp khung [nam, tây, bắc, đông] của nội thành, không dồn quanh tâm cụm trường
const CITIES = [
  { name: 'Hà Nội', box: [20.96, 105.76, 21.08, 105.90] },
  { name: 'TP. Hồ Chí Minh', box: [10.71, 106.61, 10.89, 106.82] },
]
const PER_CITY = 100
const meters = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos(a.lat * Math.PI / 180)) * 111320

// Các điểm nằm trên đường phố trong khung, lấy từ ô bản đồ vector OpenFreeMap mà app đang dùng, để ghim không rơi xuống hồ, sông.
// Bỏ cầu và hầm. Bản đồ cập nhật hằng tuần nên chạy lại sau này có thể lệch vị trí vài quán.
async function roadSpots([s, w, n, e]) {
  const Z = 14
  const tx = lng => Math.floor((lng + 180) / 360 * 2 ** Z)
  const ty = lat => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** Z)
  const { tiles: [url] } = await (await fetch('https://tiles.openfreemap.org/planet')).json()
  const spots = []
  for (let x = tx(w); x <= tx(e); x++) for (let y = ty(n); y <= ty(s); y++) {
    const r = await fetch(url.replace('{z}', Z).replace('{x}', x).replace('{y}', y))
    if (!r.ok) throw new Error(`Không tải được ô bản đồ ${Z}/${x}/${y} (${r.status}), thử chạy lại nhé`)
    const roads = new VectorTile(new Pbf(new Uint8Array(await r.arrayBuffer()))).layers.transportation
    for (let i = 0; i < (roads?.length ?? 0); i++) {
      const f = roads.feature(i)
      if (!['minor', 'tertiary', 'secondary'].includes(f.properties.class) || f.properties.brunnel) continue
      const g = f.toGeoJSON(x, y, Z).geometry
      for (const [lng, lat] of g.type === 'LineString' ? g.coordinates : g.coordinates.flat())
        if (lat > s && lat < n && lng > w && lng < e) spots.push({ lat, lng })
    }
  }
  return spots
}

// Chọn n điểm cách đều nhau: mỗi lần lấy điểm xa nhất so với các điểm đã chọn, nên quán phủ khắp bản đồ, không chừa khoảng trống
function spread(spots, n) {
  const gap = spots.map(() => Infinity), out = []
  let next = Math.floor(rand() * spots.length)
  while (out.length < n) {
    const p = spots[next]
    out.push(p)
    next = 0
    for (let i = 0; i < spots.length; i++) {
      gap[i] = Math.min(gap[i], meters(spots[i], p))
      if (gap[i] > gap[next]) next = i
    }
  }
  return out
}

// Tên quán tự đặt theo phong cách chibi của app (kiểu món + con vật, đồ vật dễ thương), để không ai nhầm với quán thật.
// Không dùng con vật hay bị đem nấu (gà, heo, cua, bạch tuộc…) để tên quán không bị đọc thành tên món
const KIND = {
  bun_pho_mi: ['Phở', 'Bún Chả', 'Bún Bò', 'Mì Vằn Thắn', 'Hủ Tiếu', 'Bún Riêu', 'Bún Cá', 'Mì Trộn', 'Phở Cuốn'],
  com: ['Cơm Tấm', 'Cơm Rang', 'Cơm Gà', 'Cơm Niêu', 'Cơm Sườn', 'Cơm Chiên', 'Cơm Bình Dân', 'Cơm Văn Phòng'],
  banh_mi_xoi: ['Bánh Mì', 'Xôi', 'Xôi Gấc', 'Bánh Mì Que', 'Xôi Xéo', 'Bánh Mì Chảo', 'Xôi Ngô'],
  an_vat: ['Xiên Que', 'Nem Chua Rán', 'Bánh Tráng', 'Bột Chiên', 'Khoai Lắc', 'Bánh Gối', 'Cá Viên Chiên', 'Bánh Tráng Nướng'],
  do_uong: ['Trà Sữa', 'Trà Chanh', 'Sinh Tố', 'Trà Đào', 'Nước Mía', 'Trà Tắc', 'Sữa Đậu', 'Nước Ép'],
  ca_phe: ['Cà Phê', 'Cà Phê Sách', 'Cà Phê Muối', 'Cà Phê Trứng', 'Cà Phê Cốt Dừa', 'Cà Phê Phin'],
  che: ['Chè', 'Chè Khúc Bạch', 'Tào Phớ', 'Kem Dừa', 'Chè Thái', 'Sữa Chua Nếp Cẩm', 'Chè Bưởi', 'Sương Sáo'],
}
const CUTE = ['Mèo Mập', 'Gấu Trúc', 'Thỏ Ngọc', 'Cú Mèo', 'Cá Heo', 'Sóc Nâu', 'Mây Trắng', 'Nai Con', 'Chim Sẻ', 'Chú Cún',
  'Mèo Lười', 'Cá Vàng', 'Hươu Cao Cổ', 'Mây Tím', 'Cún Con', 'Hải Cẩu', 'Mèo Mun', 'Sóc Chuột', 'Cô Tiên', 'Chim Cánh Cụt',
  'Rái Cá', 'Gấu Nâu', 'Mèo Béo', 'Khỉ Con', 'Gấu Mèo', 'Vịt Vàng', 'Cáo Nhỏ', 'Chuột Lắt', 'Rùa Con', 'Sao Biển',
  'Sư Tử', 'Ong Vàng', 'Chim Công', 'Mây Xám', 'Ong Mật', 'Chim Sâu', 'Gấu Bắc Cực', 'Kỳ Lân', 'Khủng Long', 'Cá Voi',
  'Hà Mã', 'Lạc Đà', 'Chuồn Chuồn', 'Bướm Xinh', 'Thỏ Trắng', 'Mèo Tam Thể', 'Cừu Bông', 'Ngựa Vằn']
const used = new Set()
const nameFor = category => {
  let name
  do name = `${pick(KIND[category])} ${pick(CUTE)}`; while (used.has(name))
  used.add(name)
  return name
}
const DISHES = {
  bun_pho_mi: ['Phở bò', 'Bún chả', 'Bún bò', 'Mì vằn thắn', 'Hủ tiếu', 'Quẩy', 'Mì trộn', 'Bún cá'],
  com: ['Cơm tấm sườn', 'Cơm rang dưa bò', 'Cơm gà', 'Canh chua', 'Trứng ốp', 'Cơm sườn', 'Cơm chiên'],
  banh_mi_xoi: ['Bánh mì pate', 'Bánh mì trứng', 'Xôi xéo', 'Xôi gấc', 'Xôi thịt', 'Bánh mì que', 'Xôi ngô'],
  an_vat: ['Xiên nướng', 'Nem chua rán', 'Bánh tráng trộn', 'Ốc luộc', 'Khoai lang kén', 'Bánh gối', 'Nem nướng', 'Cá viên chiên'],
  do_uong: ['Trà sữa trân châu', 'Trà chanh', 'Sinh tố bơ', 'Trà đào', 'Sữa chua lắc', 'Trà tắc', 'Sữa đậu nành', 'Trà vải'],
  ca_phe: ['Cà phê sữa đá', 'Bạc xỉu', 'Cà phê muối', 'Cacao nóng', 'Cà phê trứng', 'Cà phê cốt dừa'],
  che: ['Chè khúc bạch', 'Chè thập cẩm', 'Tào phớ', 'Kem dừa', 'Chè bưởi', 'Chè đậu đỏ', 'Sương sáo'],
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
  5: ['Ngon xỉu, ăn xong muốn quay lại liền', 'Đáng tiền lắm, phần ăn đầy đặn', 'Quán sạch sẽ, cô chủ dễ thương', 'Ăn một lần là ghiền luôn', 'Giá sinh viên mà chất lượng ổn áp',
    'Đậm đà, ăn hết sạch không chừa miếng nào', 'Lần nào đi ngang cũng phải ghé', 'Rủ cả phòng đi ăn, ai cũng khen'],
  4: ['Ngon, hơi đông giờ trưa nên chờ chút', 'Ổn trong tầm giá, sẽ quay lại', 'Vị vừa miệng, chỗ ngồi hơi chật', 'Đồ ăn nóng hổi, phục vụ nhanh',
    'Ngon nhưng chỗ gửi xe hơi khó', 'Món chính ngon, đồ uống thì bình thường', 'Hợp ghé sau giờ học, giá ổn'],
  3: ['Tạm ổn, không có gì đặc biệt', 'Vị hơi nhạt so với mình', 'Được cái gần trường, tiện ghé', 'Phần ăn hơi ít so với giá', 'Bình thường, đói thì ghé'],
  2: ['Hôm mình đến đồ ăn hơi nguội', 'Chờ khá lâu, chắc hôm đó đông', 'Quán hơi nóng, ít quạt', 'Vị không như mình mong đợi'],
}
const NAMES = ['Mèo Ú', 'Hà Thổ Địa', 'Minh Đói Bụng', 'Tuấn Kều', 'Linh Ăn Vặt', 'Bé Na', 'Khoa K67', 'Ngọc Trà Sữa',
  'Phúc Năm Nhất', 'Thực khách 4821', 'Thực khách 0937', 'Vy Cà Phê', 'An Đi Học', 'Long Mập', 'Trang Hay Ăn',
  'Hùng Bóng Rổ', 'Mai Thích Chè', 'Dũng Năm Cuối', 'Thực khách 1204', 'Thực khách 5560', 'Quân Ăn Khuya', 'Thảo Ham Ngủ',
  ...Array.from({ length: 40 }, () => `Thực khách ${int(1000, 9999)}`)]

const percentile = (sorted, q) => { // giống percentile_cont của Postgres
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo))
}

const today = new Date('2026-10-06T12:00:00+07:00')
const places = [], reviews = {}
let placeId = 1, reviewId = 1
for (const city of CITIES) {
  const spots = spread(await roadSpots(city.box), PER_CITY)
  // Các loại món chia gần đều; mỗi quán thuộc cụm trường gần nhất (để ô "Quanh: …" vẫn lọc được)
  const C = Object.keys(KIND)
  const cats = shuffle(Array.from({ length: Math.ceil(PER_CITY / C.length) }, () => C).flat()).slice(0, PER_CITY)
  for (const [k, spot] of spots.entries()) {
    const category = cats[k]
    const area = AREAS.reduce((a, b) => meters(spot, { lat: b.center_lat, lng: b.center_lng }) < meters(spot, { lat: a.center_lat, lng: a.center_lng }) ? b : a)
    const near = meters(spot, { lat: area.center_lat, lng: area.center_lng }) <= area.radius_m
    const name = nameFor(category)
    const [lo, hi] = PRICE[category]
    const quality = rand() // quán "ngon" thì sao cao hơn
    const n = int(1, 12) // có quán dưới 3 đánh giá để thấy nhãn "Mới"
    const list = []
    for (let i = 0; i < n; i++) {
      const stars = Math.max(2, Math.min(5, Math.round(3.4 + quality * 1.8 + (rand() - 0.5) * 1.6)))
      const ago = int(0, 60)
      const date = new Date(today - ago * 864e5)
      const display_name = pick(NAMES)
      list.push({
        id: reviewId++, stars, price_paid: int(lo, hi) * 1000,
        dishes: shuffle(DISHES[category]).slice(0, int(1, 2)),
        comment: rand() < 0.85 ? pick(COMMENTS[stars]) : null,
        is_sample: true, review_date: date.toISOString().slice(0, 10), created_at: date.toISOString(),
        display_name,
      })
    }
    list.sort((a, b) => b.created_at.localeCompare(a.created_at))
    const prices = list.map(r => r.price_paid).sort((a, b) => a - b)
    const tally = {}
    for (const r of list) for (const d of r.dishes) tally[d] = (tally[d] ?? 0) + 1
    places.push({
      id: placeId, google_place_id: null, name, category, lat: +spot.lat.toFixed(6), lng: +spot.lng.toFixed(6),
      address: `${near ? 'Gần ' + area.name : city.name} (địa chỉ minh họa)`, area_id: area.id,
      price_min: lo * 1000, price_max: hi * 1000, opening_hours: HOURS[category], suggested_by_name: null,
      review_count: list.length, avg_stars: Math.round(list.reduce((s, r) => s + r.stars, 0) / list.length * 10) / 10,
      price_count: prices.length, price_median: percentile(prices, 0.5), price_p25: percentile(prices, 0.25), price_p75: percentile(prices, 0.75),
      top_dishes: Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n })),
      cover_path: null, cover_at: null,
    })
    reviews[placeId++] = list
  }
}

// Số đánh giá cạnh tên người viết: đếm đúng số đánh giá mẫu mang tên đó
const all = Object.values(reviews).flat(), byName = {}
for (const r of all) byName[r.display_name] = (byName[r.display_name] ?? 0) + 1
for (const r of all) r.author_review_count = byName[r.display_name]

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
