import { test, expect } from "@playwright/test";
import { HeynotePage } from "./test-utils.js";

let heynotePage

test.beforeEach(async ({ page }) => {
    heynotePage = new HeynotePage(page)
    await heynotePage.goto()
});

test("color previews are shown for valid CSS colors in supported languages", async ({ page }) => {
    await heynotePage.setContent(`
∞∞∞css
.button {
    color: #123456;
    background: rgba(255, 0, 128, 0.5);
    border-color: not-a-color;
}
∞∞∞text
Plain text #abcdef
∞∞∞python
color = "#fedcba"
`)

    const previews = page.locator(".heynote-color-preview")
    await expect(previews).toHaveCount(2)
    await expect(previews.nth(0)).toHaveAttribute("title", "#123456")
    await expect(previews.nth(1)).toHaveAttribute("title", "rgba(255, 0, 128, 0.5)")
})

test("color previews can be disabled and re-enabled from settings", async ({ page }) => {
    await heynotePage.setContent(`
∞∞∞css
.button {
    color: #123456;
}
`)

    await expect(page.locator(".heynote-color-preview")).toHaveCount(1)

    await page.locator("css=.status-block.settings").click()
    await page.locator("css=li.tab-appearance").click()
    await page.getByLabel("Show color previews").click()

    await expect(page.locator(".heynote-color-preview")).toHaveCount(0)
    expect((await heynotePage.getStoredSettings()).colorPreviewEnabled).toBe(false)

    await page.getByLabel("Show color previews").click()

    await expect(page.locator(".heynote-color-preview")).toHaveCount(1)
    expect((await heynotePage.getStoredSettings()).colorPreviewEnabled).toBe(true)
})

test("color preview is rendered to the right of the cursor at the color start", async ({ page }) => {
    await heynotePage.setContent(`
∞∞∞css
.button {
    color: #123456;
}
`)

    const colorStart = await page.evaluate(() => window._heynote_editor.view.state.doc.toString().indexOf("#123456"))
    await heynotePage.setCursorPosition(colorStart)
    await page.evaluate(() => window._heynote_editor.view.focus())

    await expect(page.locator(".heynote-color-preview")).toHaveCount(1)
    await expect(page.locator(".cm-cursor-primary")).toBeVisible()

    const positions = await page.evaluate(() => {
        const cursor = document.querySelector(".cm-cursor-primary").getBoundingClientRect()
        const preview = document.querySelector(".heynote-color-preview").getBoundingClientRect()
        return {
            cursorLeft: cursor.left,
            previewLeft: preview.left,
        }
    })

    expect(positions.previewLeft).toBeGreaterThanOrEqual(positions.cursorLeft)
})
