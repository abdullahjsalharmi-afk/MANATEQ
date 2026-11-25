/**
 * What the browser around the app can do with a document. Inside a frame (a hosted preview) printing is
 * blocked and the share sheet is usually missing, so the viewer offers only what will work.
 */

/** Whether the app runs inside a frame. A cross-origin parent throws on access: that is a frame too. */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Whether «حفظ PDF» (the print dialog) can open. */
export function canPrint(): boolean {
  return typeof window.print === 'function' && !isEmbedded();
}

/** Whether the system share sheet exists. */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}
