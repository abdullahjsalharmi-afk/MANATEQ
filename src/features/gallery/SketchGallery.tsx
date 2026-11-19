/**
 * Gallery section — every line sketch on light and on dark paper, small (120 px) and at full width,
 * so each drawing can be judged where it is hardest: tiny, and large.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useLang, useT, type PluralForms } from '@/app/i18n';
import { Section } from '@/design/core';
import { Sketch } from '@/design/Sketch/Sketch';
import { SKETCHES, SKETCH_NAMES, type SketchName } from '@/design/sketches';

const strings = {
  title: { ar: 'الرسوم', en: 'Sketches' },
  hint: { ar: 'رسوم خطية بقلم واحد: على ورق فاتح وداكن، بعرض 120 بكسل وبالعرض الكامل.', en: 'Single-line drawings: on light and dark paper, at 120 px and at full width.' },
  again: { ar: 'ارسم من جديد', en: 'Draw again' },
  light: { ar: 'ورق فاتح', en: 'Light paper' },
  dark: { ar: 'ورق داكن', en: 'Dark paper' },
  journey: { ar: 'الرحلة: أرض، ثم بناء، ثم مستودع يعمل، ثم بوابة', en: 'The journey: a plot, a building going up, a working warehouse, the gate' },
  plot: { ar: 'قطعة أرض ممسوحة وعليها راية', en: 'A surveyed plot with a flag' },
  warehouse: { ar: 'مستودع بإطارات معدنية وباب واحد مميَّز', en: 'A portal-frame warehouse with one bay picked out' },
  factory: { ar: 'مصنع بسقف مسنَّن ومدخنة', en: 'A saw-tooth factory with a chimney' },
  crane: { ar: 'رافعة برجية ترفع عارضة فوق هيكل يرتفع', en: 'A tower crane lifting a beam over a rising frame' },
  gate: { ar: 'بوابة حاجزها مرفوع ومركبة تعبر', en: 'A gate with its barrier raised and a vehicle passing' },
  contract: { ar: 'عقد عليه ختم وقلم يوقّع', en: 'A contract with a seal and a pen signing' },
  wallet: { ar: 'وثائق مرتبة، أعلاها برمز تحقّق', en: 'A stack of documents, the top one with a code to check' },
  tools: { ar: 'مفتاح صيانة أمام عمود إنارة ومخروط', en: 'A spanner across a street light, and a cone' },
  allclear: { ar: 'أفق هادئ وشمس منخفضة وعلامة تمام', en: 'A calm horizon, a low sun and a tick' },
  search: { ar: 'عدسة مكبّرة فوق قطع أراضٍ', en: 'A magnifier over a few plots' },
  inbox: { ar: 'درج وارد فارغ', en: 'An empty tray' },
  invoice: { ar: 'إيصال عليه علامة تمام', en: 'A receipt with a tick' },
  handover: { ar: 'مفتاح فوق قطعة أرض', en: 'A key over a plot' },
  map: { ar: 'خريطة قطر وعليها ثلاثة مواقع', en: 'The outline of Qatar with three pins' },
  shield: { ar: 'خوذة سلامة', en: 'A safety helmet' },
} as const;

const strokeCount: PluralForms = {
  ar: { one: 'خطّ واحد', two: 'خطّان', few: '{n} خطوط', many: '{n} خطًّا' },
  en: { one: '{n} stroke', other: '{n} strokes' },
};

type Paper = 'light' | 'dark';
const PAPERS: readonly Paper[] = ['light', 'dark'];

/** The tokens a sketch and its sheet are drawn with. */
const TOKENS = ['--surface', '--ink', '--ink-3', '--accent', '--line'] as const;

/**
 * Both papers are shown at once, whatever the current theme. Rather than keep a copy of the colours here,
 * the gallery reads each theme's token values from tokens.css as the browser loaded it.
 */
function readPaper(paper: Paper): CSSProperties | undefined {
  const selector = paper === 'dark' ? /^:root\[data-theme=["']?dark["']?\]$/ : /^:root$/;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a sheet from another origin cannot be read
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || !selector.test(rule.selectorText.trim()) || !rule.style.getPropertyValue('--ink')) continue;
      return Object.fromEntries(TOKENS.map((token) => [token, rule.style.getPropertyValue(token).trim()])) as CSSProperties;
    }
  }
  return undefined;
}

const sheetStyle = (tokens: CSSProperties | undefined, pad: number): CSSProperties => ({
  ...tokens,
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  padding: pad,
  borderRadius: 'var(--r-card)',
  background: 'var(--surface)',
  boxShadow: 'inset 0 0 0 1px var(--line)',
});

export function SketchGallery() {
  const t = useT(strings);
  const { fmt } = useLang();
  const [papers, setPapers] = useState<Partial<Record<Paper, CSSProperties>> | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    setPapers({ light: readPaper('light'), dark: readPaper('dark') });
  }, []);

  if (!papers) return null;
  // If a theme's tokens cannot be read, show the sketches once, on the current theme's surface.
  const shown: readonly (Paper | 'current')[] = papers.light && papers.dark ? PAPERS : ['current'];
  const tokensOf = (paper: Paper | 'current') => (paper === 'current' ? undefined : papers[paper]);
  const paperLabel = (paper: Paper | 'current') => (paper === 'current' ? undefined : t(paper));

  return (
    <Section title={t('title')} hint={t('hint')} action={{ label: t('again'), onClick: () => setRound((n) => n + 1) }}>
      <div key={round} style={{ display: 'grid', gap: 36 }}>
        {SKETCH_NAMES.map((name: SketchName) => (
          <figure key={name} style={{ display: 'grid', gap: 10, minWidth: 0 }}>
            <figcaption style={{ display: 'grid', gap: 2 }}>
              <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <code className="ltr" style={{ font: 'inherit', fontWeight: 600 }}>
                  {name}
                </code>
                <span data-num style={{ fontSize: 'var(--t-cap)', color: 'var(--ink-3)' }}>
                  {fmt.plural(SKETCHES[name].strokes.length, strokeCount)}
                </span>
              </span>
              <span style={{ fontSize: 'var(--t-foot)', color: 'var(--ink-2)' }}>{t(name)}</span>
            </figcaption>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`, gap: 10 }}>
              {shown.map((paper) => (
                <div key={paper} style={sheetStyle(tokensOf(paper), 16)} title={paperLabel(paper)}>
                  <Sketch name={name} size={120} />
                </div>
              ))}
            </div>
            {shown.map((paper) => (
              <div key={paper} style={sheetStyle(tokensOf(paper), 16)} title={paperLabel(paper)}>
                <Sketch name={name} size="fill" label={t(name)} />
              </div>
            ))}
          </figure>
        ))}
      </div>
    </Section>
  );
}
