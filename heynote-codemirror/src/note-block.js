import { ViewPlugin, EditorView, Decoration, WidgetType } from "@codemirror/view"
import { layer, RectangleMarker } from "@codemirror/view"
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { RangeSet } from "@codemirror/rangeset";
import { syntaxTree } from "@codemirror/language"
import { Note, Document, NoteDelimiter } from "./lang-heynote/heynote.terms.js"
import { IterMode } from "@lezer/common";
import { INITIAL_DATA } from "./annotation.js";

class NoteBlockStart extends WidgetType {
    constructor() {
        super()
    }   
    eq(other) {
        //return other.checked == this.checked
        return true
    }
    toDOM() {
        let wrap = document.createElement("div")
        wrap.className = "block-start"
        //wrap.innerHTML = "<br>"
        return wrap
    }
    ignoreEvent() {
        return false
    }
}

class FirstNoteBlockStart extends WidgetType {
    constructor() {
        super()
    }
    eq(other) {
        return true
    }
    toDOM() {
        let wrap = document.createElement("span")
        wrap.className = "block-start-first"
        return wrap
    }
    ignoreEvent() {
        return false
    }
}


const noteBlockWidget = () => {
    const decorate = (state) => {
        const widgets = [];
        
        syntaxTree(state).iterate({
            enter: (type) => {
                if (type.name === "NoteDelimiter") {
                    //console.log("found!", type.name, type.from, type.to)
                    let deco = Decoration.replace({
                        widget: type.from === 0 ? new FirstNoteBlockStart() : new NoteBlockStart(),
                        inclusive: false,
                        block: type.from === 0 ? false : true,
                        side: 0,
                    });
                    widgets.push(deco.range(type.from, type.from === 0 ? type.to :type.to-1));
                }
            },
            mode: IterMode.IgnoreMounts,
        });
        
        return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
    };
    
    const noteBlockStartField = StateField.define({
        create(state) {
            return decorate(state);
        },
        update(widgets, transaction) {
            if (transaction.docChanged) {
                return decorate(transaction.state);
            }
            
            //return widgets.map(transaction.changes);
            return widgets
        },
        provide(field) {
            return EditorView.decorations.from(field);
        }
    });
    
    return [noteBlockStartField];
};



function atomicRanges(view) {
    let builder = new RangeSetBuilder()
    syntaxTree(view.state).iterate({
        enter: (type) => {
            if (type.type.id === NoteDelimiter) {
                builder.add(type.from, type.to, {})
            }
        },
        mode: IterMode.IgnoreMounts,
    });
    return builder.finish()
}

const atomicNoteBlock = ViewPlugin.fromClass(
    class {
        constructor(view) {
            this.atomicRanges = atomicRanges(view)
        }
    
        update(update) {
            if (update.docChanged) {
                this.atomicRanges = atomicRanges(update.view)
            }
        }
    }, 
    {
        provide: plugin => EditorView.atomicRanges.of(view => {
            return view.plugin(plugin)?.atomicRanges || Decoration.none
        })
    }
)

const blockLayer = () => {
    return layer({
        above: false,

        markers(view) {
            const markers = []
            let idx = 0
            syntaxTree(view.state).iterate({
                enter: (type) => {
                    //console.log("type", type.name, type.type.id, Document)
                    if (type.type.id == Document || type.type.id == Note) {
                        return true
                    } else if (type.type.id === NoteDelimiter) {
                        const contentNode = type.node.nextSibling
                        //console.log("adding marker", type.node.nextSibling.name)
                        //let line = view.state.doc.lineAt(type.from)
                        const fromCoords = view.coordsAtPos(contentNode.from)
                        const toCoords = view.coordsAtPos(contentNode.to)
                        //console.log("line", fromCoords.top, toCoords.bottom)
                        //console.log("documentTop", view.documentTop)
                        markers.push(new RectangleMarker(
                            idx++ % 2 == 0 ? "block-even" : "block-odd", 
                            0, 
                            fromCoords.top - (view.documentTop - view.documentPadding.top), 
                            2000, 
                            (toCoords.bottom - fromCoords.top),
                        ))
                        return false;
                    }
                    return false;
                },
                mode: IterMode.IgnoreMounts,
            });
            return markers

        },

        update(update, dom) {
            return update.docChanged || update.viewportChanged
        },

        class: "blocks-layer"
    })
}


const preventFirstBlockFromBeingDeleted = EditorState.changeFilter.of((tr) => {
    if (!tr.annotations.some(a => a.value === INITIAL_DATA)) {
        return [-1,10]
    }
})

export const noteBlockExtension = () => {
    return [noteBlockWidget(), atomicNoteBlock, blockLayer(), preventFirstBlockFromBeingDeleted]
}