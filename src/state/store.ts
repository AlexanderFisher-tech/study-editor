import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  cloneDocument,
  createBlockId,
  createDefaultBlock,
  type InsertableBlockKind,
  type NoteBlock,
  type NoteDocument,
} from '../types/schema';
import { copyTextWithFallback } from '../utils/clipboard';
import { computeDiffSummary, formatSyncClipboardPayload, type DiffSummary } from '../utils/diff';
import { exportToMarkdown, triggerMarkdownDownload } from '../utils/markdown';
import { sanitizeDocument } from '../utils/sanitizer';
import {
  clearDraft,
  clearSupersededBackup,
  loadReconciledDraft,
  loadSupersededBackup,
  saveDraft,
} from '../utils/storage';

export type EditorTheme = 'dark' | 'light';

export interface ToastState {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface SlashMenuState {
  blockId: string;
  rect: { top: number; left: number };
  filter: string;
  mode: 'convert' | 'insert-after';
}

export interface FocusRequest {
  blockId: string;
  nonce: number;
  toEnd?: boolean;
}

export interface StudyEditorStore {
  doc: NoteDocument;
  baselineDoc: NoteDocument;
  diff: DiffSummary;
  theme: EditorTheme;
  studyMode: boolean;
  storageAvailable: boolean;
  toast: ToastState | null;
  slashMenu: SlashMenuState | null;
  focusRequest: FocusRequest | null;
  clipboardFallbackText: string | null;
  toggleTheme: () => void;
  toggleStudyMode: () => void;
  dismissToast: () => void;
  closeClipboardFallback: () => void;
  openSlashMenu: (state: SlashMenuState) => void;
  closeSlashMenu: () => void;
  updateTitle: (title: string) => void;
  updateBlock: (blockId: string, updater: (prev: NoteBlock) => NoteBlock) => void;
  insertBlockAfter: (afterBlockId: string, newBlock?: NoteBlock) => NoteBlock;
  deleteBlock: (blockId: string) => void;
  moveBlock: (blockId: string, direction: -1 | 1) => void;
  reorderBlock: (sourceId: string, targetId: string) => void;
  convertBlockType: (blockId: string, kind: InsertableBlockKind, initialHtml?: string) => void;
  resetDraftToBaseline: () => void;
  triggerSync: () => Promise<void>;
  triggerExportMarkdown: (options: { stripColorHtml: boolean; download?: boolean }) => Promise<void>;
}

function getInitialTheme(): EditorTheme {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  return 'dark';
}

export function useStudyStore(initialBaseline: NoteDocument): StudyEditorStore {
  const sanitizedBaseline = useMemo(
    () => sanitizeDocument(cloneDocument(initialBaseline)),
    [initialBaseline],
  );

  const initialReconciled = useMemo(
    () => loadReconciledDraft(sanitizedBaseline),
    [sanitizedBaseline],
  );

  const [baselineDoc] = useState<NoteDocument>(sanitizedBaseline);
  const [doc, setDoc] = useState<NoteDocument>(initialReconciled.doc);
  const docRef = useRef<NoteDocument>(doc);
  docRef.current = doc;
  const [theme, setTheme] = useState<EditorTheme>(getInitialTheme);
  const [studyMode, setStudyMode] = useState<boolean>(false);
  const [storageAvailable, setStorageAvailable] = useState<boolean>(
    initialReconciled.storageAvailable,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [clipboardFallbackText, setClipboardFallbackText] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const focusNonceRef = useRef<number>(0);

  const showToast = useCallback(
    (text: string, opts?: { durationMs?: number; actionLabel?: string; onAction?: () => void }) => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      const next: ToastState = {
        id: Date.now() + Math.random(),
        text,
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      };
      setToast(next);
      const duration = opts?.durationMs ?? (opts?.actionLabel ? 8000 : 4000);
      toastTimerRef.current = window.setTimeout(() => {
        setToast((cur) => (cur && cur.id === next.id ? null : cur));
      }, duration);
    },
    [],
  );

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const requestFocus = useCallback((blockId: string, toEnd = true) => {
    focusNonceRef.current += 1;
    setFocusRequest({ blockId, nonce: focusNonceRef.current, toEnd });
  }, []);

  // Apply theme attribute to <html>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Show boot reconciliation notifications (restored draft or superseded backup)
  useEffect(() => {
    if (initialReconciled.supersededDraftAvailable) {
      showToast(`Loaded updated note (v${baselineDoc.version}).`, {
        durationMs: 8000,
        actionLabel: 'Restore previous unsynced draft',
        onAction: () => {
          const backup = loadSupersededBackup(baselineDoc.noteId);
          if (backup) {
            setDoc({
              noteId: baselineDoc.noteId,
              version: baselineDoc.version,
              title: backup.title,
              blocks: backup.blocks,
            });
            clearSupersededBackup(baselineDoc.noteId);
            showToast('Restored previous unsynced draft.');
          }
        },
      });
    } else if (initialReconciled.restoredFromDraft) {
      showToast('Restored unsynced edits from local draft.');
    }
  }, [baselineDoc.noteId, baselineDoc.version, initialReconciled, showToast]);

  const diff = useMemo(() => computeDiffSummary(baselineDoc, doc), [baselineDoc, doc]);

  // Persist or clear localStorage draft whenever document changes
  useEffect(() => {
    if (diff.hasChanges) {
      const ok = saveDraft(doc, baselineDoc);
      setStorageAvailable(ok);
    } else {
      clearDraft(baselineDoc.noteId);
    }
  }, [doc, baselineDoc, diff.hasChanges]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleStudyMode = useCallback(() => {
    setStudyMode((prev) => !prev);
  }, []);

  const updateTitle = useCallback((title: string) => {
    setDoc((prev) => (prev.title === title ? prev : { ...prev, title }));
  }, []);

  const updateBlock = useCallback(
    (blockId: string, updater: (prev: NoteBlock) => NoteBlock) => {
      setDoc((prev) => {
        let changed = false;
        const blocks = prev.blocks.map((b) => {
          if (b.id !== blockId) return b;
          const next = updater(b);
          if (next !== b) changed = true;
          return next;
        });
        return changed ? { ...prev, blocks } : prev;
      });
    },
    [],
  );

  const insertBlockAfter = useCallback(
    (afterBlockId: string, providedBlock?: NoteBlock): NoteBlock => {
      const newBlock: NoteBlock = providedBlock ?? {
        id: createBlockId(),
        type: 'paragraph',
        html: '',
      };
      setDoc((prev) => {
        const idx = prev.blocks.findIndex((b) => b.id === afterBlockId);
        const insertAt = idx === -1 ? prev.blocks.length : idx + 1;
        const blocks = [
          ...prev.blocks.slice(0, insertAt),
          newBlock,
          ...prev.blocks.slice(insertAt),
        ];
        return { ...prev, blocks };
      });
      requestFocus(newBlock.id, true);
      return newBlock;
    },
    [requestFocus],
  );

  const deleteBlock = useCallback(
    (blockId: string) => {
      let nextFocusId: string | null = null;
      let removedBlock: NoteBlock | null = null;
      let removedIndex = -1;

      setDoc((prev) => {
        const idx = prev.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return prev;
        removedBlock = prev.blocks[idx];
        removedIndex = idx;

        const remaining = prev.blocks.filter((b) => b.id !== blockId);
        if (remaining.length === 0) {
          const fallback: NoteBlock = { id: createBlockId(), type: 'paragraph', html: '' };
          nextFocusId = fallback.id;
          return { ...prev, blocks: [fallback] };
        }
        nextFocusId = remaining[Math.max(0, idx - 1)].id;
        return { ...prev, blocks: remaining };
      });

      if (nextFocusId) {
        requestFocus(nextFocusId, true);
      }

      if (removedBlock) {
        const snapshot = removedBlock;
        const at = removedIndex;
        showToast('Block deleted.', {
          durationMs: 6000,
          actionLabel: 'Undo',
          onAction: () => {
            setDoc((prev) => {
              const clamped = Math.min(Math.max(0, at), prev.blocks.length);
              const blocks = [
                ...prev.blocks.slice(0, clamped),
                snapshot,
                ...prev.blocks.slice(clamped),
              ];
              return { ...prev, blocks };
            });
            dismissToast();
          },
        });
      }
    },
    [dismissToast, requestFocus, showToast],
  );

  const moveBlock = useCallback(
    (blockId: string, direction: -1 | 1) => {
      setDoc((prev) => {
        const idx = prev.blocks.findIndex((b) => b.id === blockId);
        if (idx === -1) return prev;
        const target = idx + direction;
        if (target < 0 || target >= prev.blocks.length) return prev;
        const blocks = [...prev.blocks];
        const [item] = blocks.splice(idx, 1);
        blocks.splice(target, 0, item);
        return { ...prev, blocks };
      });
      requestFocus(blockId, true);
    },
    [requestFocus],
  );

  const reorderBlock = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setDoc((prev) => {
      const fromIdx = prev.blocks.findIndex((b) => b.id === sourceId);
      const toIdx = prev.blocks.findIndex((b) => b.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const blocks = [...prev.blocks];
      const [item] = blocks.splice(fromIdx, 1);
      blocks.splice(toIdx, 0, item);
      return { ...prev, blocks };
    });
  }, []);

  const convertBlockType = useCallback(
    (blockId: string, kind: InsertableBlockKind, initialHtml = '') => {
      setDoc((prev) => {
        const blocks = prev.blocks.map((b) =>
          b.id === blockId ? createDefaultBlock(kind, initialHtml, blockId) : b,
        );
        return { ...prev, blocks };
      });
      setSlashMenu(null);
      requestFocus(blockId, true);
    },
    [requestFocus],
  );

  const resetDraftToBaseline = useCallback(() => {
    const previousDoc = cloneDocument(doc);
    clearDraft(baselineDoc.noteId);
    setDoc(cloneDocument(baselineDoc));
    showToast('Draft discarded and reset to baseline.', {
      durationMs: 8000,
      actionLabel: 'Undo',
      onAction: () => {
        setDoc(previousDoc);
        dismissToast();
      },
    });
  }, [baselineDoc, dismissToast, doc, showToast]);

  const triggerSync = useCallback(async () => {
    const currentDiff = computeDiffSummary(baselineDoc, docRef.current);
    const payload = formatSyncClipboardPayload(currentDiff.patch);
    const result = await copyTextWithFallback(payload, (fallbackText) => {
      setClipboardFallbackText(fallbackText);
    });
    if (result.ok) {
      showToast('Sync patch copied to clipboard — paste into Gemini Chat.');
    } else {
      showToast('Clipboard blocked — copy the sync patch manually from the dialog.');
    }
  }, [baselineDoc, showToast]);

  const triggerExportMarkdown = useCallback(
    async (options: { stripColorHtml: boolean; download?: boolean }) => {
      const latestDoc = docRef.current;
      const markdown = exportToMarkdown(latestDoc, { stripColorHtml: options.stripColorHtml });
      if (options.download) {
        triggerMarkdownDownload(latestDoc.noteId, markdown);
        showToast(`Downloaded ${latestDoc.noteId}.md`);
        return;
      }
      const result = await copyTextWithFallback(markdown, (fallbackText) => {
        setClipboardFallbackText(fallbackText);
      });
      if (result.ok) {
        showToast('Markdown copied to clipboard.');
      } else {
        showToast('Clipboard blocked — copy Markdown manually from the dialog.');
      }
    },
    [showToast],
  );

  return {
    doc,
    baselineDoc,
    diff,
    theme,
    studyMode,
    storageAvailable,
    toast,
    slashMenu,
    focusRequest,
    clipboardFallbackText,
    toggleTheme,
    toggleStudyMode,
    dismissToast,
    closeClipboardFallback: () => setClipboardFallbackText(null),
    openSlashMenu: setSlashMenu,
    closeSlashMenu: () => setSlashMenu(null),
    updateTitle,
    updateBlock,
    insertBlockAfter,
    deleteBlock,
    moveBlock,
    reorderBlock,
    convertBlockType,
    resetDraftToBaseline,
    triggerSync,
    triggerExportMarkdown,
  };
}
