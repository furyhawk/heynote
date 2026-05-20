const HEYNOTE_TAG_REGEX = /<∞.*?∞>/g
const BLOCK_DELIMITER_LINE_REGEX = /^∞∞∞[^\r\n]*$/
const METADATA_KEYS = new Set([
    "formatVersion",
    "name",
    "tags",
    "cursors",
    "foldedRanges",
])

function isMetadataLine(line, lineNumber) {
    if (lineNumber !== 1) {
        return false
    }
    const trimmed = line.trim()
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        return false
    }
    try {
        const metadata = JSON.parse(trimmed)
        return metadata && typeof metadata === "object" &&
            Object.keys(metadata).some((key) => METADATA_KEYS.has(key))
    } catch {
        return false
    }
}

function syntaxRangesForLine(line, lineNumber) {
    if (isMetadataLine(line, lineNumber) || BLOCK_DELIMITER_LINE_REGEX.test(line)) {
        return [{ start: 0, end: line.length }]
    }

    const ranges = []
    for (const match of line.matchAll(HEYNOTE_TAG_REGEX)) {
        ranges.push({
            start: match.index,
            end: match.index + match[0].length,
        })
    }
    return ranges
}

function overlapsAnyRange(item, ranges) {
    return ranges.some((range) => item.start < range.end && range.start < item.end)
}

function rawIndexToDisplayIndex(rawIndex, ranges) {
    let displayIndex = rawIndex
    for (const range of ranges) {
        if (range.end <= rawIndex) {
            displayIndex -= range.end - range.start
        }
    }
    return displayIndex
}

function removeRanges(line, ranges) {
    if (ranges.length === 0) {
        return line
    }
    let cursor = 0
    let result = ""
    for (const range of ranges) {
        result += line.slice(cursor, range.start)
        cursor = range.end
    }
    result += line.slice(cursor)
    return result
}

export function normalizeLibrarySearchMatch({ line, lineNumber, submatches }) {
    const syntaxRanges = syntaxRangesForLine(line, lineNumber)
    const visibleSubmatches = (submatches || []).filter((submatch) => !overlapsAnyRange(submatch, syntaxRanges))
    if (visibleSubmatches.length === 0) {
        return null
    }

    const displayLine = removeRanges(line, syntaxRanges)
    const displaySubmatches = visibleSubmatches.map((submatch) => ({
        start: rawIndexToDisplayIndex(submatch.start, syntaxRanges),
        end: rawIndexToDisplayIndex(submatch.end, syntaxRanges),
        text: submatch.text,
    }))

    return {
        line,
        displayLine,
        lineNumber,
        submatches: visibleSubmatches,
        displaySubmatches,
    }
}
