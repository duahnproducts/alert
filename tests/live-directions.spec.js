import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const landmarks = JSON.parse(readFileSync(new URL('../public/landmarks.json', import.meta.url)))
test('tuyến thật ở Hà Nội và TP.HCM, ba chế độ', async ({ page }) => {
  test.skip(!process.env.RUN_LIVE, 'RUN_LIVE=1 để kiểm tra dịch vụ công cộng (6 yêu cầu)')
  test.setTimeout(120000)
  await page.addInitScript(() => {
    localStorage.setItem('qq-city', 'Hà Nội')
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition(ok, err) { setTimeout(() => err({ code: 1 }), 0); return 1 }, clearWatch() {},
    } })
  })
  for (const p of [landmarks[0], landmarks.find(p => p.lat < 16)]) {
    await page.goto(`dia-danh/${p.id}/chi-duong`)
    await expect(page.locator('.route-sum')).toContainText('tới nơi lúc', { timeout: 30000 })
    for (const mode of ['motor_scooter', 'auto', 'pedestrian']) {
      // Giữ dưới 1 yêu cầu/giây trên máy chủ demo.
      await page.waitForTimeout(1100)
      await page.locator(`[data-mode="${mode}"]`).click()
      await expect(page.locator('.route-sum')).toContainText('tới nơi lúc', { timeout: 30000 })
      await expect(page.locator('.steps li').first()).toBeVisible()
    }
    await page.screenshot({ path: `test-results/live-${p.id}.png`, fullPage: true })
    await page.waitForTimeout(1100)
  }
})
