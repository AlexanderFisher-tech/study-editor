import { useEffect, useRef, useState } from 'preact/hooks';
import {
  createDefaultBlock,
  isKnownBlock,
  type InsertableBlockKind,
  type NoteBlock,
  type NoteDocument,
} from '../types/schema';
import { useStudyStore } from '../state/store';
import { FloatingToolbar } from './FloatingToolbar';
import { SlashMenu } from './SlashMenu';
import {
  BlockquoteBlockView,
  CalloutBlockView,
  CodeBlockView,
  HeadingBlockView,
  ListBlockView,
  ParagraphBlockView,
  ToggleBlockView,
  UnknownBlockView,
  type BlockSharedProps,
} from './blocks/StandardBlocks';
import {
  GutterDiffBlockView,
  PeekBlockView,
  SpotlightBlockView,
  TabsBlockView,
} from './blocks/StudyBlocks';

function isCompositeBlock(block: NoteBlock): boolean {
  return (
    block.type === 'tabs' ||
    block.type === 'spotlight' ||
    block.type === 'peek' ||
    block.type === 'gutter-diff' ||
    block.type === 'toggle' ||
    block.type === 'callout' ||
    block.type === 'code'
  );
}

export interface EditorProps {
  initialDoc: NoteDocument;
}

export function Editor({ initialDoc }: EditorProps) {
  const store = useStudyStore(initialDoc);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [editingMicroDotEl, setEditingMicroDotEl] = useState<HTMLElement | null>(null);
  const [confirmDeleteBlockId, setConfirmDeleteBlockId] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [stripColorHtml, setStripColorHtml] = useState<boolean>(false);
  const [altHeld, setAltHeld] = useState<boolean>(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  // Global Cmd+Shift+S sync shortcut and Alt/Option hold for temporary Study Mode recall preview
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltHeld(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        void store.triggerSync();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltHeld(false);
      }
    };
    const onWindowBlur = () => setAltHeld(false);

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [store.triggerSync]);

  // Close small menus on outside click
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.se-export-wrap')) setExportMenuOpen(false);
      if (!target?.closest('.se-reset-wrap')) setConfirmResetOpen(false);
      if (!target?.closest('.se-gutter-delete-wrap')) setConfirmDeleteBlockId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Auto-select fallback clipboard textarea when opened
  useEffect(() => {
    if (store.clipboardFallbackText && fallbackTextareaRef.current) {
      fallbackTextareaRef.current.focus();
      fallbackTextareaRef.current.select();
    }
  }, [store.clipboardFallbackText]);

  const handleSlashSelect = (kind: InsertableBlockKind) => {
    if (!store.slashMenu) return;
    if (store.slashMenu.mode === 'insert-after') {
      const created = createDefaultBlock(kind);
      store.insertBlockAfter(store.slashMenu.blockId, created);
      store.closeSlashMenu();
    } else {
      store.convertBlockType(store.slashMenu.blockId, kind, '');
    }
  };

  const renderBlockContent = (block: NoteBlock) => {
    const shared: BlockSharedProps = {
      slashMenu: store.slashMenu,
      focusRequest: store.focusRequest,
      onUpdate: (updater) => store.updateBlock(block.id, updater),
      onInsertAfter: () => store.insertBlockAfter(block.id),
      onDelete: () => store.deleteBlock(block.id),
      onMoveBlock: (dir) => store.moveBlock(block.id, dir),
      onConvertType: (kind, remainingHtml) =>
        store.convertBlockType(block.id, kind, remainingHtml),
      onOpenSlashMenu: store.openSlashMenu,
      onCloseSlashMenu: store.closeSlashMenu,
      onEditMicroDot: (el) => setEditingMicroDotEl(el),
    };

    if (!isKnownBlock(block)) {
      return <UnknownBlockView block={block} shared={shared} />;
    }

    switch (block.type) {
      case 'paragraph':
        return <ParagraphBlockView block={block} shared={shared} />;
      case 'heading':
        return <HeadingBlockView block={block} shared={shared} />;
      case 'bullet-list':
      case 'ordered-list':
        return <ListBlockView block={block} shared={shared} />;
      case 'blockquote':
        return <BlockquoteBlockView block={block} shared={shared} />;
      case 'code':
        return <CodeBlockView block={block} shared={shared} />;
      case 'callout':
        return <CalloutBlockView block={block} shared={shared} />;
      case 'toggle':
        return <ToggleBlockView block={block} shared={shared} />;
      case 'tabs':
        return <TabsBlockView block={block} shared={shared} />;
      case 'gutter-diff':
        return <GutterDiffBlockView block={block} shared={shared} />;
      case 'spotlight':
        return <SpotlightBlockView block={block} shared={shared} />;
      case 'peek':
        return <PeekBlockView block={block} shared={shared} />;
    }
  };

  const effectiveStudyMode = store.studyMode || altHeld;

  return (
    <div
      ref={editorRootRef}
      class="se-shell"
      data-study-mode={effectiveStudyMode ? 'true' : 'false'}
    >
      <header class="se-topbar">
        <div class="se-topbar-left">
          <span class="se-version-badge" title={`Note ID: ${store.doc.noteId}`}>
            v{store.doc.version}
          </span>
          {!store.storageAvailable && (
            <span class="se-storage-warn" title="localStorage unavailable in this iframe">
              In-memory only
            </span>
          )}
        </div>

        <div class="se-topbar-right">
          <button
            type="button"
            class={`se-pill-btn ${store.studyMode ? 'is-active' : ''}`}
            aria-pressed={store.studyMode}
            title="Toggle Study Mode (blurs Recall Masks; hold Alt for quick preview)"
            onClick={store.toggleStudyMode}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
              <circle cx="8" cy="8" r="1.8" />
            </svg>
            <span>{store.studyMode ? 'Study Mode' : 'Edit Mode'}</span>
          </button>

          <button
            type="button"
            class="se-pill-btn se-icon-only"
            title={`Switch to ${store.theme === 'dark' ? 'Light' : 'Dark'} theme`}
            aria-label="Toggle theme"
            onClick={store.toggleTheme}
          >
            {store.theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M13.5 9.8A5.5 5.5 0 0 1 6.2 2.5a5.5 5.5 0 1 0 7.3 7.3z" />
              </svg>
            )}
          </button>

          {store.diff.hasChanges && (
            <div class="se-reset-wrap">
              <button
                type="button"
                class="se-pill-btn"
                title="Discard unsynced draft edits"
                onClick={() => setConfirmResetOpen((v) => !v)}
              >
                Reset
              </button>
              {confirmResetOpen && (
                <div class="se-inline-confirm" role="dialog" aria-label="Confirm reset draft">
                  <span>Reset draft?</span>
                  <button
                    type="button"
                    class="se-confirm-btn is-danger"
                    onClick={() => {
                      setConfirmResetOpen(false);
                      store.resetDraftToBaseline();
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    class="se-confirm-btn"
                    onClick={() => setConfirmResetOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            class={`se-pill-btn se-sync-pill ${store.diff.hasChanges ? 'is-dirty' : ''}`}
            title="Copy canonical JSON sync patch to clipboard (Cmd+Shift+S)"
            onClick={() => void store.triggerSync()}
          >
            {store.diff.hasChanges
              ? `Unsynced: ${store.diff.changedBlockCount} | Sync (Cmd+Shift+S)`
              : 'Sync (Cmd+Shift+S)'}
          </button>

          <div class="se-export-wrap">
            <button
              type="button"
              class="se-pill-btn"
              aria-expanded={exportMenuOpen}
              onClick={() => setExportMenuOpen((v) => !v)}
            >
              Export Markdown
            </button>
            {exportMenuOpen && (
              <div class="se-export-menu" role="menu">
                <label class="se-export-option">
                  <input
                    type="checkbox"
                    checked={stripColorHtml}
                    onChange={(e) =>
                      setStripColorHtml((e.target as HTMLInputElement).checked)
                    }
                  />
                  <span>Strip HTML color tags</span>
                </label>
                <button
                  type="button"
                  role="menuitem"
                  class="se-export-action"
                  onClick={() => {
                    setExportMenuOpen(false);
                    void store.triggerExportMarkdown({ stripColorHtml, download: false });
                  }}
                >
                  Copy Markdown
                </button>
                <button
                  type="button"
                  role="menuitem"
                  class="se-export-action"
                  onClick={() => {
                    setExportMenuOpen(false);
                    void store.triggerExportMarkdown({ stripColorHtml, download: true });
                  }}
                >
                  Download .md file
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main class="se-page">
        <input
          type="text"
          class="se-doc-title"
          value={store.doc.title}
          placeholder="Untitled Study Note"
          aria-label="Study note title"
          onInput={(e) => store.updateTitle((e.target as HTMLInputElement).value)}
        />

        <div class="se-blocks" role="list">
          {store.doc.blocks.map((block) => {
            const isDirty = store.diff.upsertedIds.includes(block.id);
            const isDragOver = dragOverBlockId === block.id && draggedBlockId !== block.id;
            return (
              <div
                key={block.id}
                role="listitem"
                class={`se-block-row ${isDirty ? 'is-dirty' : ''} ${
                  isDragOver ? 'is-drag-over' : ''
                }`}
                data-block-row-id={block.id}
                data-block-type={block.type}
                onDragOver={(e) => {
                  if (!draggedBlockId || draggedBlockId === block.id) return;
                  e.preventDefault();
                  setDragOverBlockId(block.id);
                }}
                onDragLeave={() => {
                  if (dragOverBlockId === block.id) setDragOverBlockId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedBlockId && draggedBlockId !== block.id) {
                    store.reorderBlock(draggedBlockId, block.id);
                  }
                  setDraggedBlockId(null);
                  setDragOverBlockId(null);
                }}
              >
                <div class="se-block-gutter">
                  <button
                    type="button"
                    class="se-gutter-btn"
                    title="Insert block below"
                    aria-label="Insert block below"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      store.openSlashMenu({
                        blockId: block.id,
                        rect: { top: rect.bottom + 6, left: rect.left },
                        filter: '',
                        mode: 'insert-after',
                      });
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                      <line x1="8" y1="3" x2="8" y2="13" />
                      <line x1="3" y1="8" x2="13" y2="8" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    class="se-gutter-btn se-drag-handle"
                    draggable
                    title="Drag to reorder (or Cmd+Shift+Up/Down)"
                    aria-label="Drag to reorder block"
                    onDragStart={(e) => {
                      setDraggedBlockId(block.id);
                      e.dataTransfer?.setData('text/plain', block.id);
                    }}
                    onDragEnd={() => {
                      setDraggedBlockId(null);
                      setDragOverBlockId(null);
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <circle cx="5.5" cy="4" r="1.1" />
                      <circle cx="10.5" cy="4" r="1.1" />
                      <circle cx="5.5" cy="8" r="1.1" />
                      <circle cx="10.5" cy="8" r="1.1" />
                      <circle cx="5.5" cy="12" r="1.1" />
                      <circle cx="10.5" cy="12" r="1.1" />
                    </svg>
                  </button>

                  <div class="se-gutter-delete-wrap">
                    <button
                      type="button"
                      class="se-gutter-btn se-delete-btn"
                      title="Delete block"
                      aria-label="Delete block"
                      onClick={() => {
                        if (isCompositeBlock(block)) {
                          setConfirmDeleteBlockId((cur) =>
                            cur === block.id ? null : block.id,
                          );
                        } else {
                          store.deleteBlock(block.id);
                        }
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                        <line x1="4" y1="4" x2="12" y2="12" />
                        <line x1="12" y1="4" x2="4" y2="12" />
                      </svg>
                    </button>
                    {confirmDeleteBlockId === block.id && (
                      <div class="se-inline-confirm is-left" role="dialog" aria-label="Confirm delete block">
                        <span>Delete block?</span>
                        <button
                          type="button"
                          class="se-confirm-btn is-danger"
                          onClick={() => {
                            setConfirmDeleteBlockId(null);
                            store.deleteBlock(block.id);
                          }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          class="se-confirm-btn"
                          onClick={() => setConfirmDeleteBlockId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div class="se-block-content">{renderBlockContent(block)}</div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          class="se-add-tail-btn"
          onClick={() => {
            const last = store.doc.blocks[store.doc.blocks.length - 1];
            store.insertBlockAfter(last.id);
          }}
        >
          + Add paragraph
        </button>
      </main>

      <FloatingToolbar
        editorRootRef={editorRootRef}
        editingMicroDotEl={editingMicroDotEl}
        onCloseMicroDotEditor={() => setEditingMicroDotEl(null)}
      />

      {store.slashMenu && (
        <SlashMenu
          menu={store.slashMenu}
          onSelect={handleSlashSelect}
          onClose={store.closeSlashMenu}
        />
      )}

      {store.clipboardFallbackText !== null && (
        <div class="se-fallback-backdrop" role="dialog" aria-label="Manual copy fallback">
          <div class="se-fallback-modal">
            <div class="se-fallback-header">
              <span>Copy payload (Cmd+C)</span>
              <button
                type="button"
                class="se-icon-btn"
                aria-label="Close copy dialog"
                onClick={store.closeClipboardFallback}
              >
                ×
              </button>
            </div>
            <textarea
              ref={fallbackTextareaRef}
              class="se-fallback-textarea"
              readOnly
              value={store.clipboardFallbackText}
            />
          </div>
        </div>
      )}

      {store.toast && (
        <div class="se-toast" role="status" aria-live="polite">
          <span>{store.toast.text}</span>
          {store.toast.actionLabel && store.toast.onAction && (
            <button
              type="button"
              class="se-toast-action"
              onClick={store.toast.onAction}
            >
              {store.toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            class="se-toast-dismiss"
            aria-label="Dismiss notification"
            onClick={store.dismissToast}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
