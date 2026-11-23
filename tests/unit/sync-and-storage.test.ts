import { beforeEach, describe, expect, it } from 'vitest';
import type { NoteDocument, UnknownBlock } from '../../src/types/schema';
import { computeDiffSummary, computeSyncPatch, formatSyncClipboardPayload } from '../../src/utils/diff';
import {
  backupKey,
  draftKey,
  loadReconciledDraft,
  loadSupersededBackup,
  saveDraft,
} from '../../src/utils/storage';

function makeBaseline(version = 1): NoteDocument {
  return {
    noteId: 'grammar-active-passive-01',
    version,
    title: 'Active vs. Passive Voice',
    blocks: [
      { id: 'b1', type: 'paragraph', html: 'Original b1' },
      { id: 'b2', type: 'paragraph', html: 'Original b2' },
      { id: 'b3', type: 'paragraph', html: 'Original b3' },
      { id: 'b4', type: 'paragraph', html: 'Original b4' },
    ],
  };
}

describe('computeSyncPatch & formatSyncClipboardPayload', () => {
  it('tracks modified, added, reordered, and deleted blocks with targetVersion = baseVersion + 1', () => {
    const baseline = makeBaseline(1);
    const current: NoteDocument = {
      ...baseline,
      blocks: [
        { id: 'b1', type: 'paragraph', html: 'Updated b1' },
        { id: 'b_new', type: 'paragraph', html: 'Added after b1' },
        { id: 'b3', type: 'paragraph', html: 'Original b3' },
        { id: 'b2', type: 'paragraph', html: 'Original b2' },
      ],
    };

    const summary = computeDiffSummary(baseline, current);
    expect(summary.hasChanges).toBe(true);
    expect(summary.orderChanged).toBe(true);
    expect(summary.deletedIds).toEqual(['b4']);
    expect(summary.upsertedIds).toEqual(['b1', 'b_new']);

    const patch = computeSyncPatch(baseline, current);
    expect(patch.baseVersion).toBe(1);
    expect(patch.targetVersion).toBe(2);
    expect(patch.blockOrder).toEqual(['b1', 'b_new', 'b3', 'b2']);
    expect(patch.deletedIds).toEqual(['b4']);
    expect(patch.upsertedBlocks.map((b) => b.id)).toEqual(['b1', 'b_new']);

    const formatted = formatSyncClipboardPayload(patch);
    expect(formatted).toContain(
      '[NOTE SYNC: grammar-active-passive-01 | baseVersion: 1 -> targetVersion: 2]',
    );
    expect(formatted).toContain('"targetVersion": 2');
    expect(formatted).toContain('"b_new"');
  });

  it('preserves unknown block type and arbitrary extra fields in upsertedBlocks after editing html', () => {
    const unknownBlock: UnknownBlock = {
      id: 'b9',
      type: 'future-chart',
      html: 'Fallback text',
      chartData: [1, 2, 3],
    };
    const baseline: NoteDocument = {
      noteId: 'chart-note',
      version: 1,
      title: 'Charts',
      blocks: [unknownBlock],
    };
    const current: NoteDocument = {
      ...baseline,
      blocks: [{ ...unknownBlock, html: 'Edited fallback text' }],
    };

    const patch = computeSyncPatch(baseline, current);
    expect(patch.upsertedBlocks).toHaveLength(1);
    expect(patch.upsertedBlocks[0]).toEqual({
      id: 'b9',
      type: 'future-chart',
      html: 'Edited fallback text',
      chartData: [1, 2, 3],
    });
  });
});

describe('version-gated localStorage draft reconciliation', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('restores draft when version and baselineHash match on same-origin reload', () => {
    const baseline = makeBaseline(1);
    const edited: NoteDocument = {
      ...baseline,
      blocks: [
        { id: 'b1', type: 'paragraph', html: 'Local unsynced edit' },
        ...baseline.blocks.slice(1),
      ],
    };

    expect(saveDraft(edited, baseline)).toBe(true);
    expect(window.localStorage.getItem(draftKey(baseline.noteId))).not.toBeNull();

    const reconciled = loadReconciledDraft(baseline);
    expect(reconciled.restoredFromDraft).toBe(true);
    expect(reconciled.supersededDraftAvailable).toBe(false);
    expect((reconciled.doc.blocks[0] as { html: string }).html).toBe('Local unsynced edit');
  });

  it('invalidates stale draft, archives it to backup:<noteId>, and loads fresh v2 baseline', () => {
    const baselineV1 = makeBaseline(1);
    const editedV1: NoteDocument = {
      ...baselineV1,
      blocks: [
        { id: 'b1', type: 'paragraph', html: 'Stale v1 draft' },
        ...baselineV1.blocks.slice(1),
      ],
    };
    saveDraft(editedV1, baselineV1);

    const baselineV2: NoteDocument = {
      ...makeBaseline(2),
      blocks: [
        { id: 'b1', type: 'paragraph', html: 'Gemini updated v2' },
        ...baselineV1.blocks.slice(1),
      ],
    };

    const reconciled = loadReconciledDraft(baselineV2);
    expect(reconciled.restoredFromDraft).toBe(false);
    expect(reconciled.supersededDraftAvailable).toBe(true);
    expect((reconciled.doc.blocks[0] as { html: string }).html).toBe('Gemini updated v2');

    // Active draft key should be cleared and old draft archived under backup:<noteId>
    expect(window.localStorage.getItem(draftKey(baselineV2.noteId))).toBeNull();
    expect(window.localStorage.getItem(backupKey(baselineV2.noteId))).not.toBeNull();

    const backup = loadSupersededBackup(baselineV2.noteId);
    expect(backup?.baseVersion).toBe(1);
    expect((backup?.blocks[0] as { html: string }).html).toBe('Stale v1 draft');
  });
});
