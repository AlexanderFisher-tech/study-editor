import type { NoteBlock } from '../types/schema';

/**
 * Deterministic 32-bit FNV-1a hash over canonical JSON representation of blocks.
 * Used to detect baseline drift in #note-data between reloads.
 */
export function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashBlocks(blocks: NoteBlock[]): string {
  return hashString(JSON.stringify(blocks));
}
