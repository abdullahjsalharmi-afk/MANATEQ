/**
 * Where the welcome hands over once the visitor has entered: `?next=` when it names a screen of the app
 * (a path that starts with one '/', not the welcome itself), Home otherwise.
 */
export function nextTarget(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\s\\]/.test(next)) return '/';
  const path = next.split('?')[0] ?? '/';
  if (path === '/welcome' || path.startsWith('/welcome/')) return '/';
  return next;
}
