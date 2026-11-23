import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import type { InsertableBlockKind } from '../types/schema';
import { escapeHtmlText, sanitizeInlineHtml } from '../utils/sanitizer';
import type { FocusRequest, SlashMenuState } from '../state/store';

export interface EditableRichTextProps {
  html: string;
  onChange: (nextHtml: string) => void;
  className?: string;
  placeholder?: string;
  blockId?: string;
  singleLine?: boolean;
  enableMarkdownShortcuts?: boolean;
  enableSlashMenu?: boolean;
  slashMenu?: SlashMenuState | null;
  focusRequest?: FocusRequest | null;
  onConvertType?: (kind: InsertableBlockKind, remainingHtml: string) => void;
  onOpenSlashMenu?: (state: SlashMenuState) => void;
  onCloseSlashMenu?: () => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
  onMoveBlock?: (direction: -1 | 1) => void;
  onEditMicroDot?: (el: HTMLElement) => void;
  ariaLabel?: string;
}

const MARKDOWN_PREFIX_RULES: Array<{ pattern: RegExp; kind: InsertableBlockKind }> = [
  { pattern: /^###\s+([\s\S]*)$/, kind: 'heading-3' },
  { pattern: /^##\s+([\s\S]*)$/, kind: 'heading-2' },
  { pattern: /^#\s+([\s\S]*)$/, kind: 'heading-1' },
  { pattern: /^[-*]\s+([\s\S]*)$/, kind: 'bullet-list' },
  { pattern: /^1\.\s+([\s\S]*)$/, kind: 'ordered-list' },
  { pattern: /^>\s+([\s\S]*)$/, kind: 'blockquote' },
  { pattern: /^```(?:\s+([\s\S]*))?$/, kind: 'code' },
];

function placeCaretAtEnd(el: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function EditableRichText({
  html,
  onChange,
  className = '',
  placeholder = '',
  blockId,
  singleLine = false,
  enableMarkdownShortcuts = false,
  enableSlashMenu = false,
  slashMenu = null,
  focusRequest = null,
  onConvertType,
  onOpenSlashMenu,
  onCloseSlashMenu,
  onEnter,
  onBackspaceEmpty,
  onMoveBlock,
  onEditMicroDot,
  ariaLabel,
}: EditableRichTextProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string>(html);

  // Sync external prop changes synchronously without clobbering active typing caret
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const isFocused = document.activeElement === el;
    if (!isFocused || html !== lastEmittedRef.current) {
      if (el.innerHTML !== html) {
        el.innerHTML = html;
      }
      lastEmittedRef.current = html;
    }
  }, [html]);

  // Honor explicit focus requests synchronously (e.g. after Enter, markdown/slash conversion, or keyboard move)
  useLayoutEffect(() => {
    if (!focusRequest || !blockId || focusRequest.blockId !== blockId) return;
    const el = elRef.current;
    if (!el) return;
    el.focus();
    if (focusRequest.toEnd !== false) {
      placeCaretAtEnd(el);
    }
  }, [focusRequest, blockId]);

  // Listen to custom format events dispatched by FloatingToolbar selection helpers
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const handleFormat = () => {
      const clean = sanitizeInlineHtml(el.innerHTML);
      lastEmittedRef.current = clean;
      onChange(clean);
    };
    el.addEventListener('study-format', handleFormat);
    return () => el.removeEventListener('study-format', handleFormat);
  }, [onChange]);

  const handleInput = () => {
    const el = elRef.current;
    if (!el) return;

    const rawText = (el.textContent ?? '').replace(/\u00A0/g, ' ');

    if (enableMarkdownShortcuts && onConvertType) {
      for (const rule of MARKDOWN_PREFIX_RULES) {
        const match = rawText.match(rule.pattern);
        if (match) {
          const rest = match[1] ? escapeHtmlText(match[1]) : '';
          el.innerHTML = rest;
          lastEmittedRef.current = rest;
          if (onCloseSlashMenu) onCloseSlashMenu();
          onConvertType(rule.kind, rest);
          return;
        }
      }
    }

    if (enableSlashMenu && blockId && onOpenSlashMenu) {
      if (rawText.startsWith('/') && !rawText.includes('\n')) {
        const rect = el.getBoundingClientRect();
        onOpenSlashMenu({
          blockId,
          rect: { top: rect.bottom + 6, left: rect.left },
          filter: rawText.slice(1).trim(),
          mode: 'convert',
        });
      } else if (slashMenu && slashMenu.blockId === blockId && onCloseSlashMenu) {
        onCloseSlashMenu();
      }
    }

    const clean = sanitizeInlineHtml(el.innerHTML);
    lastEmittedRef.current = clean;
    onChange(clean);
  };

  const handleBlur = () => {
    const el = elRef.current;
    if (!el) return;
    const clean = sanitizeInlineHtml(el.innerHTML);
    if (el.innerHTML !== clean) {
      el.innerHTML = clean;
    }
    if (clean !== lastEmittedRef.current) {
      lastEmittedRef.current = clean;
      onChange(clean);
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const el = elRef.current;
    if (!el) return;

    const dt = e.clipboardData;
    const htmlData = dt?.getData('text/html') ?? '';
    const textData = dt?.getData('text/plain') ?? '';

    const sanitized = htmlData
      ? sanitizeInlineHtml(htmlData)
      : escapeHtmlText(textData).replace(/\r?\n/g, singleLine ? ' ' : '<br>');

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    range.deleteContents();

    const temp = document.createElement('div');
    temp.innerHTML = sanitized;
    const frag = document.createDocumentFragment();
    let lastNode: Node | null = null;
    while (temp.firstChild) {
      lastNode = temp.firstChild;
      frag.appendChild(temp.firstChild);
    }
    range.insertNode(frag);

    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(nextRange);
    }

    const clean = sanitizeInlineHtml(el.innerHTML);
    lastEmittedRef.current = clean;
    onChange(clean);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const el = elRef.current;
    if (!el) return;

    // If slash menu is active for this block, let SlashMenu handle navigation/selection keys
    if (
      slashMenu &&
      blockId &&
      slashMenu.blockId === blockId &&
      (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')
    ) {
      return;
    }

    // Keyboard block reordering: Cmd+Shift+Up / Cmd+Shift+Down (or Ctrl+Shift+Up/Down)
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && onMoveBlock) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        onMoveBlock(-1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        onMoveBlock(1);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && onEnter) {
      e.preventDefault();
      onEnter();
      return;
    }

    if (e.key === 'Enter' && singleLine) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Backspace' && onBackspaceEmpty) {
      const text = (el.textContent ?? '').replace(/\u00A0/g, '');
      if (text.length === 0) {
        e.preventDefault();
        onBackspaceEmpty();
        return;
      }
    }
  };

  const handleClick = (e: MouseEvent) => {
    if (!onEditMicroDot) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const target = e.target as HTMLElement | null;
    const noteEl = target?.closest('span[data-note]') as HTMLElement | null;
    if (noteEl && elRef.current?.contains(noteEl)) {
      onEditMicroDot(noteEl);
    }
  };

  return (
    <div
      ref={elRef}
      class={`se-rich-editable ${className}`}
      contentEditable
      data-rich-editable="true"
      data-block-id={blockId}
      data-placeholder={placeholder}
      role="textbox"
      aria-multiline={!singleLine}
      aria-label={ariaLabel}
      spellcheck={false}
      onInput={handleInput}
      onBlur={handleBlur}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    />
  );
}
