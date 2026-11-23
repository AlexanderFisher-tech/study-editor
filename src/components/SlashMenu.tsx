import { useEffect, useMemo, useState } from 'preact/hooks';
import type { InsertableBlockKind } from '../types/schema';
import type { SlashMenuState } from '../state/store';

export interface SlashMenuItem {
  kind: InsertableBlockKind;
  label: string;
  hint: string;
  keywords: string[];
  badge: string;
}

export const SLASH_MENU_ITEMS: readonly SlashMenuItem[] = [
  { kind: 'paragraph', label: 'Paragraph', hint: 'Plain text block', keywords: ['p', 'text', 'para'], badge: 'P' },
  { kind: 'heading-1', label: 'Heading 1', hint: 'Section title (# )', keywords: ['h1', 'heading', 'title'], badge: 'H1' },
  { kind: 'heading-2', label: 'Heading 2', hint: 'Subsection heading (## )', keywords: ['h2', 'heading', 'sub'], badge: 'H2' },
  { kind: 'heading-3', label: 'Heading 3', hint: 'Minor heading (### )', keywords: ['h3', 'heading'], badge: 'H3' },
  { kind: 'bullet-list', label: 'Bullet List', hint: 'Unordered list (- )', keywords: ['ul', 'list', 'bullet'], badge: '•' },
  { kind: 'ordered-list', label: 'Ordered List', hint: 'Numbered list (1. )', keywords: ['ol', 'list', 'number'], badge: '1.' },
  { kind: 'blockquote', label: 'Blockquote', hint: 'Indented quote (> )', keywords: ['quote', 'blockquote'], badge: '”' },
  { kind: 'callout', label: 'Callout', hint: 'Toned callout box', keywords: ['callout', 'note', 'info'], badge: '!' },
  { kind: 'toggle', label: 'Single-Level Toggle', hint: 'Collapsible disclosure', keywords: ['toggle', 'details', 'collapse'], badge: '▸' },
  { kind: 'code', label: 'Code Block', hint: 'Monospace snippet (```)', keywords: ['code', 'pre', 'snippet'], badge: '</>' },
  { kind: 'gutter-diff', label: 'Gutter Diff', hint: 'WRONG vs. CORRECT pair', keywords: ['diff', 'gutter', 'wrong', 'correct'], badge: '±' },
];

export interface SlashMenuProps {
  menu: SlashMenuState;
  onSelect: (kind: InsertableBlockKind) => void;
  onClose: () => void;
}

export function SlashMenu({ menu, onSelect, onClose }: SlashMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = menu.filter.toLowerCase();
    if (!q) return SLASH_MENU_ITEMS;
    return SLASH_MENU_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q)),
    );
  }, [menu.filter]);

  useEffect(() => {
    setActiveIndex(0);
  }, [menu.filter, menu.blockId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(filtered[activeIndex].kind);
      }
    };

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.se-slash-menu')) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeIndex, filtered, onClose, onSelect]);

  const left = Math.min(
    Math.max(12, menu.rect.left),
    typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 280) : menu.rect.left,
  );
  const top = Math.min(
    menu.rect.top,
    typeof window !== 'undefined' ? Math.max(12, window.innerHeight - 320) : menu.rect.top,
  );

  return (
    <div
      class="se-slash-menu"
      role="listbox"
      aria-label="Insert block"
      style={{ top: `${top}px`, left: `${left}px` }}
    >
      <div class="se-slash-header">Insert block</div>
      {filtered.length === 0 ? (
        <div class="se-slash-empty">No matching blocks</div>
      ) : (
        filtered.map((item, idx) => (
          <button
            key={item.kind}
            type="button"
            role="option"
            aria-selected={idx === activeIndex}
            class={`se-slash-item ${idx === activeIndex ? 'is-active' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.kind);
            }}
            onMouseEnter={() => setActiveIndex(idx)}
          >
            <span class="se-slash-badge">{item.badge}</span>
            <span class="se-slash-meta">
              <span class="se-slash-label">{item.label}</span>
              <span class="se-slash-hint">{item.hint}</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
