import { describe, expect, it } from 'vitest';
import { sanitizeBlock, sanitizeInlineHtml } from '../../src/utils/sanitizer';
import type { UnknownBlock } from '../../src/types/schema';

describe('sanitizeInlineHtml', () => {
  it('preserves all allowed semantic tags and data-* attributes', () => {
    const input =
      'Active <strong>places</strong> <span data-color="red" data-note="Doer of action" data-bind="3"><code>agent</code></span> in <u>subject</u> (<span data-mask="true">hidden</span>)<br>next';
    expect(sanitizeInlineHtml(input)).toBe(input);
  });

  it('migrates legacy shorthand color tags and <dot> tags to standard spans', () => {
    expect(sanitizeInlineHtml('<red>agent</red>')).toBe('<span data-color="red">agent</span>');
    expect(sanitizeInlineHtml('<purple><code>be + V3</code></purple>')).toBe(
      '<span data-color="purple"><code>be + V3</code></span>',
    );
    expect(sanitizeInlineHtml('<dot data-note="tip text">word</dot>')).toBe(
      '<span data-note="tip text">word</span>',
    );
  });

  it('strips dangerous XSS tags, event handlers, and inline styles while keeping safe text', () => {
    expect(sanitizeInlineHtml('Hello <script>alert(1)</script>world')).toBe('Hello world');
    expect(sanitizeInlineHtml('<img src=x onerror="alert(1)">clean')).toBe('clean');
    expect(
      sanitizeInlineHtml('<span data-color="blue" onclick="evil()" style="font-weight:bold">ok</span>'),
    ).toBe('<span data-color="blue">ok</span>');
  });

  it('drops invalid data-color and data-bind values while preserving inner text', () => {
    expect(sanitizeInlineHtml('<span data-color="neon">glow</span>')).toBe('glow');
    expect(sanitizeInlineHtml('<span data-bind="99">unbound</span>')).toBe('unbound');
    expect(sanitizeInlineHtml('<span data-bind="0">zero</span>')).toBe('zero');
  });

  it('safely preserves angle brackets in programming generics and comparisons', () => {
    expect(sanitizeInlineHtml('Use <code>List<T></code> and Map<K, V>')).toBe(
      'Use <code>List&lt;T&gt;</code> and Map&lt;K, V&gt;',
    );
    expect(sanitizeInlineHtml('Check a < b and c > d')).toBe('Check a &lt; b and c &gt; d');
  });

  it('normalizes <b> to <strong> and drops empty trailing contenteditable <br>', () => {
    expect(sanitizeInlineHtml('<b>action</b>')).toBe('<strong>action</strong>');
    expect(sanitizeInlineHtml('<br>')).toBe('');
  });

  it('preserves unknown properties when sanitizing an UnknownBlock', () => {
    const unknown: UnknownBlock = {
      id: 'b9',
      type: 'future-chart',
      html: '<red>Fallback</red> <script>x()</script>',
      chartData: [1, 2, 3],
      meta: { axis: 'y' },
    };
    const sanitized = sanitizeBlock(unknown) as UnknownBlock;
    expect(sanitized.type).toBe('future-chart');
    expect(sanitized.html).toBe('<span data-color="red">Fallback</span> ');
    expect(sanitized.chartData).toEqual([1, 2, 3]);
    expect(sanitized.meta).toEqual({ axis: 'y' });
  });
});
