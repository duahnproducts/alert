// Hàm thuần, không đụng DOM hay mạng. Test ở util.test.js (npm test).

export const CATEGORIES = {
  bun_pho_mi: { label: 'Bún, phở, mì', color: '#F6C445' },
  com: { label: 'Cơm', color: '#7BC67E' },
  banh_mi_xoi: { label: 'Bánh mì, xôi', color: '#E8A15A' },
  an_vat: { label: 'Ăn vặt', color: '#FF8FB1' },
  do_uong: { label: 'Trà sữa, đồ uống', color: '#B79CED' },
  ca_phe: { label: 'Cà phê học bài', color: '#A47551' },
  che: { label: 'Chè, tráng miệng', color: '#6CC5C0' },
}

export const normalizeVi = s =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export function distanceM(a, b) {
  const rad = d => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

const vnNow = now => new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3)
const rangesOf = (hours, d) => hours[d] ?? hours.all ?? []

// hours: { "all": [["06:30","13:30"]], "0": [] }, khóa là Date.getDay() ("0" = Chủ nhật). Khung qua đêm: giờ đóng < giờ mở.
export function isOpenNow(hours, now = new Date()) {
  if (!hours) return null // không rõ giờ: không lọc, không hiện "Đang mở"
  const vn = vnNow(now)
  const day = vn.getDay(), m = vn.getHours() * 60 + vn.getMinutes()
  for (const [a, b] of rangesOf(hours, day)) {
    const s = toMin(a), e = toMin(b)
    if (e > s ? m >= s && m < e : m >= s) return true
  }
  for (const [a, b] of rangesOf(hours, (day + 6) % 7)) { // phần sau nửa đêm của khung hôm qua
    if (toMin(b) <= toMin(a) && m < toMin(b)) return true
  }
  return false
}

// "Đang mở · đóng lúc 21:00" / "Đã đóng · mở lúc 17:00" / "Hôm nay nghỉ" / null nếu không rõ giờ
export function hoursText(hours, now = new Date()) {
  const open = isOpenNow(hours, now)
  if (open === null) return null
  const vn = vnNow(now)
  const day = vn.getDay(), m = vn.getHours() * 60 + vn.getMinutes()
  const today = rangesOf(hours, day)
  if (open) {
    const cur = today.find(([a, b]) => {
      const s = toMin(a), e = toMin(b)
      return e > s ? m >= s && m < e : m >= s
    }) ?? rangesOf(hours, (day + 6) % 7).find(([a, b]) => toMin(b) <= toMin(a))
    return `Đang mở · đóng lúc ${cur[1]}`
  }
  const next = today.find(([a]) => toMin(a) > m)
  if (next) return `Đã đóng · mở lúc ${next[0]}`
  return today.length ? 'Đã đóng · hết giờ hôm nay' : 'Hôm nay nghỉ'
}

// 35000 -> "35k", 32500 -> "32,5k"
export const formatPrice = v => (v / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'k'

export const formatStars = v => Number(v).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const formatDistance = m => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`)

// Giá dùng để lọc và sắp xếp: giá thật nếu có từ 3 lượt báo giá, nếu không thì giá cao nhất nhóm ghi lúc khảo sát.
export const filterPrice = p => (p.price_count >= 3 ? p.price_median : p.price_max)

// Dòng giá ngắn cho thẻ và danh sách. sample: bản demo, giá là giá mẫu chứ không phải giá thật
export function priceShort(p, sample = false) {
  if (p.price_count >= 3) return `${sample ? 'Giá mẫu' : 'Giá thật'} ${formatPrice(p.price_median)}`
  if (p.price_min && p.price_max) return `${formatPrice(p.price_min)}–${formatPrice(p.price_max)} (tham khảo)`
  return 'Chưa rõ giá'
}

// Dưới 3 đánh giá hiện "Mới"
export const scoreShort = p => (p.review_count >= 3 ? `${formatStars(p.avg_stars)}★` : 'Mới')

export const isTopPlace = p => p.review_count >= 5 && p.avg_stars >= 4.5

export const badgeFor = n => (n >= 15 ? 'Thổ địa' : n >= 5 ? 'Hàng xóm' : 'Mới đến')

export const isInAppBrowser = ua => /FBAN|FBAV|FB_IAB|Instagram|Zalo/i.test(ua)

export function timeAgo(iso, now = new Date()) {
  const days = Math.floor((now - new Date(iso)) / 86400000)
  if (days < 1) return 'hôm nay'
  if (days < 30) return `${days} ngày trước`
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`
  return `${Math.floor(days / 365)} năm trước`
}

export const formatDate = iso => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// Nhãn đọc màn hình cho ghim: "Bún chả Hương, 35 nghìn, 4,6 sao, cách 300 mét"
export function placeLabel(p, distM) {
  const price = filterPrice(p)
  return [
    p.name,
    price ? `${Math.round(price / 1000)} nghìn` : null,
    p.review_count >= 3 ? `${formatStars(p.avg_stars)} sao` : 'quán mới',
    distM != null ? `cách ${formatDistance(distM).replace(' m', ' mét').replace(' km', ' ki lô mét')}` : null,
  ].filter(Boolean).join(', ')
}

// Dựng phần tử DOM. Chuỗi con được thêm dưới dạng text node, không bao giờ qua innerHTML (chặn XSS).
// props: "class", "onclick"..., thuộc tính DOM kiểu không phải chuỗi (hidden, disabled...), còn lại là attribute.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else if (k in el && typeof v !== 'string') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  el.append(...kids.flat(9).filter(c => c != null && c !== false))
  return el
}
