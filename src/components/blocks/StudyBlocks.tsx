import { useState } from 'preact/hooks';
import {
  isKnownBlock,
  type GutterDiffBlock,
  type PeekBlock,
  type SpotlightBlock,
  type TabsBlock,
} from '../../types/schema';
import { EditableRichText } from '../EditableRichText';
import type { BlockSharedProps } from './StandardBlocks';

export function TabsBlockView({
  block,
  shared,
}: {
  block: TabsBlock;
  shared: BlockSharedProps;
}) {
  const tabs = block.tabs.length > 0 ? block.tabs : [{ id: 'tab_0', label: 'Tab 1', html: '' }];
  const activeId =
    block.activeTabId && tabs.some((t) => t.id === block.activeTabId)
      ? block.activeTabId
      : tabs[0].id;
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const selectTab = (tabId: string) => {
    shared.onUpdate((prev) =>
      isKnownBlock(prev) && prev.type === 'tabs' ? { ...prev, activeTabId: tabId } : prev,
    );
  };

  const updateTabLabel = (tabId: string, label: string) => {
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || prev.type !== 'tabs') return prev;
      return {
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
      };
    });
  };

  const updateTabHtml = (tabId: string, html: string) => {
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || prev.type !== 'tabs') return prev;
      return {
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === tabId ? { ...t, html } : t)),
      };
    });
  };

  return (
    <div class="se-tabs-block">
      <div class="se-tabs-bar" role="tablist" aria-label="Horizontal tabs">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id;
          return (
            <div
              key={tab.id}
              class={`se-tab-trigger ${isActive ? 'is-active' : ''}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectTab(tab.id);
                }
              }}
            >
              {isActive ? (
                <input
                  type="text"
                  class="se-tab-label-input"
                  value={tab.label}
                  aria-label="Active tab label"
                  size={Math.max(4, tab.label.length)}
                  onClick={(e) => e.stopPropagation()}
                  onInput={(e) => updateTabLabel(tab.id, (e.target as HTMLInputElement).value)}
                />
              ) : (
                <span>{tab.label}</span>
              )}
            </div>
          );
        })}
      </div>
      <div class="se-tabs-panel" role="tabpanel">
        <EditableRichText
          key={activeTab.id}
          blockId={block.id}
          html={activeTab.html}
          className="se-tabs-panel-body"
          placeholder="Tab content..."
          focusRequest={shared.focusRequest}
          onChange={(html) => updateTabHtml(activeTab.id, html)}
          onMoveBlock={shared.onMoveBlock}
          onEditMicroDot={shared.onEditMicroDot}
          ariaLabel={`Tab panel: ${activeTab.label}`}
        />
      </div>
    </div>
  );
}

export function GutterDiffBlockView({
  block,
  shared,
}: {
  block: GutterDiffBlock;
  shared: BlockSharedProps;
}) {
  return (
    <div class="se-gutter-diff" role="region" aria-label="Gutter comparison diff">
      <div class="se-diff-row is-wrong">
        <input
          type="text"
          class="se-diff-label"
          value={block.wrongLabel ?? 'WRONG'}
          aria-label="Wrong row label"
          onInput={(e) => {
            const wrongLabel = (e.target as HTMLInputElement).value;
            shared.onUpdate((prev) =>
              prev.type === 'gutter-diff' ? { ...prev, wrongLabel } : prev,
            );
          }}
        />
        <EditableRichText
          blockId={block.id}
          html={block.wrongHtml}
          className="se-diff-text"
          placeholder="Incorrect example..."
          focusRequest={shared.focusRequest}
          onChange={(wrongHtml) =>
            shared.onUpdate((prev) =>
              prev.type === 'gutter-diff' ? { ...prev, wrongHtml } : prev,
            )
          }
          onMoveBlock={shared.onMoveBlock}
          onEditMicroDot={shared.onEditMicroDot}
          ariaLabel="Wrong example"
        />
      </div>
      <div class="se-diff-row is-correct">
        <input
          type="text"
          class="se-diff-label"
          value={block.correctLabel ?? 'CORRECT'}
          aria-label="Correct row label"
          onInput={(e) => {
            const correctLabel = (e.target as HTMLInputElement).value;
            shared.onUpdate((prev) =>
              prev.type === 'gutter-diff' ? { ...prev, correctLabel } : prev,
            );
          }}
        />
        <EditableRichText
          html={block.correctHtml}
          className="se-diff-text"
          placeholder="Correct example..."
          onChange={(correctHtml) =>
            shared.onUpdate((prev) =>
              prev.type === 'gutter-diff' ? { ...prev, correctHtml } : prev,
            )
          }
          onMoveBlock={shared.onMoveBlock}
          onEditMicroDot={shared.onEditMicroDot}
          ariaLabel="Correct example"
        />
      </div>
    </div>
  );
}

export function SpotlightBlockView({
  block,
  shared,
}: {
  block: SpotlightBlock;
  shared: BlockSharedProps;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    block.steps[0]?.id ?? null,
  );
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);

  const activeStepId = hoveredStepId ?? selectedStepId;
  const activeStep = block.steps.find((s) => s.id === activeStepId) ?? null;
  const activeRange = activeStep ? activeStep.lines : null;

  const codeLines = block.code.split('\n');

  const updateStepHtml = (stepId: string, html: string) => {
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || prev.type !== 'spotlight') return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === stepId ? { ...s, html } : s)),
      };
    });
  };

  return (
    <div class="se-spotlight" role="region" aria-label="Step-to-code spotlight">
      <div class="se-spotlight-code">
        <div class="se-spotlight-lang">{block.language || 'code'}</div>
        <pre class="se-spotlight-pre">
          <code>
            {codeLines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const isHighlighted =
                activeRange !== null &&
                lineNum >= activeRange[0] &&
                lineNum <= activeRange[1];
              const isDimmed = activeRange !== null && !isHighlighted;
              return (
                <div
                  key={lineNum}
                  class={`se-code-line ${isHighlighted ? 'is-highlighted' : ''} ${
                    isDimmed ? 'is-dimmed' : ''
                  }`}
                  data-line={lineNum}
                  data-highlighted={isHighlighted ? 'true' : 'false'}
                >
                  <span class="se-line-num" aria-hidden="true">
                    {lineNum}
                  </span>
                  <span class="se-line-text">{lineText || ' '}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      <ol class="se-spotlight-steps">
        {block.steps.map((step, idx) => {
          const isActive = step.id === activeStepId;
          const [start, end] = step.lines;
          const rangeLabel = start === end ? `L${start}` : `L${start}–${end}`;
          return (
            <li
              key={step.id}
              class={`se-spotlight-step ${isActive ? 'is-active' : ''}`}
              data-step-id={step.id}
              onMouseEnter={() => setHoveredStepId(step.id)}
              onMouseLeave={() => setHoveredStepId(null)}
              onClick={() => setSelectedStepId(step.id)}
            >
              <span class="se-step-index">{idx + 1}</span>
              <span class="se-step-lines">{rangeLabel}</span>
              <EditableRichText
                blockId={idx === 0 ? block.id : undefined}
                html={step.html}
                className="se-step-text"
                placeholder="Explain step..."
                focusRequest={idx === 0 ? shared.focusRequest : null}
                onChange={(html) => updateStepHtml(step.id, html)}
                onMoveBlock={shared.onMoveBlock}
                onEditMicroDot={shared.onEditMicroDot}
                ariaLabel={`Spotlight step ${idx + 1}`}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PeekBlockView({
  block,
  shared,
}: {
  block: PeekBlock;
  shared: BlockSharedProps;
}) {
  const popoverId = `peek-${block.id}`;

  const updateCell = (rowIndex: number, colIndex: number, html: string) => {
    shared.onUpdate((prev) => {
      if (!isKnownBlock(prev) || prev.type !== 'peek') return prev;
      const rows = prev.rows.map((r, rIdx) =>
        rIdx === rowIndex ? r.map((c, cIdx) => (cIdx === colIndex ? html : c)) : r,
      );
      return { ...prev, rows };
    });
  };

  // Use attribute spread to emit standard HTML5 popover attributes cleanly across DOM typings
  const triggerAttrs: Record<string, string> = { popovertarget: popoverId };
  const popoverAttrs: Record<string, string> = { popover: 'auto' };

  return (
    <div class="se-peek-block">
      <button
        type="button"
        class="se-peek-trigger"
        {...triggerAttrs}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <line x1="2" y1="6.5" x2="14" y2="6.5" />
          <line x1="6.5" y1="6.5" x2="6.5" y2="13" />
        </svg>
        <span>{block.buttonLabel || 'Peek Reference'}</span>
      </button>

      <div id={popoverId} class="se-peek-popover" {...popoverAttrs}>
        <div class="se-peek-header">
          <span class="se-peek-title">{block.title}</span>
          <button
            type="button"
            class="se-icon-btn"
            aria-label="Close reference popover"
            {...{ popovertarget: popoverId, popovertargetaction: 'hide' }}
          >
            ×
          </button>
        </div>
        <div class="se-peek-table-wrap">
          <table class="se-peek-table">
            <thead>
              <tr>
                {block.headers.map((header, hIdx) => (
                  <th key={hIdx}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {block.headers.map((_, cIdx) => (
                    <td key={cIdx}>
                      <EditableRichText
                        html={row[cIdx] ?? ''}
                        className="se-peek-cell"
                        onChange={(html) => updateCell(rIdx, cIdx, html)}
                        onEditMicroDot={shared.onEditMicroDot}
                        ariaLabel={`${block.headers[cIdx] ?? `Column ${cIdx + 1}`}, row ${rIdx + 1}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
