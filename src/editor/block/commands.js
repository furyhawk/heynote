import { EditorSelection } from "@codemirror/state"
import { 
    selectAll as defaultSelectAll, 
    moveLineUp as defaultMoveLineUp,
} from "@codemirror/commands"
import { heynoteEvent, LANGUAGE_CHANGE, CURRENCIES_LOADED } from "../annotation.js";
import { blockState, getActiveNoteBlock, getNoteBlockFromPos } from "./block"
import { moveLineDown, moveLineUp } from "./move-lines.js";

export { moveLineDown, moveLineUp }


export const insertNewBlockAtCursor = ({ state, dispatch }) => {
    if (state.readOnly)
        return false
    
    const currentBlock = getActiveNoteBlock(state)
    let delimText;
    if (currentBlock) {
        delimText = `\n∞∞∞${currentBlock.language.name}${currentBlock.language.auto ? "-a" : ""}\n`
    } else {
        delimText = "\n∞∞∞text-a\n"
    }
    dispatch(state.replaceSelection(delimText), 
        {
            scrollIntoView: true, 
            userEvent: "input",
        }
    )

    return true;
}

export const addNewBlockAfterCurrent = ({ state, dispatch }) => {
    if (state.readOnly)
        return false
    const block = getActiveNoteBlock(state)
    const delimText = "\n∞∞∞text-a\n"

    dispatch(state.update({
        changes: {
            from: block.content.to,
            insert: delimText,
        },
        selection: EditorSelection.cursor(block.content.to + delimText.length)
    }, {
        scrollIntoView: true, 
        userEvent: "input",
    }))
    return true;
}

export const selectAll = ({ state, dispatch }) => {
    const range = state.selection.asSingle().ranges[0]
    const block = getActiveNoteBlock(state)

    // handle empty blocks separately
    if (block.content.from === block.content.to) {
        // check if C-a has already been pressed
        if (range.from === block.content.from-1 && range.to === block.content.to) {
            return defaultSelectAll({state, dispatch})
        }
        dispatch(state.update({
            selection: {anchor: block.content.from-1, head: block.content.to}, 
            userEvent: "select"
        }))
        return true
    }

    // check if all the text of the note is already selected, in which case we want to select all the text of the whole document
    if (range.from === block.content.from && range.to === block.content.to) {
        return defaultSelectAll({state, dispatch})
    }

    dispatch(state.update({
        selection: {anchor: block.content.from, head: block.content.to}, 
        userEvent: "select"
    }))

    return true
}


export function changeLanguageTo(state, dispatch, block, language, auto) {
    if (state.readOnly)
        return false
    const delimRegex = /^\n∞∞∞[a-z]{0,16}(-a)?\n/g
    if (state.doc.sliceString(block.delimiter.from, block.delimiter.to).match(delimRegex)) {
        //console.log("changing language to", language)
        dispatch(state.update({
            changes: {
                from: block.delimiter.from,
                to: block.delimiter.to,
                insert: `\n∞∞∞${language}${auto ? '-a' : ''}\n`,
            },
            annotations: [heynoteEvent.of(LANGUAGE_CHANGE)],
        }))
    } else {
        throw new Error("Invalid delimiter: " + state.doc.sliceString(block.delimiter.from, block.delimiter.to))
    }
}

export function changeCurrentBlockLanguage(state, dispatch, language, auto) {
    const block = getActiveNoteBlock(state)
    changeLanguageTo(state, dispatch, block, language, auto)
}

function updateSel(sel, by) {
    return EditorSelection.create(sel.ranges.map(by), sel.mainIndex);
}
function setSel(state, selection) {
    return state.update({ selection, scrollIntoView: true, userEvent: "select" });
}
function extendSel(state, dispatch, how) {
    let selection = updateSel(state.selection, range => {
        let head = how(range);
        return EditorSelection.range(range.anchor, head.head, head.goalColumn, head.bidiLevel || undefined);
    });
    if (selection.eq(state.selection))
        return false;
    dispatch(setSel(state, selection));
    return true;
}
function moveSel(state, dispatch, how) {
    let selection = updateSel(state.selection, how);
    if (selection.eq(state.selection))
        return false;
    dispatch(setSel(state, selection));
    return true;
}

function previousBlock(state, range) {
    const blocks = state.facet(blockState)
    const block = getNoteBlockFromPos(state, range.head)
    if (range.head === block.content.from) {
        const index = blocks.indexOf(block)
        const previousBlockIndex = index > 0 ? index - 1 : 0
        return EditorSelection.cursor(blocks[previousBlockIndex].content.from)
    } else {
        return EditorSelection.cursor(block.content.from)
    }
}

function nextBlock(state, range) {
    const blocks = state.facet(blockState)
    const block = getNoteBlockFromPos(state, range.head)
    if (range.head === block.content.to) {
        const index = blocks.indexOf(block)
        const previousBlockIndex = index < blocks.length - 1 ? index + 1 : index
        return EditorSelection.cursor(blocks[previousBlockIndex].content.to)
    } else {
        return EditorSelection.cursor(block.content.to)
    }
}

export function gotoNextBlock({state, dispatch}) {
    return moveSel(state, dispatch, range => nextBlock(state, range))
}
export function selectNextBlock({state, dispatch}) {
    return extendSel(state, dispatch, range => nextBlock(state, range))
}
export function gotoPreviousBlock({state, dispatch}) {
    return moveSel(state, dispatch, range => previousBlock(state, range))
}
export function selectPreviousBlock({state, dispatch}) {
    return extendSel(state, dispatch, range => previousBlock(state, range))
}


function previousParagraph(state, range) {
    const blocks = state.facet(blockState)
    let block = getNoteBlockFromPos(state, range.head)
    const blockIndex = blocks.indexOf(block)

    let seenContentLine = false
    let pos
    // if we're on the first row of a block, and it's not the first block, we start from the end of the previous block
    if (state.doc.lineAt(range.head).from === block.content.from && blockIndex > 0) {
        block = blocks[blockIndex - 1]
        pos = state.doc.lineAt(block.content.to).from
    } else {
        pos = state.doc.lineAt(range.head).from
    }

    while (pos > block.content.from) {
        const line = state.doc.lineAt(pos)
        if (line.text.replace(/\s/g, '').length == 0) {
            if (seenContentLine) {
                return EditorSelection.cursor(line.from)
            }
        } else {
            seenContentLine = true
        }
        // set position to beginning go previous line
        pos = state.doc.lineAt(line.from - 1).from
    }
    return EditorSelection.cursor(block.content.from)
}


function nextParagraph(state, range) {
    const blocks = state.facet(blockState)
    let block = getNoteBlockFromPos(state, range.head)
    const blockIndex = blocks.indexOf(block)

    let seenContentLine = false
    let pos
    // if we're at the last line of a block, and it's not the last block, we start from the beginning of the next block
    if (state.doc.lineAt(range.head).to === block.content.to && blockIndex < blocks.length - 1) {
        block = blocks[blockIndex + 1]
        pos = state.doc.lineAt(block.content.from).to
    } else {
        pos = state.doc.lineAt(range.head).to
    }

    while (pos < block.content.to) {
        const line = state.doc.lineAt(pos)
        if (line.text.replace(/\s/g, '').length == 0) {
            if (seenContentLine) {
                return EditorSelection.cursor(line.from)
            }
        } else {
            seenContentLine = true
        }
        // set position to beginning go previous line
        pos = state.doc.lineAt(line.to + 1).to
    }
    return EditorSelection.cursor(block.content.to)
}

export function gotoNextParagraph({state, dispatch}) {
    return moveSel(state, dispatch, range => nextParagraph(state, range))
}

export function selectNextParagraph({state, dispatch}) {
    return extendSel(state, dispatch, range => nextParagraph(state, range))
}

export function gotoPreviousParagraph({state, dispatch}) {
    return moveSel(state, dispatch, range => previousParagraph(state, range))
}

export function selectPreviousParagraph({state, dispatch}) {
    return extendSel(state, dispatch, range => previousParagraph(state, range))
}


function newCursor(view, below) {
    const sel = view.state.selection
    const ranges = sel.ranges

    const newRanges = [...ranges]
    for (let i = 0; i < ranges.length; i++) {
        let range = ranges[i]
        let newRange = view.moveVertically(range, below)
        let exists = false
        for (let j=0; j < ranges.length; j++) {
            if (newRange.eq(ranges[j])) {
                exists = true
                break
            }
        }
        if (!exists) {
            newRanges.push(newRange)
        }
    }
    const newSelection = EditorSelection.create(newRanges, sel.mainIndex)
    view.dispatch({selection: newSelection})
}

export function newCursorBelow(view) {
    newCursor(view, true)
}

export function newCursorAbove(view) {
    newCursor(view, false)
}

export function triggerCurrenciesLoaded(state, dispatch) {
    // Trigger empty change transaction that is annotated with CURRENCIES_LOADED
    // This will make Math blocks re-render so that currency conversions are applied
    dispatch(state.update({
        changes:{from: 0, to: 0, insert:""},
        annotations: [heynoteEvent.of(CURRENCIES_LOADED)],
    }))
}
