import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  BIND_SLOTS,
  SEMANTIC_COLORS,
  type BindSlot,
  type SemanticColor,
} from '../types/schema';
import {
  applyColorTag,
  inspectActiveSelection,
  setBindKey,
  setMicroDotNote,
  toggleInlineTag,
  toggleRecallMask,
  type ActiveSelectionState,
} from '../utils/selection';

export interface FloatingToolbarProps {
  editorRootRef: { current: HTMLElement | null };
  editingMicroDotEl: HTMLElement | null;
  onCloseMicroDotEditor: () => void;
}

type SubPanel = 'none' | 'note' | 'bind';

export function FloatingToolbar({
  editorRootRef,
  editingMicroDotEl,
  onCloseMicroDotEditor,
}: FloatingToolbarProps) {
  const [selectionState, setSelectionState] = useState<ActiveSelectionState | null>(null);
  const [subPanel, setSubPanelState] = useState<SubPanel>('none');
  const [noteInput, setNoteInput] = useState('');
  const subPanelRef = useRef<SubPanel>('none');
  const savedRangeRef = useRef<Range | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  const setSubPanel = useCallback((next: SubPanel | ((prev: SubPanel) => SubPanel)) => {
    const resolved = typeof next === 'function' ? next(subPanelRef.current) : next;
    subPanelRef.current = resolved;
    setSubPanelState(resolved);
  }, []);

  const refreshSelection = useCallback(() => {
    if (subPanelRef.current === 'note') return;
    if (toolbarRef.current && toolbarRef.current.contains(document.activeElement)) return;
    const next = inspectActiveSelection(editorRootRef.current);
    setSelectionState(next);
    if (!next) {
      setSubPanel('none');
    } else {
      savedRangeRef.current = next.range.cloneRange();
    }
  }, [editorRootRef, setSubPanel]);

  useEffect(() => {
    const onSelectionChange = () => refreshSelection();
    const onMouseUp = () => window.requestAnimationFrame(refreshSelection);
    const onKeyUp = () => window.requestAnimationFrame(refreshSelection);

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [refreshSelection]);

  // Support clicking an existing <span data-note="..."> directly in edit mode
  useEffect(() => {
    if (!editingMicroDotEl) return;
    const r = document.createRange();
    r.selectNodeContents(editingMicroDotEl);
    savedRangeRef.current = r;
    setNoteInput(editingMicroDotEl.getAttribute('data-note') ?? '');
    setSubPanel('note');
    setTimeout(() => noteInputRef.current?.focus(), 0);
  }, [editingMicroDotEl]);

  const closeAll = () => {
    setSubPanel('none');
    setSelectionState(null);
    onCloseMicroDotEditor();
  };

  const activeRect = editingMicroDotEl
    ? editingMicroDotEl.getBoundingClientRect()
    : selectionState?.rect ?? null;

  if (!activeRect) return null;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const estWidth = 420;
  const rawLeft = activeRect.left + activeRect.width / 2 - estWidth / 2;
  const left = Math.min(Math.max(12, rawLeft), Math.max(12, viewportW - estWidth - 12));
  const showBelow = activeRect.top < 72;
  const top = showBelow ? activeRect.bottom + 8 : Math.max(8, activeRect.top - 48);

  const runAction = (fn: () => boolean) => {
    fn();
    setTimeout(() => {
      const next = inspectActiveSelection(editorRootRef.current);
      setSelectionState(next);
      if (next) savedRangeRef.current = next.range.cloneRange();
    }, 0);
  };

  const handleOpenNoteInput = () => {
    if (selectionState) {
      savedRangeRef.current = selectionState.range.cloneRange();
      setNoteInput(selectionState.activeNote ?? '');
    }
    setSubPanel((prev) => (prev === 'note' ? 'none' : 'note'));
    setTimeout(() => noteInputRef.current?.focus(), 0);
  };

  const handleApplyNote = (e?: Event) => {
    e?.preventDefault();
    setMicroDotNote(noteInput, savedRangeRef.current);
    setSubPanel('none');
    onCloseMicroDotEditor();
    setTimeout(refreshSelection, 0);
  };

  const handleClearNote = () => {
    setMicroDotNote(null, savedRangeRef.current);
    setNoteInput('');
    setSubPanel('none');
    onCloseMicroDotEditor();
    setTimeout(refreshSelection, 0);
  };

  return (
    <div
      ref={toolbarRef}
      class="se-floating-toolbar"
      role="toolbar"
      aria-label="Text formatting toolbar"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div class="se-toolbar-row">
        <div class="se-swatch-group" role="group" aria-label="Semantic color tags">
          {SEMANTIC_COLORS.map((color: SemanticColor) => (
            <button
              key={color}
              type="button"
              class={`se-swatch ${selectionState?.activeColor === color ? 'is-active' : ''}`}
              data-swatch={color}
              title={`Color: ${color}`}
              aria-label={`Color ${color}`}
              onMouseDown={(e) => {
                e.preventDefault();
                runAction(() => applyColorTag(color, savedRangeRef.current));
              }}
            />
          ))}
          <button
            type="button"
            class="se-tb-btn se-tb-clear"
            title="Clear color"
            aria-label="Clear color"
            onMouseDown={(e) => {
              e.preventDefault();
              runAction(() => applyColorTag(null, savedRangeRef.current));
            }}
          >
            ×
          </button>
        </div>

        <span class="se-tb-sep" aria-hidden="true" />

        <button
          type="button"
          class={`se-tb-btn ${selectionState?.hasUnderline ? 'is-active' : ''}`}
          title="Structural Underline (<u>)"
          aria-label="Underline"
          onMouseDown={(e) => {
            e.preventDefault();
            runAction(() => toggleInlineTag('u', savedRangeRef.current));
          }}
        >
          <u>U</u>
        </button>

        <button
          type="button"
          class={`se-tb-btn ${selectionState?.hasCode ? 'is-active' : ''}`}
          title="Inline Code (<code>)"
          aria-label="Inline code"
          onMouseDown={(e) => {
            e.preventDefault();
            runAction(() => toggleInlineTag('code', savedRangeRef.current));
          }}
        >
          {'</>'}
        </button>

        <button
          type="button"
          class={`se-tb-btn ${selectionState?.hasBold ? 'is-active' : ''}`}
          title="Bold Anchor (<strong>)"
          aria-label="Bold"
          onMouseDown={(e) => {
            e.preventDefault();
            runAction(() => toggleInlineTag('strong', savedRangeRef.current));
          }}
        >
          <strong>B</strong>
        </button>

        <span class="se-tb-sep" aria-hidden="true" />

        <button
          type="button"
          class={`se-tb-btn ${selectionState?.activeNote || subPanel === 'note' ? 'is-active' : ''}`}
          title="Attach Micro-Dot Note"
          aria-label="Micro-dot note"
          onMouseDown={(e) => {
            e.preventDefault();
            handleOpenNoteInput();
          }}
        >
          • Note
        </button>

        <button
          type="button"
          class={`se-tb-btn ${selectionState?.hasMask ? 'is-active' : ''}`}
          title="Toggle Active-Recall Mask"
          aria-label="Recall mask"
          onMouseDown={(e) => {
            e.preventDefault();
            runAction(() => toggleRecallMask(savedRangeRef.current));
          }}
        >
          Mask
        </button>

        <button
          type="button"
          class={`se-tb-btn ${selectionState?.activeBind || subPanel === 'bind' ? 'is-active' : ''}`}
          title="Assign Hover-to-Isolate Bind Slot (1–8)"
          aria-label="Bind key"
          onMouseDown={(e) => {
            e.preventDefault();
            setSubPanel((prev) => (prev === 'bind' ? 'none' : 'bind'));
          }}
        >
          {selectionState?.activeBind ? `Bind ${selectionState.activeBind}` : 'Bind'}
        </button>
      </div>

      {subPanel === 'note' && (
        <form class="se-toolbar-subpanel" onSubmit={handleApplyNote}>
          <input
            ref={noteInputRef}
            type="text"
            class="se-toolbar-input"
            value={noteInput}
            placeholder="Enter micro-dot hover note..."
            aria-label="Micro-dot note text"
            onInput={(e) => setNoteInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                closeAll();
              }
            }}
          />
          <button type="submit" class="se-tb-btn is-primary">
            Apply
          </button>
          <button
            type="button"
            class="se-tb-btn"
            onClick={handleClearNote}
          >
            Remove
          </button>
        </form>
      )}

      {subPanel === 'bind' && (
        <div class="se-toolbar-subpanel" role="group" aria-label="Bind slot selector">
          <span class="se-subpanel-label">Bind slot:</span>
          {BIND_SLOTS.map((slot: BindSlot) => (
            <button
              key={slot}
              type="button"
              class={`se-tb-btn se-slot-btn ${selectionState?.activeBind === slot ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                runAction(() => setBindKey(slot, savedRangeRef.current));
                setSubPanel('none');
              }}
            >
              {slot}
            </button>
          ))}
          <button
            type="button"
            class="se-tb-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              runAction(() => setBindKey(null, savedRangeRef.current));
              setSubPanel('none');
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
