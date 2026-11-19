import { useEffect } from 'react';

/**
 * Puts keyboard focus back where it was before a sheet opened. Render it inside the sheet.
 *
 * It notes the focused element when the sheet's content appears (before the dialog takes focus) and,
 * when the content goes away, returns focus there if it was dropped. A native dialog does this by
 * itself only when it is closed while still in the page; a sheet that is removed as it closes would
 * otherwise leave keyboard and screen-reader users at the top of the document.
 */
export function ReturnFocus() {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    return () => {
      const dropped = !document.activeElement || document.activeElement === document.body;
      if (dropped && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return null;
}
