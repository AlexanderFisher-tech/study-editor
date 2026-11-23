import type { BindSlot, SemanticColor } from '../types/schema';

export interface ActiveSelectionState {
  editableEl: HTMLElement;
  range: Range;
  rect: DOMRect;
  activeColor: SemanticColor | null;
  hasUnderline: boolean;
  hasCode: boolean;
  hasBold: boolean;
  activeNote: string | null;
  hasMask: boolean;
  activeBind: BindSlot | null;
}

export function findEditableAncestor(node: Node | null): HTMLElement | null {
  let cur: Node | null = node;
  while (cur) {
    if (cur.nodeType === 1 && (cur as HTMLElement).dataset?.richEditable === 'true') {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

function findMatchingAncestor(
  node: Node | null,
  root: HTMLElement,
  predicate: (el: HTMLElement) => boolean,
): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (cur.nodeType === 1 && predicate(cur as HTMLElement)) {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

export function inspectActiveSelection(editorRoot: HTMLElement | null): ActiveSelectionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  if (!range.toString().trim()) return null;

  const startEditable = findEditableAncestor(range.startContainer);
  const endEditable = findEditableAncestor(range.endContainer);
  if (!startEditable || startEditable !== endEditable) return null;
  if (editorRoot && !editorRoot.contains(startEditable)) return null;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  const anchor = range.commonAncestorContainer;

  const colorEl = findMatchingAncestor(
    anchor,
    startEditable,
    (el) => el.tagName === 'SPAN' && el.hasAttribute('data-color'),
  );
  const noteEl = findMatchingAncestor(
    anchor,
    startEditable,
    (el) => el.tagName === 'SPAN' && el.hasAttribute('data-note'),
  );
  const maskEl = findMatchingAncestor(
    anchor,
    startEditable,
    (el) => el.tagName === 'SPAN' && el.getAttribute('data-mask') === 'true',
  );
  const bindEl = findMatchingAncestor(
    anchor,
    startEditable,
    (el) => el.tagName === 'SPAN' && el.hasAttribute('data-bind'),
  );

  return {
    editableEl: startEditable,
    range: range.cloneRange(),
    rect,
    activeColor: (colorEl?.getAttribute('data-color') as SemanticColor | null) ?? null,
    hasUnderline: Boolean(
      findMatchingAncestor(anchor, startEditable, (el) => el.tagName === 'U'),
    ),
    hasCode: Boolean(
      findMatchingAncestor(anchor, startEditable, (el) => el.tagName === 'CODE'),
    ),
    hasBold: Boolean(
      findMatchingAncestor(
        anchor,
        startEditable,
        (el) => el.tagName === 'STRONG' || el.tagName === 'B',
      ),
    ),
    activeNote: noteEl?.getAttribute('data-note') ?? null,
    hasMask: Boolean(maskEl),
    activeBind: (bindEl?.getAttribute('data-bind') as BindSlot | null) ?? null,
  };
}

function unwrapElement(el: HTMLElement): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

function removeSpanAttrOrUnwrap(el: HTMLElement, attr: string): void {
  el.removeAttribute(attr);
  if (
    el.tagName === 'SPAN' &&
    !el.hasAttribute('data-color') &&
    !el.hasAttribute('data-note') &&
    !el.hasAttribute('data-mask') &&
    !el.hasAttribute('data-bind')
  ) {
    unwrapElement(el);
  }
}

function stripNestedAttr(fragment: DocumentFragment, attr: string): void {
  const matches = Array.from(fragment.querySelectorAll(`span[${attr}]`));
  for (const m of matches) {
    removeSpanAttrOrUnwrap(m as HTMLElement, attr);
  }
}

function selectNodeContents(node: Node): void {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(node);
  sel.removeAllRanges();
  sel.addRange(r);
}

function notifyEditableChanged(editableEl: HTMLElement): void {
  editableEl.dispatchEvent(new CustomEvent('study-format', { bubbles: true }));
}

function resolveWorkingRange(savedRange?: Range | null): { range: Range; editableEl: HTMLElement } | null {
  let range: Range | null = savedRange ? savedRange.cloneRange() : null;
  if (!range) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    range = sel.getRangeAt(0).cloneRange();
  }
  const editableEl = findEditableAncestor(range.commonAncestorContainer);
  if (!editableEl) return null;
  return { range, editableEl };
}

export function toggleInlineTag(
  tag: 'u' | 'code' | 'strong',
  savedRange?: Range | null,
): boolean {
  const resolved = resolveWorkingRange(savedRange);
  if (!resolved) return false;
  const { range, editableEl } = resolved;

  const upper = tag.toUpperCase();
  const ancestor = findMatchingAncestor(
    range.commonAncestorContainer,
    editableEl,
    (el) => el.tagName === upper || (upper === 'STRONG' && el.tagName === 'B'),
  );

  if (ancestor) {
    const parent = ancestor.parentNode;
    unwrapElement(ancestor);
    if (parent) {
      editableEl.normalize();
    }
    notifyEditableChanged(editableEl);
    return true;
  }

  if (range.collapsed) return false;

  const fragment = range.extractContents();
  const nested = Array.from(
    fragment.querySelectorAll(upper === 'STRONG' ? 'strong, b' : tag),
  );
  for (const el of nested) {
    unwrapElement(el as HTMLElement);
  }

  const wrapper = document.createElement(tag);
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);
  selectNodeContents(wrapper);
  notifyEditableChanged(editableEl);
  return true;
}

export function applyColorTag(
  color: SemanticColor | null,
  savedRange?: Range | null,
): boolean {
  const resolved = resolveWorkingRange(savedRange);
  if (!resolved) return false;
  const { range, editableEl } = resolved;

  const existing = findMatchingAncestor(
    range.commonAncestorContainer,
    editableEl,
    (el) => el.tagName === 'SPAN' && el.hasAttribute('data-color'),
  );

  if (existing && (range.collapsed || range.toString() === existing.textContent)) {
    if (color === null || existing.getAttribute('data-color') === color) {
      removeSpanAttrOrUnwrap(existing, 'data-color');
    } else {
      existing.setAttribute('data-color', color);
    }
    notifyEditableChanged(editableEl);
    return true;
  }

  if (range.collapsed) return false;

  const fragment = range.extractContents();
  stripNestedAttr(fragment, 'data-color');

  if (color === null) {
    range.insertNode(fragment);
    notifyEditableChanged(editableEl);
    return true;
  }

  const span = document.createElement('span');
  span.setAttribute('data-color', color);
  span.appendChild(fragment);
  range.insertNode(span);
  selectNodeContents(span);
  notifyEditableChanged(editableEl);
  return true;
}

export function setMicroDotNote(
  note: string | null,
  savedRange?: Range | null,
): boolean {
  const resolved = resolveWorkingRange(savedRange);
  if (!resolved) return false;
  const { range, editableEl } = resolved;

  const trimmed = note ? note.trim() : '';
  const existing = findMatchingAncestor(
    range.commonAncestorContainer,
    editableEl,
    (el) => el.tagName === 'SPAN' && el.hasAttribute('data-note'),
  );

  if (existing && (range.collapsed || range.toString() === existing.textContent)) {
    if (!trimmed) {
      removeSpanAttrOrUnwrap(existing, 'data-note');
    } else {
      existing.setAttribute('data-note', trimmed);
    }
    notifyEditableChanged(editableEl);
    return true;
  }

  if (range.collapsed || !trimmed) return false;

  const fragment = range.extractContents();
  stripNestedAttr(fragment, 'data-note');

  const span = document.createElement('span');
  span.setAttribute('data-note', trimmed);
  span.appendChild(fragment);
  range.insertNode(span);
  selectNodeContents(span);
  notifyEditableChanged(editableEl);
  return true;
}

export function toggleRecallMask(savedRange?: Range | null): boolean {
  const resolved = resolveWorkingRange(savedRange);
  if (!resolved) return false;
  const { range, editableEl } = resolved;

  const existing = findMatchingAncestor(
    range.commonAncestorContainer,
    editableEl,
    (el) => el.tagName === 'SPAN' && el.getAttribute('data-mask') === 'true',
  );

  if (existing) {
    removeSpanAttrOrUnwrap(existing, 'data-mask');
    notifyEditableChanged(editableEl);
    return true;
  }

  if (range.collapsed) return false;

  const fragment = range.extractContents();
  stripNestedAttr(fragment, 'data-mask');

  const span = document.createElement('span');
  span.setAttribute('data-mask', 'true');
  span.appendChild(fragment);
  range.insertNode(span);
  selectNodeContents(span);
  notifyEditableChanged(editableEl);
  return true;
}

export function setBindKey(
  slot: BindSlot | null,
  savedRange?: Range | null,
): boolean {
  const resolved = resolveWorkingRange(savedRange);
  if (!resolved) return false;
  const { range, editableEl } = resolved;

  const existing = findMatchingAncestor(
    range.commonAncestorContainer,
    editableEl,
    (el) => el.tagName === 'SPAN' && el.hasAttribute('data-bind'),
  );

  if (existing && (range.collapsed || range.toString() === existing.textContent)) {
    if (slot === null || existing.getAttribute('data-bind') === slot) {
      removeSpanAttrOrUnwrap(existing, 'data-bind');
    } else {
      existing.setAttribute('data-bind', slot);
    }
    notifyEditableChanged(editableEl);
    return true;
  }

  if (range.collapsed) return false;

  const fragment = range.extractContents();
  stripNestedAttr(fragment, 'data-bind');

  if (slot === null) {
    range.insertNode(fragment);
    notifyEditableChanged(editableEl);
    return true;
  }

  const span = document.createElement('span');
  span.setAttribute('data-bind', slot);
  span.appendChild(fragment);
  range.insertNode(span);
  selectNodeContents(span);
  notifyEditableChanged(editableEl);
  return true;
}
