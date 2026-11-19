/**
 * Installability and offline use for the hosted build. The single-file build (opened from a file,
 * an e-mail or a preview) skips all of it.
 */
export function setupPwa(): void {
  if (__SINGLE_FILE__ || typeof document === 'undefined') return;

  const add = (rel: string, href: string) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
  };
  add('manifest', './manifest.webmanifest');
  add('apple-touch-icon', './icons/apple-touch-icon.png');

  const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (secure && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* offline support is optional */
      });
    });
  }
}
