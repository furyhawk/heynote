import { expect, test } from "@playwright/test"
import { DEFAULT_LEFT_PANEL_WIDTH } from "@/src/common/constants.js"
import { HeynotePage } from "./test-utils.js"

function createBufferContent(name, content = "") {
    return JSON.stringify({
        formatVersion: "2.0.0",
        name,
    }) + `\n∞∞∞text-a;created=2026-01-01T00:00:00.000Z\n${content}`
}

function installLibraryState() {
    const settings = {
        showLeftPanel: true,
        leftPanelWidth: DEFAULT_LEFT_PANEL_WIDTH,
        bufferTreeOpenFolders: ["folder-a", "missing-folder"],
    }
    const notes = {
        "scratch.txt": createBufferContent("Scratch", "Scratch content"),
        "root-note.txt": createBufferContent("Root Note", "Root content"),
        "folder-a/nested-note.txt": createBufferContent("Nested Note", "Nested content"),
        "folder-a/folder-b/deep-note.txt": createBufferContent("Deep Note", "Deep content"),
    }
    return { settings, notes }
}

function modifierKey() {
    return process.platform === "darwin" ? "Meta" : "Control"
}

test.describe("sidebar buffer tree", () => {
    test.beforeEach(async ({ page }) => {
        const state = installLibraryState()
        await page.addInitScript((seed) => {
            localStorage.clear()
            localStorage.setItem("settings", JSON.stringify(seed.settings))
            for (const [path, content] of Object.entries(seed.notes)) {
                localStorage.setItem(`heynote-library__${path}`, content)
            }
        }, state)

        const heynotePage = new HeynotePage(page)
        await heynotePage.goto()
    })

    test("renders tree and toggles folders", async ({ page }) => {
        const tree = page.locator(".buffer-tree")
        await expect(tree).toBeVisible()

        await expect(page.locator(".buffer-tree .buffer", { hasText: "Scratch" })).toBeVisible()
        await expect(page.locator(".buffer-tree .buffer", { hasText: "Root Note" })).toBeVisible()
        await expect(page.locator(".buffer-tree .buffer", { hasText: "Nested Note" })).toBeVisible()
        await expect.poll(async () => {
            const settings = JSON.parse(await page.evaluate(() => localStorage.getItem("settings") || "{}"))
            return settings.bufferTreeOpenFolders || []
        }).toEqual(["folder-a"])

        await page.locator(".buffer-tree .folder", { hasText: "folder-a" }).click()
        await expect(page.locator(".buffer-tree .buffer", { hasText: "Nested Note" })).toHaveCount(0)
        await expect(page.locator(".buffer-tree .folder", { hasText: "folder-b" })).toHaveCount(0)

        await page.locator(".buffer-tree .folder", { hasText: "folder-a" }).click()
        await expect(page.locator(".buffer-tree .folder", { hasText: "folder-b" })).toBeVisible()

        await page.locator(".buffer-tree .folder", { hasText: "folder-b" }).click()
        await expect(page.locator(".buffer-tree .buffer", { hasText: "Deep Note" })).toBeVisible()

        await page.locator(".buffer-tree .folder", { hasText: "folder-a" }).click()
        await expect(page.locator(".buffer-tree .buffer", { hasText: "Nested Note" })).toHaveCount(0)
    })

    test("shows indentation guide lines when the sidebar is hovered", async ({ page }) => {
        const nestedBufferGuide = page
            .locator(".buffer-tree .buffer", { hasText: "Nested Note" })
            .locator(".indent-guide")
            .first()

        await expect(nestedBufferGuide).toHaveCount(1)

        await page.mouse.move(500, 200)
        await expect.poll(async () => {
            return await nestedBufferGuide.evaluate((element) => window.getComputedStyle(element).opacity)
        }).toBe("0")

        await page.locator(".left-panel").hover()
        await expect.poll(async () => {
            return await nestedBufferGuide.evaluate((element) => window.getComputedStyle(element).opacity)
        }).toBe("1")

        await page.evaluate(() => window._heynote_buffer_tree.onCreateFolderRequested(null, "folder-a"))
        const newFolderGuide = page.locator(".buffer-tree .show-indent-guides .indent-guide").first()
        await expect(newFolderGuide).toHaveCount(1)
        await expect.poll(async () => {
            return await newFolderGuide.evaluate((element) => window.getComputedStyle(element).opacity)
        }).toBe("1")
    })

    test("opens selected buffer from tree", async ({ page }) => {
        await page.locator(".buffer-tree .folder", { hasText: "folder-b" }).click()
        await page.locator(".buffer-tree .buffer", { hasText: "Deep Note" }).click()

        await expect(page.locator(".status .note")).toContainText("Deep Note")
        await expect(page.locator(".buffer-tree .buffer.active", { hasText: "Deep Note" })).toBeVisible()
        await expect.poll(async () => {
            return await page.evaluate(() => window._heynote_editor.getContent())
        }).toContain("Deep content")
    })

    test("supports keyboard navigation", async ({ page }) => {
        const tree = page.locator(".buffer-tree")
        await tree.focus()
        await expect(tree).toBeFocused()

        const folderA = page.locator(".buffer-tree .folder", { hasText: "folder-a" })
        const folderB = page.locator(".buffer-tree .folder", { hasText: "folder-b" })
        const deepNote = page.locator(".buffer-tree .buffer", { hasText: "Deep Note" })

        for (let i = 0; i < 10; i++) {
            await tree.press("ArrowUp")
        }
        await expect(folderA).toHaveClass(/selected/)
        await expect(folderA).toHaveCSS("outline-style", "solid")

        await page.locator(".cm-editor").click()
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
        await expect(folderA).toHaveCSS("outline-style", "none")
        await tree.focus()

        await tree.press("ArrowDown")
        await expect(folderB).toHaveClass(/selected/)

        await tree.press("ArrowRight")
        await expect(deepNote).toBeVisible()
        await expect(folderB).toHaveAttribute("aria-expanded", "true")

        await tree.press("ArrowDown")
        await expect(deepNote).toHaveClass(/selected/)

        await tree.press("Enter")
        await expect(page.locator(".status .note")).toContainText("Deep Note")
        await expect(page.locator(".buffer-tree .buffer.active", { hasText: "Deep Note" })).toBeVisible()

        await tree.press("ArrowUp")
        await expect(folderB).toHaveClass(/selected/)

        await tree.press("ArrowLeft")
        await expect(deepNote).toHaveCount(0)
        await expect(folderB).toHaveAttribute("aria-expanded", "false")
    })

    test("focuses the editor when Escape is pressed in the tree", async ({ page }) => {
        const tree = page.locator(".buffer-tree")
        await tree.focus()
        await expect(tree).toBeFocused()

        await tree.press("Escape")
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
        await expect(tree).not.toBeFocused()
    })

    test("status bar sidebar button toggles left panel", async ({ page }) => {
        await expect(page.locator(".left-panel")).toBeVisible()

        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toHaveCount(0)

        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toBeVisible()
    })

    test("restores open folders when sidebar is remounted", async ({ page }) => {
        await page.locator(".buffer-tree .folder", { hasText: "folder-b" }).click()
        await expect(page.locator(".buffer-tree .buffer", { hasText: "Deep Note" })).toBeVisible()

        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toHaveCount(0)
        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toBeVisible()

        await expect(page.locator(".buffer-tree .buffer", { hasText: "Deep Note" })).toBeVisible()
    })

    test("toggleLeftPanel command toggles left panel", async ({ page }) => {
        await expect(page.locator(".left-panel")).toBeVisible()

        await page.evaluate(() => window._heynote_editor.executeCommand("toggleLeftPanel"))
        await expect(page.locator(".left-panel")).toHaveCount(0)

        await page.evaluate(() => window._heynote_editor.executeCommand("toggleLeftPanel"))
        await expect(page.locator(".left-panel")).toBeVisible()
    })

    test("openBufferExplorer shortcut opens and toggles focus for the buffer tree", async ({ page }) => {
        await page.evaluate(() => window._heynote_editor.executeCommand("toggleLeftPanel"))
        await expect(page.locator(".left-panel")).toHaveCount(0)

        await page.locator(".cm-editor").click()
        await page.keyboard.press(`${modifierKey()}+Shift+E`)

        const tree = page.locator(".buffer-tree")
        await expect(page.locator(".left-panel")).toBeVisible()
        await expect(tree).toBeFocused()

        await page.keyboard.press(`${modifierKey()}+Shift+E`)
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
    })

    test("resizes panel and persists width on mouseup", async ({ page }) => {
        const leftPanel = page.locator(".left-panel")
        const resizer = page.locator(".left-panel .resizer")
        const before = await leftPanel.boundingBox()
        expect(before).not.toBeNull()

        const dragDelta = 120
        const startX = before.x + before.width - 1
        const y = before.y + 20
        await page.mouse.move(startX, y)
        await page.mouse.down()
        await page.mouse.move(startX + dragDelta, y)
        await page.mouse.up()

        await expect.poll(async () => {
            const settings = JSON.parse(await page.evaluate(() => localStorage.getItem("settings") || "{}"))
            return settings.leftPanelWidth
        }).toBe(Math.round(before.width + dragDelta))

        const after = await leftPanel.boundingBox()
        expect(after.width).toBeGreaterThan(before.width + 100)
    })

    test("moves buffer into folder by drag and drop", async ({ page }) => {
        const source = page.locator(".buffer-tree .buffer", { hasText: "Root Note" })
        const target = page.locator(".buffer-tree .folder", { hasText: "folder-a" })

        await source.dragTo(target)

        await expect.poll(async () => {
            return await page.evaluate(async () => {
                const buffers = await window.heynote.buffer.getList()
                return !!buffers["folder-a/root-note.txt"] && !buffers["root-note.txt"]
            })
        }).toBe(true)

        await expect(page.locator(".buffer-tree .buffer", { hasText: "Root Note" })).toBeVisible()
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
    })

    test("drops buffer on nested buffer and moves to that subdirectory", async ({ page }) => {
        await page.locator(".buffer-tree .folder", { hasText: "folder-b" }).click()

        const source = page.locator(".buffer-tree .buffer", { hasText: "Root Note" })
        const nestedTargetBuffer = page.locator(".buffer-tree .buffer", { hasText: "Deep Note" })

        await source.dragTo(nestedTargetBuffer)

        await expect.poll(async () => {
            return await page.evaluate(async () => {
                const buffers = await window.heynote.buffer.getList()
                return !!buffers["folder-a/folder-b/root-note.txt"] && !buffers["root-note.txt"]
            })
        }).toBe(true)

        await expect(page.locator(".buffer-tree .buffer", { hasText: "Root Note" })).toBeVisible()
    })

    test("does not move buffer when dropped on itself", async ({ page }) => {
        await page.locator(".buffer-tree .folder", { hasText: "folder-b" }).click()

        const source = page.locator(".buffer-tree .buffer", { hasText: "Deep Note" })
        await source.dragTo(source)

        await expect.poll(async () => {
            return await page.evaluate(async () => {
                const buffers = await window.heynote.buffer.getList()
                return !!buffers["folder-a/folder-b/deep-note.txt"] && !buffers["deep-note.txt"]
            })
        }).toBe(true)
    })
})
