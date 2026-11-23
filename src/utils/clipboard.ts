export type CopyMethod = 'clipboard' | 'execCommand' | 'fallback';

export interface CopyResult {
  ok: boolean;
  method: CopyMethod;
}

/**
 * 3-tier clipboard copy strategy designed for sandboxed Canvas preview iframes:
 * 1. navigator.clipboard.writeText()
 * 2. Offscreen <textarea> + document.execCommand('copy')
 * 3. Fallback callback (opens inline selectable textarea popover)
 */
export async function copyTextWithFallback(
  text: string,
  onFallback?: (text: string) => void,
): Promise<CopyResult> {
  // Tier 1: Async Clipboard API
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard' };
    } catch {
      // Fall through to Tier 2
    }
  }

  // Tier 2: document.execCommand('copy') via offscreen textarea
  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);

    const prevFocus = document.activeElement as HTMLElement | null;
    try {
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copied = document.execCommand('copy');
      if (copied) {
        return { ok: true, method: 'execCommand' };
      }
    } catch {
      // Fall through to Tier 3
    } finally {
      document.body.removeChild(textarea);
      if (prevFocus && typeof prevFocus.focus === 'function') {
        prevFocus.focus();
      }
    }
  }

  // Tier 3: Manual copy popover
  if (onFallback) {
    onFallback(text);
  }
  return { ok: false, method: 'fallback' };
}
