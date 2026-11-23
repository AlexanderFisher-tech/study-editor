import {
  cloneDocument,
  type NoteDocument,
  type ReconciledDraftResult,
  type StoredDraft,
} from '../types/schema';
import { hashBlocks } from './hash';
import { sanitizeBlock } from './sanitizer';

export function draftKey(noteId: string): string {
  return `draft:${noteId}`;
}

export function backupKey(noteId: string): string {
  return `backup:${noteId}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const probeKey = '__study_editor_probe__';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadReconciledDraft(baseline: NoteDocument): ReconciledDraftResult {
  const storage = getStorage();
  if (!storage) {
    return {
      doc: cloneDocument(baseline),
      restoredFromDraft: false,
      supersededDraftAvailable: false,
      storageAvailable: false,
    };
  }

  const key = draftKey(baseline.noteId);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return {
      doc: cloneDocument(baseline),
      restoredFromDraft: false,
      supersededDraftAvailable: false,
      storageAvailable: false,
    };
  }

  if (!raw) {
    return {
      doc: cloneDocument(baseline),
      restoredFromDraft: false,
      supersededDraftAvailable: false,
      storageAvailable: true,
    };
  }

  let parsed: StoredDraft;
  try {
    parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || !Array.isArray(parsed.blocks)) {
      throw new Error('Malformed draft');
    }
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // ignore
    }
    return {
      doc: cloneDocument(baseline),
      restoredFromDraft: false,
      supersededDraftAvailable: false,
      storageAvailable: true,
    };
  }

  const currentBaselineHash = hashBlocks(baseline.blocks);
  const matchesBaseline =
    parsed.baseVersion === baseline.version && parsed.baselineHash === currentBaselineHash;

  if (matchesBaseline) {
    const sanitizedBlocks = parsed.blocks.map(sanitizeBlock);
    return {
      doc: {
        noteId: baseline.noteId,
        version: baseline.version,
        title: typeof parsed.title === 'string' ? parsed.title : baseline.title,
        blocks: sanitizedBlocks,
      },
      restoredFromDraft: true,
      supersededDraftAvailable: false,
      storageAvailable: true,
    };
  }

  // Baseline has moved forward (or changed): archive the old draft and clear active draft key.
  try {
    storage.setItem(backupKey(baseline.noteId), JSON.stringify(parsed));
    storage.removeItem(key);
  } catch {
    // ignore quota errors during backup archival
  }

  return {
    doc: cloneDocument(baseline),
    restoredFromDraft: false,
    supersededDraftAvailable: true,
    storageAvailable: true,
  };
}

export function saveDraft(current: NoteDocument, baseline: NoteDocument): boolean {
  const storage = getStorage();
  if (!storage) return false;

  const payload: StoredDraft = {
    noteId: baseline.noteId,
    baseVersion: baseline.version,
    baselineHash: hashBlocks(baseline.blocks),
    updatedAt: Date.now(),
    title: current.title,
    blocks: current.blocks,
  };

  try {
    storage.setItem(draftKey(baseline.noteId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(noteId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(draftKey(noteId));
  } catch {
    // ignore
  }
}

export function loadSupersededBackup(noteId: string): StoredDraft | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(backupKey(noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || !Array.isArray(parsed.blocks)) return null;
    return {
      ...parsed,
      blocks: parsed.blocks.map(sanitizeBlock),
    };
  } catch {
    return null;
  }
}

export function clearSupersededBackup(noteId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(backupKey(noteId));
  } catch {
    // ignore
  }
}
