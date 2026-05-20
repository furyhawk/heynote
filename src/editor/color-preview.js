import { RangeSetBuilder } from "@codemirror/state"
import { Decoration, ViewPlugin, WidgetType } from "@codemirror/view"

import { getNoteBlockFromPos } from "./block/block"


const colorStartBoundary = String.raw`(^|[^\w#])` // Before the color must be start of text, or not \w / #.
const colorEndBoundary = String.raw`(?!\w)` // After the color must not be \w.
const hexColor = String.raw`#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})`
const rgbColor = String.raw`rgba?\([^()\n]*\)`
const hslColor = String.raw`hsla?\([^()\n]*\)`

const colorCandidateRegex = new RegExp(
    `${colorStartBoundary}(${[
        hexColor,
        rgbColor,
        hslColor,
    ].join("|")})${colorEndBoundary}`,
    "gi",
)

const previewLanguages = new Set(["css", "html", "javascript", "typescript", "vue", "tsx"])

function isValidCssColor(color) {
    if (window.CSS?.supports?.("color", color)) {
        return true
    }

    // Check whether the browser can parse this as a CSS color.
    const testElement = document.createElement("span")
    testElement.style.color = color
    return testElement.style.color !== ""
}

function shouldPreviewColor(state, pos) {
    const block = getNoteBlockFromPos(state, pos)
    return previewLanguages.has(block?.language?.name)
}

class ColorPreviewWidget extends WidgetType {
    constructor(color) {
        super()
        this.color = color
    }

    eq(other) {
        return other.color === this.color
    }

    toDOM() {
        const swatch = document.createElement("span")
        swatch.className = "heynote-color-preview"
        swatch.style.backgroundColor = this.color
        swatch.title = this.color
        swatch.setAttribute("aria-hidden", "true")
        return swatch
    }

    ignoreEvent() {
        return true
    }
}

function buildColorPreviewDecorations(view) {
    const builder = new RangeSetBuilder()

    for (const { from, to } of view.visibleRanges) {
        const text = view.state.sliceDoc(from, to)
        let match
        colorCandidateRegex.lastIndex = 0
        while ((match = colorCandidateRegex.exec(text)) !== null) {
            const color = match[2]
            if (!isValidCssColor(color)) {
                continue
            }

            const pos = from + match.index + match[1].length
            if (!shouldPreviewColor(view.state, pos)) {
                continue
            }

            builder.add(pos, pos, Decoration.widget({
                widget: new ColorPreviewWidget(color),
                side: 1,
            }))
        }
    }

    return builder.finish()
}

export const colorPreviewExtension = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = buildColorPreviewDecorations(view)
    }

    update(update) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = buildColorPreviewDecorations(update.view)
        }
    }
}, {
    decorations: instance => instance.decorations,
})
