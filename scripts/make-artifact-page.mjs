// Turns the single-file build into the page format a claude.ai artifact expects: page content only
// (title, styles, the root element, the script), without html/head/body tags of its own.
//   node scripts/make-artifact-page.mjs preview/index.html <out.html> [--start=#/route]
import fs from 'node:fs';
const [src, out, ...rest] = process.argv.slice(2);
const start = rest.find((a) => a.startsWith('--start='))?.slice(8) ?? '';
const html = fs.readFileSync(src, 'utf8');
const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? 'مناطق ون';
const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const scriptOpen = html.indexOf('<script type="module"');
const scriptStart = html.indexOf('>', scriptOpen) + 1;
const scriptEnd = html.lastIndexOf('</script>');
if (scriptOpen < 0 || scriptEnd < 0) throw new Error('module script not found');
const script = html.slice(scriptStart, scriptEnd);
// Only the app's own stylesheet(s); the pre-boot background rule is re-stated with the page tokens.
const css = styles.filter((s) => s.length > 2000).join('\n');
const boot = start ? `<script>if(!location.hash||location.hash==='#')location.hash=${JSON.stringify(start)};</script>\n` : '';
const page = `<title>${title}</title>
<style>
${css}
</style>
<div id="root"></div>
${boot}<script type="module">${script}</script>
`;
fs.writeFileSync(out, page);
console.log('page', out, (page.length / 1e6).toFixed(2), 'MB · title:', title, '· styles:', styles.length, '· start:', start || '(app default)');
