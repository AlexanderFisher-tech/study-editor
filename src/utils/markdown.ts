import { isKnownBlock, type NoteBlock, type NoteDocument } from '../types/schema';
import { sanitizeInlineHtml } from './sanitizer';

export interface MarkdownExportOptions {
  stripColorHtml?: boolean;
}

function wrapInlineCode(text: string): string {
  const longestRun = (text.match(/`+/g) ?? []).reduce(
    (max, run) => Math.max(max, run.length),
    0,
  );
  const fence = '`'.repeat(longestRun + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function convertNodeToMarkdown(node: Node, options: MarkdownExportOptions): string {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    return node.textContent ?? '';
  }

  if (node.nodeType !== 1 /* ELEMENT_NODE */) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    return '\n';
  }

  const inner = Array.from(el.childNodes)
    .map((child) => convertNodeToMarkdown(child, options))
    .join('');

  if (tag === 'code') {
    return wrapInlineCode(el.textContent ?? '');
  }

  if (tag === 'strong' || tag === 'b') {
    return inner ? `**${inner}**` : '';
  }

  if (tag === 'u') {
    return inner ? `<u>${inner}</u>` : '';
  }

  if (tag === 'span') {
    let output = inner;
    const color = el.getAttribute('data-color');
    const mask = el.getAttribute('data-mask');
    const note = el.getAttribute('data-note');

    if (color && !options.stripColorHtml) {
      output = `<span data-color="${color}">${output}</span>`;
    }

    if (mask === 'true') {
      output = `==${output}==`;
    }

    if (note && note.trim().length > 0) {
      output = `${output} (*Note: ${note.trim()}*)`;
    }

    // data-bind is transient hover-isolation metadata and is stripped automatically.
    return output;
  }

  return inner;
}

export function inlineHtmlToMarkdown(
  rawHtml: string,
  options: MarkdownExportOptions = {},
): string {
  if (!rawHtml) return '';
  const sanitized = sanitizeInlineHtml(rawHtml);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${sanitized}</body>`, 'text/html');
  return Array.from(doc.body.childNodes)
    .map((node) => convertNodeToMarkdown(node, options))
    .join('');
}

function prefixQuoteLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n');
}

function escapeTableCell(cellMd: string): string {
  return cellMd.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

function blockToMarkdown(block: NoteBlock, options: MarkdownExportOptions): string {
  if (!isKnownBlock(block)) {
    if (typeof block.html === 'string') {
      return inlineHtmlToMarkdown(block.html, options);
    }
    return `\`\`\`json\n${JSON.stringify(block, null, 2)}\n\`\`\``;
  }

  switch (block.type) {
    case 'paragraph':
      return inlineHtmlToMarkdown(block.html, options);

    case 'heading': {
      const hashes = '#'.repeat(block.level);
      return `${hashes} ${inlineHtmlToMarkdown(block.html, options)}`;
    }

    case 'bullet-list':
      return block.items
        .map((item) => `- ${inlineHtmlToMarkdown(item.html, options).replace(/\n/g, '\n  ')}`)
        .join('\n');

    case 'ordered-list':
      return block.items
        .map(
          (item, i) =>
            `${i + 1}. ${inlineHtmlToMarkdown(item.html, options).replace(/\n/g, '\n   ')}`,
        )
        .join('\n');

    case 'blockquote':
      return prefixQuoteLines(inlineHtmlToMarkdown(block.html, options));

    case 'code': {
      const lang = block.language ? block.language.trim() : '';
      return `\`\`\`${lang}\n${block.code}\n\`\`\``;
    }

    case 'callout': {
      const title = block.titleHtml ? inlineHtmlToMarkdown(block.titleHtml, options).trim() : '';
      const header = title ? `> [!NOTE] ${title}` : '> [!NOTE]';
      const body = inlineHtmlToMarkdown(block.html, options);
      return body ? `${header}\n${prefixQuoteLines(body)}` : header;
    }

    case 'toggle': {
      const summary = inlineHtmlToMarkdown(block.summaryHtml, options);
      const body = inlineHtmlToMarkdown(block.bodyHtml, options);
      return `<details><summary>${summary}</summary>\n\n${body}\n</details>`;
    }

    case 'tabs':
      return block.tabs
        .map((tab) => {
          const body = inlineHtmlToMarkdown(tab.html, options);
          return `#### [Tab: ${tab.label}]\n\n${body}`;
        })
        .join('\n\n');

    case 'gutter-diff': {
      const wrongLabel = block.wrongLabel || 'WRONG';
      const correctLabel = block.correctLabel || 'CORRECT';
      const wrongBody = inlineHtmlToMarkdown(block.wrongHtml, options);
      const correctBody = inlineHtmlToMarkdown(block.correctHtml, options);
      return [
        `> [!FAILURE] ${wrongLabel}\n${prefixQuoteLines(wrongBody)}`,
        `> [!SUCCESS] ${correctLabel}\n${prefixQuoteLines(correctBody)}`,
      ].join('\n\n');
    }

    case 'spotlight': {
      const lang = block.language ? block.language.trim() : '';
      const codeFence = `\`\`\`${lang}\n${block.code}\n\`\`\``;
      const steps = block.steps
        .map((step, i) => {
          const [start, end] = step.lines;
          const lineRange = start === end ? `Line ${start}` : `Lines ${start}–${end}`;
          const text = inlineHtmlToMarkdown(step.html, options);
          return `${i + 1}. **${lineRange}:** ${text}`;
        })
        .join('\n');
      return steps ? `${codeFence}\n\n${steps}` : codeFence;
    }

    case 'peek': {
      const headers = block.headers.map((h) => escapeTableCell(h));
      const headerRow = `| ${headers.join(' | ')} |`;
      const dividerRow = `| ${headers.map(() => '---').join(' | ')} |`;
      const bodyRows = block.rows.map((row) => {
        const padded = headers.map((_, idx) =>
          escapeTableCell(inlineHtmlToMarkdown(row[idx] ?? '', options)),
        );
        return `| ${padded.join(' | ')} |`;
      });
      return [`#### Reference: ${block.title}`, '', headerRow, dividerRow, ...bodyRows].join('\n');
    }
  }
}

export function exportToMarkdown(
  doc: NoteDocument,
  options: MarkdownExportOptions = {},
): string {
  const sections: string[] = [];
  if (doc.title && doc.title.trim().length > 0) {
    sections.push(`# ${doc.title.trim()}`);
  }
  for (const block of doc.blocks) {
    const rendered = blockToMarkdown(block, options);
    if (rendered.length > 0) {
      sections.push(rendered);
    }
  }
  return sections.join('\n\n') + '\n';
}

export function triggerMarkdownDownload(noteId: string, markdown: string): void {
  const safeName = noteId.replace(/[^a-zA-Z0-9._-]/g, '_') || 'study-note';
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
