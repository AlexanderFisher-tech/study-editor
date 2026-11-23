import { useEffect, useRef } from 'preact/hooks';
import {
  CALLOUT_TONES,
  createBlockId,
  isKnownBlock,
  type BlockquoteBlock,
  type BulletListBlock,
  type CalloutBlock,
  type CalloutTone,
  type CodeBlock,
  type HeadingBlock,
  type InsertableBlockKind,
  type NoteBlock,
  type OrderedListBlock,
  type ParagraphBlock,
  type ToggleBlock,
  type UnknownBlock,
} from '../../types/schema';
import type { FocusRequest, SlashMenuState } from '../../state/store';
import { EditableRichText } from '../EditableRichText';

export interface BlockSharedProps {
  slashMenu: SlashMenuState | null;
  focusRequest: FocusRequest | null;
  onUpdate: (updater: (prev: NoteBlock) => NoteBlock) => void;
  onInsertAfter: () => void;
  onDelete: () => void;
  onMoveBlock: (direction: -1 | 1) => void;
  onConvertType: (kind: InsertableBlockKind, remainingHtml: string) => void;
  onOpenSlashMenu: (state: SlashMenuState) => void;
  onCloseSlashMenu: () => void;
  onEditMicroDot: (el: HTMLElement) => void;
}

export function ParagraphBlockView({
  block,
  shared,
}: {
  block: ParagraphBlock;
  shared: BlockSharedProps;
}) {
  return (
    <EditableRichText
      blockId={block.id}
      html={block.html}
      className="se-paragraph"
      placeholder="Type text, markdown (# , - , > ), or '/' for blocks..."
      enableMarkdownShortcuts
      enableSlashMenu
      slashMenu={shared.slashMenu}
      focusRequest={shared.focusRequest}
      onChange={(html) => shared.onUpdate((prev) => ({ ...prev, html }))}
      onConvertType={shared.onConvertType}
      onOpenSlashMenu={shared.onOpenSlashMenu}
      onCloseSlashMenu={shared.onCloseSlashMenu}
      onEnter={shared.onInsertAfter}
      onBackspaceEmpty={shared.onDelete}
      onMoveBlock={shared.onMoveBlock}
      onEditMicroDot={shared.onEditMicroDot}
      ariaLabel="Paragraph block"
    />
  );
}

export function HeadingBlockView({
  block,
  shared,
}: {
  block: HeadingBlock;
  shared: BlockSharedProps;
}) {
  return (
    <EditableRichText
      blockId={block.id}
      html={block.html}
      className={`se-heading se-h${block.level}`}
      placeholder={`Heading ${block.level}`}
      singleLine
      focusRequest={shared.focusRequest}
      onChange={(html) => shared.onUpdate((prev) => ({ ...prev, html }))}
      onEnter={shared.onInsertAfter}
      onBackspaceEmpty={shared.onDelete}
      onMoveBlock={shared.onMoveBlock}
      onEditMicroDot={shared.onEditMicroDot}
      ariaLabel={`Heading ${block.level}`}
    />
  );
}

export function ListBlockView({
  block,
  shared,
}: {
  block: BulletListBlock | OrderedListBlock;
  shared: BlockSharedProps;
}) {
  const isOrdered = block.type === 'ordered-list';

  const updateItem = (itemId: string, html: string) => {
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || (prev.type !== 'bullet-list' && prev.type !== 'ordered-list')) {
        return prev;
      }
      return {
        ...prev,
        items: prev.items.map((it) => (it.id === itemId ? { ...it, html } : it)),
      };
    });
  };

  const insertItemAfter = (itemIndex: number) => {
    const newItemId = createBlockId('li');
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || (prev.type !== 'bullet-list' && prev.type !== 'ordered-list')) {
        return prev;
      }
      const items = [
        ...prev.items.slice(0, itemIndex + 1),
        { id: newItemId, html: '' },
        ...prev.items.slice(itemIndex + 1),
      ];
      return { ...prev, items };
    });
    setTimeout(() => {
      const nextEl = document.querySelector(
        `[data-list-item-id="${newItemId}"] [data-rich-editable="true"]`,
      ) as HTMLElement | null;
      nextEl?.focus();
    }, 0);
  };

  const removeItem = (itemIndex: number) => {
    if (block.items.length <= 1) {
      shared.onDelete();
      return;
    }
    const prevItemId = block.items[Math.max(0, itemIndex - 1)].id;
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || (prev.type !== 'bullet-list' && prev.type !== 'ordered-list')) {
        return prev;
      }
      return {
        ...prev,
        items: prev.items.filter((_, idx) => idx !== itemIndex),
      };
    });
    setTimeout(() => {
      const prevEl = document.querySelector(
        `[data-list-item-id="${prevItemId}"] [data-rich-editable="true"]`,
      ) as HTMLElement | null;
      prevEl?.focus();
    }, 0);
  };

  const Tag = isOrdered ? 'ol' : 'ul';
  return (
    <Tag class={`se-list ${isOrdered ? 'se-ordered-list' : 'se-bullet-list'}`}>
      {block.items.map((item, idx) => (
        <li key={item.id} class="se-list-item" data-list-item-id={item.id}>
          <EditableRichText
            blockId={idx === 0 ? block.id : undefined}
            html={item.html}
            className="se-list-item-text"
            placeholder="List item..."
            focusRequest={idx === 0 ? shared.focusRequest : null}
            onChange={(html) => updateItem(item.id, html)}
            onEnter={() => insertItemAfter(idx)}
            onBackspaceEmpty={() => removeItem(idx)}
            onMoveBlock={shared.onMoveBlock}
            onEditMicroDot={shared.onEditMicroDot}
            ariaLabel={isOrdered ? `Ordered list item ${idx + 1}` : `Bullet list item ${idx + 1}`}
          />
        </li>
      ))}
    </Tag>
  );
}

export function BlockquoteBlockView({
  block,
  shared,
}: {
  block: BlockquoteBlock;
  shared: BlockSharedProps;
}) {
  return (
    <blockquote class="se-blockquote">
      <EditableRichText
        blockId={block.id}
        html={block.html}
        className="se-blockquote-text"
        placeholder="Quote..."
        focusRequest={shared.focusRequest}
        onChange={(html) => shared.onUpdate((prev) => ({ ...prev, html }))}
        onBackspaceEmpty={shared.onDelete}
        onMoveBlock={shared.onMoveBlock}
        onEditMicroDot={shared.onEditMicroDot}
        ariaLabel="Blockquote"
      />
    </blockquote>
  );
}

export function CodeBlockView({
  block,
  shared,
}: {
  block: CodeBlock;
  shared: BlockSharedProps;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(56, ta.scrollHeight)}px`;
  }, [block.code]);

  useEffect(() => {
    if (shared.focusRequest && shared.focusRequest.blockId === block.id) {
      taRef.current?.focus();
    }
  }, [shared.focusRequest, block.id]);

  return (
    <div class="se-code-block">
      <div class="se-code-header">
        <input
          type="text"
          class="se-code-lang"
          value={block.language}
          aria-label="Code language"
          placeholder="language"
          onInput={(e) => {
            const language = (e.target as HTMLInputElement).value;
            shared.onUpdate((prev) => (prev.type === 'code' ? { ...prev, language } : prev));
          }}
        />
      </div>
      <textarea
        ref={taRef}
        class="se-code-textarea"
        value={block.code}
        spellcheck={false}
        aria-label="Code content"
        placeholder="// Write code..."
        onInput={(e) => {
          const code = (e.target as HTMLTextAreaElement).value;
          shared.onUpdate((prev) => (prev.type === 'code' ? { ...prev, code } : prev));
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              shared.onMoveBlock(-1);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              shared.onMoveBlock(1);
              return;
            }
          }
          if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const next = `${ta.value.slice(0, start)}  ${ta.value.slice(end)}`;
            shared.onUpdate((prev) => (prev.type === 'code' ? { ...prev, code: next } : prev));
            setTimeout(() => {
              ta.selectionStart = ta.selectionEnd = start + 2;
            }, 0);
          }
        }}
      />
    </div>
  );
}

export function CalloutBlockView({
  block,
  shared,
}: {
  block: CalloutBlock;
  shared: BlockSharedProps;
}) {
  const tone: CalloutTone = block.tone ?? 'blue';

  return (
    <div class="se-callout" data-tone={tone}>
      <div class="se-callout-top">
        <EditableRichText
          html={block.titleHtml ?? ''}
          className="se-callout-title"
          placeholder="Callout title"
          singleLine
          onChange={(titleHtml) =>
            shared.onUpdate((prev) => (prev.type === 'callout' ? { ...prev, titleHtml } : prev))
          }
          onEditMicroDot={shared.onEditMicroDot}
          ariaLabel="Callout title"
        />
        <div class="se-tone-picker" role="group" aria-label="Callout tone">
          {CALLOUT_TONES.map((t) => (
            <button
              key={t}
              type="button"
              class={`se-tone-dot ${tone === t ? 'is-active' : ''}`}
              data-swatch={t}
              title={`Tone: ${t}`}
              aria-label={`Set callout tone ${t}`}
              onClick={() =>
                shared.onUpdate((prev) => (prev.type === 'callout' ? { ...prev, tone: t } : prev))
              }
            />
          ))}
        </div>
      </div>
      <EditableRichText
        blockId={block.id}
        html={block.html}
        className="se-callout-body"
        placeholder="Callout body..."
        focusRequest={shared.focusRequest}
        onChange={(html) =>
          shared.onUpdate((prev) => (prev.type === 'callout' ? { ...prev, html } : prev))
        }
        onMoveBlock={shared.onMoveBlock}
        onEditMicroDot={shared.onEditMicroDot}
        ariaLabel="Callout body"
      />
    </div>
  );
}

export function ToggleBlockView({
  block,
  shared,
}: {
  block: ToggleBlock;
  shared: BlockSharedProps;
}) {
  const isOpen = Boolean(block.open);

  return (
    <div class={`se-toggle ${isOpen ? 'is-open' : ''}`}>
      <div class="se-toggle-header">
        <button
          type="button"
          class="se-toggle-btn"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse toggle' : 'Expand toggle'}
          onClick={() =>
            shared.onUpdate((prev) =>
              prev.type === 'toggle' ? { ...prev, open: !prev.open } : prev,
            )
          }
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 4 10 8 6 12" />
          </svg>
        </button>
        <EditableRichText
          blockId={block.id}
          html={block.summaryHtml}
          className="se-toggle-summary"
          placeholder="Toggle summary..."
          singleLine
          focusRequest={shared.focusRequest}
          onChange={(summaryHtml) =>
            shared.onUpdate((prev) =>
              prev.type === 'toggle' ? { ...prev, summaryHtml } : prev,
            )
          }
          onMoveBlock={shared.onMoveBlock}
          onEditMicroDot={shared.onEditMicroDot}
          ariaLabel="Toggle summary"
        />
      </div>
      {isOpen && (
        <div class="se-toggle-body-wrap">
          <EditableRichText
            html={block.bodyHtml}
            className="se-toggle-body"
            placeholder="Toggle details..."
            onChange={(bodyHtml) =>
              shared.onUpdate((prev) =>
                prev.type === 'toggle' ? { ...prev, bodyHtml } : prev,
              )
            }
            onMoveBlock={shared.onMoveBlock}
            onEditMicroDot={shared.onEditMicroDot}
            ariaLabel="Toggle body"
          />
        </div>
      )}
    </div>
  );
}

export function UnknownBlockView({
  block,
  shared,
}: {
  block: UnknownBlock;
  shared: BlockSharedProps;
}) {
  if (typeof block.html === 'string') {
    return (
      <div class="se-unknown-editable" data-unknown-type={block.type}>
        <EditableRichText
          blockId={block.id}
          html={block.html}
          className="se-paragraph"
          focusRequest={shared.focusRequest}
          onChange={(html) => shared.onUpdate((prev) => ({ ...prev, html }))}
          onMoveBlock={shared.onMoveBlock}
          onEditMicroDot={shared.onEditMicroDot}
          ariaLabel={`Fallback editable block (${block.type})`}
        />
      </div>
    );
  }

  return (
    <div class="se-unknown-readonly" data-unknown-type={block.type}>
      <div class="se-unknown-badge">Unrecognized block type: {block.type}</div>
      <pre class="se-unknown-json">{JSON.stringify(block, null, 2)}</pre>
    </div>
  );
}
