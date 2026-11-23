import { describe, expect, it } from 'vitest';
import type { NoteDocument } from '../../src/types/schema';
import { exportToMarkdown } from '../../src/utils/markdown';

const fullSampleDoc: NoteDocument = {
  noteId: 'full-export-test',
  version: 1,
  title: 'Export Fixture',
  blocks: [
    {
      id: 'b1',
      type: 'paragraph',
      html: 'Active <strong>places</strong> <span data-color="red" data-bind="1" data-note="Doer">agent</span> in <u>subject</u> with <code>be</code> (<span data-mask="true">V3</span>).',
    },
    { id: 'b2', type: 'heading', level: 2, html: 'Section Two' },
    {
      id: 'b3',
      type: 'bullet-list',
      items: [
        { id: 'li1', html: 'Alpha' },
        { id: 'li2', html: 'Beta' },
      ],
    },
    {
      id: 'b4',
      type: 'ordered-list',
      items: [
        { id: 'oli1', html: 'First' },
        { id: 'oli2', html: 'Second' },
      ],
    },
    { id: 'b5', type: 'blockquote', html: 'Quoted wisdom.' },
    { id: 'b6', type: 'code', language: 'ts', code: 'const x = 1;' },
    {
      id: 'b7',
      type: 'callout',
      tone: 'orange',
      titleHtml: 'Trap',
      html: 'Watch non-human agents.',
    },
    {
      id: 'b8',
      type: 'toggle',
      open: false,
      summaryHtml: 'Diagnostic',
      bodyHtml: 'Add <code>by zombies</code>.',
    },
    {
      id: 'b9',
      type: 'tabs',
      activeTabId: 't1',
      tabs: [
        { id: 't1', label: 'Active', html: 'Actor first.' },
        { id: 't2', label: 'Passive', html: 'Patient first.' },
      ],
    },
    {
      id: 'b10',
      type: 'gutter-diff',
      wrongLabel: 'WRONG',
      wrongHtml: 'The bug was fixed by Alex.',
      correctLabel: 'CORRECT',
      correctHtml: 'Alex fixed the bug.',
    },
    {
      id: 'b11',
      type: 'spotlight',
      language: 'js',
      code: 'const a = 1;\nconst b = 2;',
      steps: [
        { id: 's1', lines: [1, 1], html: 'Declare <code>a</code>.' },
        { id: 's2', lines: [1, 2], html: 'Both declarations.' },
      ],
    },
    {
      id: 'b12',
      type: 'peek',
      buttonLabel: 'Peek',
      title: 'Tense Table',
      headers: ['Tense', 'Form'],
      rows: [['Present', '<code>writes</code>']],
    },
  ],
};

describe('exportToMarkdown', () => {
  it('serializes all 12 block types and 7 inline annotations preserving color spans by default', () => {
    const md = exportToMarkdown(fullSampleDoc, { stripColorHtml: false });

    expect(md).toContain('# Export Fixture');
    expect(md).toContain(
      'Active **places** <span data-color="red">agent</span> (*Note: Doer*) in <u>subject</u> with `be` (==V3==).',
    );
    expect(md).toContain('## Section Two');
    expect(md).toContain('- Alpha\n- Beta');
    expect(md).toContain('1. First\n2. Second');
    expect(md).toContain('> Quoted wisdom.');
    expect(md).toContain('```ts\nconst x = 1;\n```');
    expect(md).toContain('> [!NOTE] Trap\n> Watch non-human agents.');
    expect(md).toContain('<details><summary>Diagnostic</summary>\n\nAdd `by zombies`.\n</details>');
    expect(md).toContain('#### [Tab: Active]\n\nActor first.');
    expect(md).toContain('#### [Tab: Passive]\n\nPatient first.');
    expect(md).toContain('> [!FAILURE] WRONG\n> The bug was fixed by Alex.');
    expect(md).toContain('> [!SUCCESS] CORRECT\n> Alex fixed the bug.');
    expect(md).toContain('1. **Line 1:** Declare `a`.\n2. **Lines 1–2:** Both declarations.');
    expect(md).toContain('#### Reference: Tense Table\n\n| Tense | Form |\n| --- | --- |\n| Present | `writes` |');
  });

  it('strips color span HTML when stripColorHtml is true while preserving note, mask, and code', () => {
    const md = exportToMarkdown(fullSampleDoc, { stripColorHtml: true });
    expect(md).not.toContain('data-color=');
    expect(md).toContain('Active **places** agent (*Note: Doer*) in <u>subject</u> with `be` (==V3==).');
  });
});
