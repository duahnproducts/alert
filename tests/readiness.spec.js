import { test, expect } from '@playwright/test'

async function prepare(page) {
  await page.addInitScript(() => localStorage.setItem('qq-city', 'Hà Nội'))
  await page.route('https://fonts.googleapis.com/**', r => r.abort())
  await page.route('https://tiles.openfreemap.org/planet', r => r.fulfill({ json: { tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'] } }))
  await page.route('https://tiles.test/**', r => r.fulfill({ body: Buffer.alloc(0) }))
}

test('tải demo lỗi HTTP rồi Thử lại phục hồi được', async ({ page }) => {
  await prepare(page)
  let attempts = 0
  await page.route('**/demo.json', async r => {
    attempts++
    if (attempts === 1) await r.fulfill({ status: 503, body: 'unavailable' })
    else await r.continue()
  })
  await page.goto('./')
  await expect(page.getByText('Chưa tải được quán', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('#list .place-item').first()).toBeVisible()
  expect(attempts).toBe(2)
})

test('bỏ qua bản đồ mở danh sách và đưa focus tới danh sách', async ({ page }) => {
  await prepare(page)
  await page.goto('./')
  await page.keyboard.press('Tab')
  await page.getByRole('link', { name: 'Bỏ qua bản đồ, tới danh sách quán' }).press('Enter')
  await expect(page.locator('#home')).toHaveClass(/listmode/)
  await expect(page.locator('#list')).toBeFocused()
})

test('danh sách rỗng thành công không hiện thông báo mất mạng', async ({ page }) => {
  await prepare(page)
  await page.route('**/demo.json', r => r.fulfill({ json: { places: [], areas: [], reviews: {} } }))
  await page.goto('./')
  await expect(page.getByText('Chưa có quán nào', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toHaveCount(0)
})

test('chỉ ghim địa danh của thành phố đang xem; font lỗi vẫn có bản đồ', async ({ page }) => {
  await prepare(page)
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Địa danh: Hoàng thành Thăng Long', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Địa danh: Dinh Độc Lập', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Hà Nội ▾' }).click()
  await page.getByRole('button', { name: 'TP. Hồ Chí Minh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Địa danh: Dinh Độc Lập', exact: true })).toBeAttached()
  await expect(page.getByRole('button', { name: 'Địa danh: Hoàng thành Thăng Long', exact: true })).toHaveCount(0)
})

test('giới thiệu không còn thông tin liên hệ mẫu', async ({ page }) => {
  await page.goto('gioi-thieu')
  await expect(page.locator('#page')).not.toContainText('CẦN ĐIỀN')
  await expect(page.locator('#page a[href="mailto:example@example.com"]')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'trang Issues của dự án' })).toHaveAttribute('href', 'https://github.com/duahnproducts/alert/issues')
})
