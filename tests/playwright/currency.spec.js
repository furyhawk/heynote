import { test, expect } from '@playwright/test'
import pkg from '../../package.json'

test('currency request includes client headers', async ({ page }) => {
    let currencyRequest = null

    await page.route('https://currencies.heynote.com/rates.json', async (route) => {
        currencyRequest = route.request()
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                base: 'USD',
                rates: { EUR: 0.9 },
                timestamp: 1700000000,
            }),
        })
    })

    await page.goto(process.env.HEYNOTE_TEST_BASE_URL || '/')

    await expect.poll(() => currencyRequest).not.toBeNull()

    const headers = currencyRequest.headers()
    expect(headers['x-client-id']).toBe('testing')
    expect(headers['x-client-version']).toBe(`${pkg.version}-web`)
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('clientId'))).toBe(headers['x-client-id'])
})

test('currency request failure does not surface as a page error', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (error) => {
        pageErrors.push(`[${error.name}] ${error.message}`)
    })

    await page.route('https://currencies.heynote.com/rates.json', async (route) => {
        await route.abort()
    })

    await page.goto(process.env.HEYNOTE_TEST_BASE_URL || '/')
    await expect(page).toHaveTitle(/Heynote/)
    await expect(page.locator(".cm-editor")).toBeVisible()
    expect(pageErrors).toStrictEqual([])
})
