import {
  BIND_SLOTS,
  isKnownBlock,
  SEMANTIC_COLORS,
  type BindSlot,
  type NoteBlock,
  type NoteDocument,
  type SemanticColor,
} from '../types/schema';

const COLOR_SET: ReadonlySet<string> = new Set(SEMANTIC_COLORS);
const BIND_SET: ReadonlySet<string> = new Set(BIND_SLOTS);

/** Tags whose entire subtree (including text) must be removed for security. */
const DROP_SUBTREE_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'svg',
  'math',
  'applet',
  'head',
  'title',
]);

/** Standard HTML tags that should be parsed as HTML (and stripped/unwrapped) rather than treated as code generics. */
const KNOWN_HTML_TAGS: ReadonlySet<string> = new Set([
  ...DROP_SUBTREE_TAGS,
  'span',
  'u',
  'code',
  'strong',
  'b',
  'br',
  'div',
  'p',
  'em',
  'i',
  'a',
  'mark',
  'font',
  'img',
  'hr',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'pre',
  'blockquote',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'main',
  'aside',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'label',
  'small',
  'sub',
  'sup',
  'del',
  's',
  'ins',
  'details',
  'summary',
  'link',
  'meta',
  'base',
  'audio',
  'video',
  'source',
  'canvas',
  'dot',
  ...SEMANTIC_COLORS,
]);

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes raw angle brackets that look like programming generics (e.g. `List<T>`,
 * `Map<string, number>`) or comparisons (`a < b`) so HTML5 parsing does not treat
 * `<T>` as an unclosed custom element and swallow subsequent text.
 */
function escapeUnrecognizedAngleBrackets(raw: string): string {
  if (!raw.includes('<')) return raw;

  return raw.replace(
    /<(\/?)([A-Za-z][A-Za-z0-9-]*)([^<>]*)>/g,
    (full, slash: string, tagName: string, rest: string) => {
      const lower = tagName.toLowerCase();
      const validHtmlBoundary = rest === '' || /^[\s/]/.test(rest);
      if (KNOWN_HTML_TAGS.has(lower) && validHtmlBoundary) {
        return full;
      }
      // If it looks like a paired unknown XML/HTML tag (both open and close exist),
      // let DOMParser parse and unwrap it; otherwise treat it as a code generic like List<T> or Map<K, V>.
      if (validHtmlBoundary) {
        const closeRe = new RegExp(`</${tagName}\\s*>`, 'i');
        const openRe = new RegExp(`<${tagName}(\\s[^<>]*)?>`, 'i');
        if (slash === '' && !rest.trimEnd().endsWith('/') && closeRe.test(raw)) {
          return full;
        }
        if (slash === '/' && openRe.test(raw)) {
          return full;
        }
      }
      return escapeHtmlText(full);
    },
  );
}

function isValidColor(value: string | null): value is SemanticColor {
  return value !== null && COLOR_SET.has(value.toLowerCase());
}

function isValidBindSlot(value: string | null): value is BindSlot {
  return value !== null && BIND_SET.has(value.trim());
}

function serializeAllowedNode(node: Node): string {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return escapeHtmlText(node.textContent ?? '');
  }

  if (node.nodeType !== 1 /* ELEMENT_NODE */) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (DROP_SUBTREE_TAGS.has(tag)) {
    return '';
  }

  if (tag === 'br') {
    return '<br>';
  }

  if (tag === 'img' || tag === 'hr' || tag === 'input' || tag === 'meta' || tag === 'link') {
    return '';
  }

  const childrenHtml = serializeChildren(el);

  // Normalize legacy color shorthand tags (<red>...</red>) -> <span data-color="red">...</span>
  if (COLOR_SET.has(tag)) {
    if (!childrenHtml) return '';
    return `<span data-color="${tag}">${childrenHtml}</span>`;
  }

  // Normalize legacy micro-dot tag (<dot data-note="...">...</dot>) -> <span data-note="...">...</span>
  if (tag === 'dot') {
    if (!childrenHtml) return '';
    const note = el.getAttribute('data-note')?.trim() ?? '';
    if (!note) return childrenHtml;
    return `<span data-note="${escapeHtmlAttr(note)}">${childrenHtml}</span>`;
  }

  if (tag === 'b' || tag === 'strong') {
    if (!childrenHtml) return '';
    return `<strong>${childrenHtml}</strong>`;
  }

  if (tag === 'u') {
    if (!childrenHtml) return '';
    return `<u>${childrenHtml}</u>`;
  }

  if (tag === 'code') {
    if (!childrenHtml) return '';
    return `<code>${childrenHtml}</code>`;
  }

  if (tag === 'span') {
    if (!childrenHtml) return '';
    const attrs: string[] = [];

    const rawColor = el.getAttribute('data-color');
    if (isValidColor(rawColor)) {
      attrs.push(`data-color="${rawColor.toLowerCase()}"`);
    }

    const rawNote = el.getAttribute('data-note');
    if (rawNote !== null && rawNote.trim().length > 0) {
      attrs.push(`data-note="${escapeHtmlAttr(rawNote.trim())}"`);
    }

    const rawMask = el.getAttribute('data-mask');
    if (rawMask === 'true' || rawMask === '') {
      attrs.push('data-mask="true"');
    }

    const rawBind = el.getAttribute('data-bind');
    if (isValidBindSlot(rawBind)) {
      attrs.push(`data-bind="${rawBind.trim()}"`);
    }

    if (attrs.length === 0) {
      return childrenHtml;
    }
    return `<span ${attrs.join(' ')}>${childrenHtml}</span>`;
  }

  // Browser contenteditable frequently wraps pasted/entered lines in <div> or <p>.
  // Preserve line breaks cleanly between adjacent block elements.
  if (tag === 'div' || tag === 'p') {
    return childrenHtml;
  }

  // Strip any other HTML wrapper tag while preserving sanitized inner content.
  return childrenHtml;
}

function serializeChildren(parent: Node): string {
  const parts: string[] = [];
  const children = Array.from(parent.childNodes);

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isBlockWrapper =
      child.nodeType === 1 &&
      ((child as HTMLElement).tagName.toLowerCase() === 'div' ||
        (child as HTMLElement).tagName.toLowerCase() === 'p');

    const serialized = serializeAllowedNode(child);

    if (isBlockWrapper && i > 0 && parts.length > 0) {
      const prev = parts[parts.length - 1];
      if (!prev.endsWith('<br>')) {
        parts.push('<br>');
      }
    }

    if (serialized) {
      parts.push(serialized);
    }
  }

  return parts.join('');
}

/**
 * Strictly sanitizes rich-text inline HTML against the Section 3.4 allowlist:
 * - Allowed tags: <span data-color|data-note|data-mask|data-bind>, <u>, <code>, <strong>, <br>
 * - Legacy migration: <red>.. -> <span data-color="red">, <dot data-note> -> <span data-note>
 * - XSS & browser style cleanup: strips <script>, on*, style="...", invalid attributes
 * - Preserves code generics like `List<T>` safely as `List&lt;T&gt;`
 */
export function sanitizeInlineHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  const preprocessed = escapeUnrecognizedAngleBrackets(rawHtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${preprocessed}</body>`, 'text/html');
  const result = serializeChildren(doc.body);

  // Strip single trailing bogus <br> often inserted by contenteditable browsers when empty.
  if (result === '<br>') return '';
  return result;
}

/** Sanitizes every rich-text field in a single NoteBlock without mutating unknown fields. */
export function sanitizeBlock(block: NoteBlock): NoteBlock {
  if (!isKnownBlock(block)) {
    // Unknown block: preserve all unknown properties intact; sanitize html only if string.
    if (typeof block.html === 'string') {
      return { ...block, html: sanitizeInlineHtml(block.html) };
    }
    return { ...block };
  }

  switch (block.type) {
    case 'paragraph':
    case 'blockquote':
      return { ...block, html: sanitizeInlineHtml(block.html ?? '') };
    case 'heading':
      return {
        ...block,
        level: block.level === 1 || block.level === 2 || block.level === 3 ? block.level : 2,
        html: sanitizeInlineHtml(block.html ?? ''),
      };
    case 'bullet-list':
    case 'ordered-list':
      return {
        ...block,
        items: (Array.isArray(block.items) ? block.items : []).map((item, idx) => ({
          id: item.id || `${block.id}_i${idx}`,
          html: sanitizeInlineHtml(item.html ?? ''),
        })),
      };
    case 'code':
      return {
        ...block,
        language: typeof block.language === 'string' ? block.language : 'text',
        code: typeof block.code === 'string' ? block.code : '',
      };
    case 'callout':
      return {
        ...block,
        titleHtml:
          typeof block.titleHtml === 'string'
            ? sanitizeInlineHtml(block.titleHtml)
            : undefined,
        html: sanitizeInlineHtml(block.html ?? ''),
      };
    case 'toggle':
      return {
        ...block,
        summaryHtml: sanitizeInlineHtml(block.summaryHtml ?? ''),
        bodyHtml: sanitizeInlineHtml(block.bodyHtml ?? ''),
      };
    case 'tabs':
      return {
        ...block,
        tabs: (Array.isArray(block.tabs) ? block.tabs : []).map((tab, idx) => ({
          id: tab.id || `${block.id}_t${idx}`,
          label: typeof tab.label === 'string' ? tab.label : `Tab ${idx + 1}`,
          html: sanitizeInlineHtml(tab.html ?? ''),
        })),
      };
    case 'gutter-diff':
      return {
        ...block,
        wrongLabel: block.wrongLabel || 'WRONG',
        wrongHtml: sanitizeInlineHtml(block.wrongHtml ?? ''),
        correctLabel: block.correctLabel || 'CORRECT',
        correctHtml: sanitizeInlineHtml(block.correctHtml ?? ''),
      };
    case 'spotlight':
      return {
        ...block,
        language: typeof block.language === 'string' ? block.language : 'text',
        code: typeof block.code === 'string' ? block.code : '',
        steps: (Array.isArray(block.steps) ? block.steps : []).map((step, idx) => ({
          id: step.id || `${block.id}_s${idx}`,
          lines:
            Array.isArray(step.lines) && step.lines.length === 2
              ? [Number(step.lines[0]) || 1, Number(step.lines[1]) || 1]
              : [1, 1],
          html: sanitizeInlineHtml(step.html ?? ''),
        })),
      };
    case 'peek':
      return {
        ...block,
        buttonLabel: typeof block.buttonLabel === 'string' ? block.buttonLabel : 'Peek Reference',
        title: typeof block.title === 'string' ? block.title : 'Reference',
        headers: Array.isArray(block.headers) ? block.headers.map(String) : [],
        rows: Array.isArray(block.rows)
          ? block.rows.map((row) =>
              Array.isArray(row) ? row.map((cell) => sanitizeInlineHtml(String(cell ?? ''))) : [],
            )
          : [],
      };
  }
}

export function sanitizeDocument(doc: NoteDocument): NoteDocument {
  return {
    ...doc,
    blocks: doc.blocks.map(sanitizeBlock),
  };
}
