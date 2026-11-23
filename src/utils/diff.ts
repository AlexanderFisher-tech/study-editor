import {
  cloneBlock,
  type NoteBlock,
  type NoteDocument,
  type SyncPatchEnvelope,
} from '../types/schema';

export interface DiffSummary {
  hasChanges: boolean;
  changedBlockCount: number;
  titleChanged: boolean;
  orderChanged: boolean;
  upsertedIds: string[];
  deletedIds: string[];
  patch: SyncPatchEnvelope;
}

function stableBlockJson(block: NoteBlock): string {
  return JSON.stringify(block);
}

export function computeDiffSummary(
  baseline: NoteDocument,
  current: NoteDocument,
): DiffSummary {
  const baselineMap = new Map<string, string>();
  const baselineOrder: string[] = [];

  for (const b of baseline.blocks) {
    baselineMap.set(b.id, stableBlockJson(b));
    baselineOrder.push(b.id);
  }

  const currentIds = new Set<string>();
  const blockOrder: string[] = [];
  const upsertedBlocks: NoteBlock[] = [];
  const upsertedIds: string[] = [];

  for (const b of current.blocks) {
    currentIds.add(b.id);
    blockOrder.push(b.id);
    const prevJson = baselineMap.get(b.id);
    if (prevJson === undefined || prevJson !== stableBlockJson(b)) {
      upsertedBlocks.push(cloneBlock(b));
      upsertedIds.push(b.id);
    }
  }

  const deletedIds: string[] = [];
  for (const id of baselineOrder) {
    if (!currentIds.has(id)) {
      deletedIds.push(id);
    }
  }

  const titleChanged = baseline.title !== current.title;
  const orderChanged =
    baselineOrder.length !== blockOrder.length ||
    baselineOrder.some((id, idx) => blockOrder[idx] !== id);

  const hasChanges =
    titleChanged || orderChanged || upsertedBlocks.length > 0 || deletedIds.length > 0;

  let changedBlockCount = upsertedIds.length + deletedIds.length;
  if (changedBlockCount === 0 && (orderChanged || titleChanged)) {
    changedBlockCount = 1;
  }

  const patch: SyncPatchEnvelope = {
    noteId: baseline.noteId,
    baseVersion: baseline.version,
    targetVersion: baseline.version + 1,
    title: current.title,
    blockOrder,
    deletedIds,
    upsertedBlocks,
  };

  return {
    hasChanges,
    changedBlockCount,
    titleChanged,
    orderChanged,
    upsertedIds,
    deletedIds,
    patch,
  };
}

export function computeSyncPatch(
  baseline: NoteDocument,
  current: NoteDocument,
): SyncPatchEnvelope {
  return computeDiffSummary(baseline, current).patch;
}

export function formatSyncClipboardPayload(patch: SyncPatchEnvelope): string {
  const header = `[NOTE SYNC: ${patch.noteId} | baseVersion: ${patch.baseVersion} -> targetVersion: ${patch.targetVersion}]`;
  const instruction =
    `Please apply this JSON sync patch to \`<script id="note-data" type="application/json">\` in the Canvas file ` +
    `(set \`"version": ${patch.targetVersion}\`, apply \`upsertedBlocks\` by \`id\`, remove \`deletedIds\`, and order \`blocks\` by \`blockOrder\`):`;
  const json = JSON.stringify(patch, null, 2);
  return `${header}\n${instruction}\n\`\`\`json\n${json}\n\`\`\``;
}
