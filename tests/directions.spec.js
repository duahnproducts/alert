import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const places = JSON.parse(readFileSync(new URL('../public/demo.json', import.meta.url))).places
const landmarks = JSON.parse(readFileSync(new URL('../public/landmarks.json', import.meta.url)))
const modes = ['motor_scooter', 'auto', 'pedestrian']

// Tuyến giả lập hợp lệ, kết thúc đúng tọa độ đích: kiểm UI toàn bộ dữ liệu mà
// không gửi 909 yêu cầu đến máy chủ demo công cộng.
function encode(points) {
  let lat = 0, lng = 0, result = ''
  const part = n => {
    let v = n < 0 ? ~(n << 1) : n << 1, s = ''
    while (v >= 32) { s += String.fromCharCode((v & 31 | 32) + 63); v >>>= 5 }
    return s + String.fromCharCode(v + 63)
  }
  for (const p of points) {
    const a = Math.round(p.lat * 1e6), b = Math.round(p.lon * 1e6)
    result += part(a - lat) + part(b - lng); lat = a; lng = b
  }
  return result
}

async function setup(page, { gps, fail = false } = {}) {
  const requests = []
  await page.addInitScript(pos => {
    localStorage.setItem('qq-city', 'Hà Nội')
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition(ok, err) {
        setTimeout(() => pos ? ok({ coords: { latitude: pos.lat, longitude: pos.lng, accuracy: 5 } }) : err({ code: 1 }), 0)
        return 1
      },
      clearWatch() {},
    } })
  }, gps)
  await page.route('https://tiles.openfreemap.org/planet', r => r.fulfill({ json: { tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'] } }))
  await page.route('https://tiles.test/**', r => r.fulfill({ body: Buffer.alloc(0) }))
  await page.route(/https:\/\/(fonts\.|.*wikimedia\.)/, r => r.abort())
  await page.route('https://valhalla1.openstreetmap.de/route?**', r => {
    const q = JSON.parse(new URL(r.request().url()).searchParams.get('json'))
    requests.push(q)
    return fail ? r.fulfill({ status: 503, body: 'unavailable' }) : r.fulfill({ json: {
      trip: { summary: { length: 4.4, time: 840 }, legs: [{ shape: encode(q.locations), maneuvers: [{ instruction: 'Đi thẳng tới điểm đến', length: 4.4 }] }] },
    } })
  })
  return requests
}

for (const [kind, list] of [['quan', places], ['dia-danh', landmarks]]) {
  for (const p of list) {
    test(`${kind}/${p.id}: ${p.name} — ba chế độ trong web`, async ({ page }) => {
      const requests = await setup(page)
      await page.goto('gioi-thieu')
      if (kind === 'quan') {
        await page.evaluate(async id => (await import('/alert/src/main.js')).navigate(`quan/${id}`), p.id)
      } else {
        await page.evaluate(async l => (await import('/alert/src/place.js')).openLandmark(l), p)
      }
      await page.getByRole('link', { name: 'Chỉ đường', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/alert/${kind}/${p.id}/chi-duong$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Đường tới ${p.name}`)
      await expect(page.locator('dialog.landmark')).toHaveCount(0)
      await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
      await expect(page.locator('.route-map .leaflet-container, .route-map.leaflet-container')).toHaveCount(1)
      await expect(page.locator('.note').filter({ hasText: 'nên Bao chỉ đường từ' })).toContainText(p.lat > 16 ? 'ĐH Kinh tế Quốc dân' : 'ĐH Kinh tế TP.HCM')
      for (const mode of modes) {
        await page.locator(`[data-mode="${mode}"]`).click()
        await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
        await expect(page.locator(`[data-mode="${mode}"]`)).toHaveAttribute('aria-pressed', 'true')
      }
      expect(new Set(requests.map(q => q.costing))).toEqual(new Set(modes))
      for (const q of requests) expect(q.locations[1]).toEqual({ lat: p.lat, lon: p.lng })
      await expect(page.locator('.route-map img[src*="undefined"]')).toHaveCount(0)
      await expect(page.locator(`.route-map img[src$="${kind === 'quan' ? p.category : `lm-${p.type}`}.svg"]`)).toHaveCount(1)
      await expect(page.getByText('Quán minh họa, không có thật ở vị trí này:', { exact: false })).toHaveCount(kind === 'quan' ? 1 : 0)
      expect(page.context().pages()).toHaveLength(1)
    })
  }
}

for (const p of [landmarks[0], landmarks.find(p => p.lat < 16)]) {
  test(`${p.id}: mở thẳng, tải lại, GPS gần và tới nơi`, async ({ page }) => {
    const requests = await setup(page, { gps: p })
    await page.goto(`dia-danh/${p.id}/chi-duong`)
    await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
    await expect(page.getByText('Tới nơi rồi! Chúc bạn tham quan vui vẻ')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ăn xong viết đánh giá' })).toHaveCount(0)
    expect(requests[0].locations[0]).toEqual({ lat: p.lat, lon: p.lng })
    expect(requests[0].costing).toBe('pedestrian')
    await page.reload()
    await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
    await page.getByRole('link', { name: '‹ Bản đồ' }).click()
    await expect(page).toHaveURL(/\/alert\/$/)
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Đường tới ${p.name}`)
  })
}

test('máy chủ lỗi: ở lại web, có thử lại và Google Maps dự phòng', async ({ page }) => {
  await setup(page, { fail: true })
  await page.goto(`dia-danh/${landmarks[0].id}/chi-duong`)
  await expect(page.locator('.route-sum')).toHaveText('Chưa tìm được đường.')
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mở bằng Google Maps' })).toHaveAttribute('target', '_blank')
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.locator('.route-sum')).toHaveText('Chưa tìm được đường.')
  expect(page.context().pages()).toHaveLength(1)
})

test('ID không tồn tại có thông báo trong web', async ({ page }) => {
  await setup(page)
  await page.goto('dia-danh/Q999999999999/chi-duong')
  await expect(page.getByText('Không thấy địa điểm này.', { exact: false })).toBeVisible()
})

test('GPS ở xa: dùng điểm xuất phát của thành phố đích', async ({ page }) => {
  await setup(page, { gps: { lat: 21, lng: 105.8 } })
  const p = landmarks.find(p => p.lat < 16)
  await page.goto(`dia-danh/${p.id}/chi-duong`)
  await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
  await expect(page.locator('.note').filter({ hasText: 'nên Bao chỉ đường từ' })).toContainText('ĐH Kinh tế TP.HCM')
})

test('lỗi tải địa danh: thử lại tải được dữ liệu', async ({ page }) => {
  await setup(page)
  let count = 0
  await page.route('**/landmarks.json', r => ++count === 1
    ? r.fulfill({ status: 503, body: 'unavailable' })
    : r.fulfill({ json: landmarks }))
  await page.goto(`dia-danh/${landmarks[0].id}/chi-duong`)
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
})

test('desktop tối: bản đồ có tuyến, không tràn ngang và giữ cache chế độ', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  const requests = await setup(page)
  await page.goto(`dia-danh/${landmarks[0].id}/chi-duong`)
  await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
  for (const mode of [...modes, ...modes]) {
    await page.locator(`[data-mode="${mode}"]`).click()
    await expect(page.locator('.route-sum')).toContainText('tới nơi lúc')
  }
  expect(requests).toHaveLength(3)
  await expect(page.locator('.route-map path[stroke="#C2410C"]')).not.toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/desktop-dark.png', fullPage: true })
})
