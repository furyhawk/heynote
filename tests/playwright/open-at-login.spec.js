import { test, expect } from "@playwright/test";
import { HeynotePage } from "./test-utils.js";

/** @type HeynotePage */
let heynotePage

test.beforeEach(async ({ page }) => {
    heynotePage = new HeynotePage(page)
    await heynotePage.goto()
});

test("Launch at login and start hidden checkboxes are hidden in webapp mode", async ({ page }) => {
    await page.locator("css=.status-block.settings").click()
    await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
    await expect(page.getByLabel("Launch at login")).toHaveCount(0)
    await expect(page.getByLabel("Start hidden")).toHaveCount(0)
})

test("Always on top checkbox is hidden in webapp mode", async ({ page }) => {
    await page.locator("css=.status-block.settings").click()
    await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
    const checkbox = page.getByLabel("Always on top")
    await expect(checkbox).toHaveCount(0)
})

test("openAtLogin default is false or undefined", async ({ page }) => {
    const settings = await heynotePage.getStoredSettings()
    // Initially settings may be null or openAtLogin may be undefined/false
    if (settings !== null && settings.openAtLogin !== undefined) {
        expect(settings.openAtLogin).toBe(false)
    } else {
        // Not set yet, which is expected default behavior
        expect(settings === null || settings.openAtLogin === undefined).toBeTruthy()
    }
})
