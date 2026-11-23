import { render } from 'preact';
import { Editor } from './components/Editor';
import { normalizeNoteDocument, type NoteDocument } from './types/schema';
import './styles/study-editor.css';

export interface AntigravityStudyEditorAPI {
  mount: (rootEl: HTMLElement, rawInput?: string | NoteDocument) => boolean;
}

declare global {
  interface Window {
    AntigravityStudyEditor?: AntigravityStudyEditorAPI;
  }
}

function renderParseError(rootEl: HTMLElement, message: string, rawText: string): void {
  render(
    <div class="se-error-banner" role="alert">
      <div class="se-error-title">Unable to parse #note-data JSON</div>
      <div class="se-error-message">{message}</div>
      {rawText && <pre class="se-error-raw">{rawText}</pre>}
    </div>,
    rootEl,
  );
}

export function mount(rootEl: HTMLElement, rawInput?: string | NoteDocument): boolean {
  let rawText = '';
  let parsed: unknown;

  try {
    if (typeof rawInput === 'string') {
      rawText = rawInput;
      parsed = JSON.parse(rawInput);
    } else if (rawInput && typeof rawInput === 'object') {
      parsed = rawInput;
    } else {
      const dataEl = document.getElementById('note-data');
      if (!dataEl) {
        renderParseError(rootEl, 'Missing <script id="note-data" type="application/json"> element.', '');
        return false;
      }
      rawText = dataEl.textContent ?? '';
      parsed = JSON.parse(rawText);
    }

    const doc = normalizeNoteDocument(parsed);
    render(<Editor initialDoc={doc} />, rootEl);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    renderParseError(rootEl, msg, rawText.trim());
    return false;
  }
}

function autoMount(): void {
  if (typeof document === 'undefined') return;
  const rootEl = document.getElementById('study-root');
  if (!rootEl) return;
  mount(rootEl);
}

const api: AntigravityStudyEditorAPI = { mount };

if (typeof window !== 'undefined') {
  window.AntigravityStudyEditor = api;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  } else {
    autoMount();
  }
}
