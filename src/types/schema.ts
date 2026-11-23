export const SEMANTIC_COLORS = [
  'gray',
  'blue',
  'green',
  'red',
  'purple',
  'orange',
  'pink',
  'brown',
] as const;

export type SemanticColor = (typeof SEMANTIC_COLORS)[number];

export const CALLOUT_TONES = [
  'gray',
  'blue',
  'green',
  'red',
  'purple',
  'orange',
] as const;

export type CalloutTone = (typeof CALLOUT_TONES)[number];

export const BIND_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export type BindSlot = (typeof BIND_SLOTS)[number];

export const KNOWN_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bullet-list',
  'ordered-list',
  'blockquote',
  'code',
  'callout',
  'toggle',
  'tabs',
  'gutter-diff',
  'spotlight',
  'peek',
] as const;

export type KnownBlockType = (typeof KNOWN_BLOCK_TYPES)[number];

export interface NoteDocument {
  noteId: string;
  version: number;
  title: string;
  blocks: NoteBlock[];
}

export type KnownNoteBlock =
  | ParagraphBlock
  | HeadingBlock
  | BulletListBlock
  | OrderedListBlock
  | BlockquoteBlock
  | CodeBlock
  | CalloutBlock
  | ToggleBlock
  | TabsBlock
  | GutterDiffBlock
  | SpotlightBlock
  | PeekBlock;

export type NoteBlock = KnownNoteBlock | UnknownBlock;

export interface ParagraphBlock {
  id: string;
  type: 'paragraph';
  html: string;
}

export interface HeadingBlock {
  id: string;
  type: 'heading';
  level: 1 | 2 | 3;
  html: string;
}

export interface ListItem {
  id: string;
  html: string;
}

export interface BulletListBlock {
  id: string;
  type: 'bullet-list';
  items: ListItem[];
}

export interface OrderedListBlock {
  id: string;
  type: 'ordered-list';
  items: ListItem[];
}

export interface BlockquoteBlock {
  id: string;
  type: 'blockquote';
  html: string;
}

export interface CodeBlock {
  id: string;
  type: 'code';
  language: string;
  code: string;
}

export interface CalloutBlock {
  id: string;
  type: 'callout';
  tone?: CalloutTone;
  titleHtml?: string;
  html: string;
}

export interface ToggleBlock {
  id: string;
  type: 'toggle';
  open?: boolean;
  summaryHtml: string;
  bodyHtml: string;
}

export interface TabPanel {
  id: string;
  label: string;
  html: string;
}

export interface TabsBlock {
  id: string;
  type: 'tabs';
  activeTabId?: string;
  tabs: TabPanel[];
}

export interface GutterDiffBlock {
  id: string;
  type: 'gutter-diff';
  wrongLabel?: string;
  wrongHtml: string;
  correctLabel?: string;
  correctHtml: string;
}

export interface SpotlightStep {
  id: string;
  lines: [number, number];
  html: string;
}

export interface SpotlightBlock {
  id: string;
  type: 'spotlight';
  language: string;
  code: string;
  steps: SpotlightStep[];
}

export interface PeekBlock {
  id: string;
  type: 'peek';
  buttonLabel: string;
  title: string;
  headers: string[];
  rows: string[][];
}

export interface UnknownBlock {
  id: string;
  type: string;
  html?: string;
  [key: string]: unknown;
}

export interface StoredDraft {
  noteId: string;
  baseVersion: number;
  baselineHash: string;
  updatedAt: number;
  title: string;
  blocks: NoteBlock[];
}

export interface ReconciledDraftResult {
  doc: NoteDocument;
  restoredFromDraft: boolean;
  supersededDraftAvailable: boolean;
  storageAvailable: boolean;
}

export interface SyncPatchEnvelope {
  noteId: string;
  baseVersion: number;
  targetVersion: number;
  title: string;
  blockOrder: string[];
  deletedIds: string[];
  upsertedBlocks: NoteBlock[];
}

const KNOWN_TYPE_SET: ReadonlySet<string> = new Set(KNOWN_BLOCK_TYPES);

export function isKnownBlockType(type: string): type is KnownBlockType {
  return KNOWN_TYPE_SET.has(type);
}

export function isKnownBlock(block: NoteBlock): block is KnownNoteBlock {
  return KNOWN_TYPE_SET.has(block.type);
}

export function createBlockId(prefix = 'b'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export type InsertableBlockKind =
  | 'paragraph'
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'bullet-list'
  | 'ordered-list'
  | 'blockquote'
  | 'callout'
  | 'toggle'
  | 'code'
  | 'gutter-diff';

export function createDefaultBlock(
  kind: InsertableBlockKind,
  initialHtml = '',
  id = createBlockId(),
): NoteBlock {
  switch (kind) {
    case 'paragraph':
      return { id, type: 'paragraph', html: initialHtml };
    case 'heading-1':
      return { id, type: 'heading', level: 1, html: initialHtml };
    case 'heading-2':
      return { id, type: 'heading', level: 2, html: initialHtml };
    case 'heading-3':
      return { id, type: 'heading', level: 3, html: initialHtml };
    case 'bullet-list':
      return {
        id,
        type: 'bullet-list',
        items: [{ id: createBlockId('li'), html: initialHtml }],
      };
    case 'ordered-list':
      return {
        id,
        type: 'ordered-list',
        items: [{ id: createBlockId('li'), html: initialHtml }],
      };
    case 'blockquote':
      return { id, type: 'blockquote', html: initialHtml };
    case 'callout':
      return { id, type: 'callout', tone: 'blue', titleHtml: 'Note', html: initialHtml };
    case 'toggle':
      return {
        id,
        type: 'toggle',
        open: true,
        summaryHtml: initialHtml || 'Toggle summary',
        bodyHtml: '',
      };
    case 'code':
      return { id, type: 'code', language: 'text', code: '' };
    case 'gutter-diff':
      return {
        id,
        type: 'gutter-diff',
        wrongLabel: 'WRONG',
        wrongHtml: initialHtml,
        correctLabel: 'CORRECT',
        correctHtml: '',
      };
  }
}

export function cloneBlock<T extends NoteBlock>(block: T): T {
  return JSON.parse(JSON.stringify(block)) as T;
}

export function cloneDocument(doc: NoteDocument): NoteDocument {
  return JSON.parse(JSON.stringify(doc)) as NoteDocument;
}

export function normalizeNoteDocument(raw: unknown): NoteDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Note data must be a JSON object.');
  }
  const obj = raw as Record<string, unknown>;
  const noteId =
    typeof obj.noteId === 'string' && obj.noteId.trim().length > 0
      ? obj.noteId.trim()
      : 'untitled-note';
  const version =
    typeof obj.version === 'number' && Number.isFinite(obj.version) && obj.version >= 1
      ? Math.floor(obj.version)
      : 1;
  const title = typeof obj.title === 'string' ? obj.title : 'Untitled Study Note';
  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];

  const blocks: NoteBlock[] = rawBlocks.map((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      return {
        id: `b_fallback_${idx}`,
        type: 'paragraph',
        html: typeof entry === 'string' ? entry : '',
      };
    }
    const rec = entry as Record<string, unknown>;
    const id =
      typeof rec.id === 'string' && rec.id.trim().length > 0
        ? rec.id
        : createBlockId(`b${idx + 1}`);
    const type = typeof rec.type === 'string' ? rec.type : 'paragraph';
    return { ...rec, id, type } as NoteBlock;
  });

  if (blocks.length === 0) {
    blocks.push({ id: createBlockId('b1'), type: 'paragraph', html: '' });
  }

  return { noteId, version, title, blocks };
}
