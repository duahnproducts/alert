import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOpenNow, hoursText, distanceM, normalizeVi, isInAppBrowser, filterPrice, priceShort, scoreShort, badgeFor, formatPrice, placeLabel } from './util.js'

// Giờ Việt Nam = UTC+7. 05/10/2026 là thứ Hai, 04/10/2026 là Chủ nhật.
const vn = (date, time) => new Date(`${date}T${time}:00+07:00`)
const hours = { all: [['06:30', '13:30'], ['17:00', '21:00']], 0: [] }
const night = { all: [['18:00', '02:00']] }

test('isOpenNow: trong giờ, ngoài giờ, ngày nghỉ', () => {
  assert.equal(isOpenNow(hours, vn('2026-10-05', '11:30')), true)
  assert.equal(isOpenNow(hours, vn('2026-10-05', '15:00')), false)
  assert.equal(isOpenNow(hours, vn('2026-10-05', '21:00')), false, 'giờ đóng là đã đóng')
  assert.equal(isOpenNow(hours, vn('2026-10-04', '11:30')), false, 'Chủ nhật nghỉ')
  assert.equal(isOpenNow(null), null, 'không rõ giờ')
})

test('isOpenNow: khung qua đêm', () => {
  assert.equal(isOpenNow(night, vn('2026-10-05', '23:00')), true)
  assert.equal(isOpenNow(night, vn('2026-10-06', '01:30')), true, 'phần sau nửa đêm của hôm qua')
  assert.equal(isOpenNow(night, vn('2026-10-06', '02:30')), false)
  assert.equal(isOpenNow({ 0: [['18:00', '02:00']], 1: [] }, vn('2026-10-05', '01:00')), true, 'thứ Hai 1h sáng vẫn thuộc khung Chủ nhật')
})

test('isOpenNow: tính theo giờ Việt Nam, không theo giờ máy', () => {
  assert.equal(isOpenNow(hours, new Date('2026-10-05T04:30:00Z')), true) // 11:30 VN
})

test('hoursText', () => {
  assert.equal(hoursText(hours, vn('2026-10-05', '11:30')), 'Đang mở · đóng lúc 13:30')
  assert.equal(hoursText(hours, vn('2026-10-05', '15:00')), 'Đã đóng · mở lúc 17:00')
  assert.equal(hoursText(hours, vn('2026-10-05', '22:00')), 'Đã đóng · hết giờ hôm nay')
  assert.equal(hoursText(hours, vn('2026-10-04', '10:00')), 'Hôm nay nghỉ')
  assert.equal(hoursText(night, vn('2026-10-06', '01:00')), 'Đang mở · đóng lúc 02:00')
  assert.equal(hoursText(null), null)
})

test('distanceM', () => {
  assert.ok(Math.abs(distanceM({ lat: 21, lng: 105.8 }, { lat: 22, lng: 105.8 }) - 111195) < 10, '1 độ vĩ ≈ 111,2 km')
  assert.ok(Math.abs(distanceM({ lat: 21, lng: 105.8 }, { lat: 21.0003, lng: 105.8 }) - 33.4) < 1)
  assert.equal(distanceM({ lat: 21, lng: 105.8 }, { lat: 21, lng: 105.8 }), 0)
})

test('normalizeVi', () => {
  assert.equal(normalizeVi('Bún chả Hương'), 'bun cha huong')
  assert.equal(normalizeVi('ĐẬU ĐŨA'), 'dau dua')
  assert.ok(normalizeVi('Bánh mì Phượng').includes(normalizeVi('banh mi')))
})

test('isInAppBrowser', () => {
  const fb = 'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/485.0.0.39.104;]'
  const fbIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/485.0.0.36.104;FBBV/123;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5]'
  const messenger = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 LightSpeed [FBAN/MessengerLiteForiOS;FBAV/485.0.0.36.104;FBBV/123;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.6;FBSS/3;FBCR/;FBID/phone;FBLC/vi_VN;FBOP/0]'
  const zalo = 'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Zalo android/12100668 ZaloTheme/light ZaloLanguage/vi'
  const insta = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.21.106 (iPhone14,5; iOS 17_6; vi_VN; vi; scale=3.00; 1170x2532; 640013443)'
  const chrome = 'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36'
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
  for (const ua of [fb, fbIos, messenger, zalo, insta]) assert.equal(isInAppBrowser(ua), true, ua)
  for (const ua of [chrome, safari]) assert.equal(isInAppBrowser(ua), false, ua)
})

test('giá: giá thật từ 3 lượt báo, ít hơn thì giá tham khảo', () => {
  const real = { price_count: 3, price_median: 35000, price_min: 30000, price_max: 45000 }
  const ref = { price_count: 2, price_median: 20000, price_min: 30000, price_max: 45000 }
  assert.equal(filterPrice(real), 35000)
  assert.equal(filterPrice(ref), 45000)
  assert.equal(priceShort(real), 'Giá thật 35k')
  assert.equal(priceShort(real, true), 'Giá mẫu 35k', 'bản demo không được ghi là giá thật')
  assert.equal(priceShort(ref), '30k–45k (tham khảo)')
  assert.equal(priceShort({ price_count: 0 }), 'Chưa rõ giá')
  assert.equal(formatPrice(32500), '32,5k')
})

test('điểm: dưới 3 đánh giá hiện "Mới"', () => {
  assert.equal(scoreShort({ review_count: 2, avg_stars: 5 }), 'Mới')
  assert.equal(scoreShort({ review_count: 3, avg_stars: 4.6 }), '4,6★')
})

test('huy hiệu', () => {
  assert.equal(badgeFor(1), 'Mới đến')
  assert.equal(badgeFor(5), 'Hàng xóm')
  assert.equal(badgeFor(15), 'Thổ địa')
})

test('nhãn đọc màn hình của ghim', () => {
  const p = { name: 'Bún chả Hương', price_count: 3, price_median: 35000, review_count: 23, avg_stars: 4.6 }
  assert.equal(placeLabel(p, 300), 'Bún chả Hương, 35 nghìn, 4,6 sao, cách 300 mét')
})
