import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { keepWhole } from '@/design/List/keepWhole';

const html = (text: string) => renderToStaticMarkup(<p>{keepWhole(text)}</p>);
const wholes = (text: string) => [...html(text).matchAll(/<span class="[^"]*">([^<]*)<\/span>/g)].map((match) => match[1]);

describe('keepWhole', () => {
  it('keeps codes, dates and times on one line', () => {
    expect(wholes('عرض تخصيص القطعة · AW-116')).toEqual(['AW-116']);
    expect(wholes('RCP-2026-0049 · 27 أغسطس 2026')).toEqual(['RCP-2026-0049', '27 أغسطس 2026']);
    expect(wholes('13 Feb 2027, 6:00 pm')).toEqual(['13 Feb 2027', '6:00 pm']);
    expect(wholes('Verification TSD-58SD-7KX8')).toEqual(['TSD-58SD-7KX8']);
    expect(wholes('15 نوفمبر 2026، 11:59 م')).toEqual(['15 نوفمبر 2026', '11:59 م']);
  });

  it('accepts the formatters’ word joiners and no-break spaces', () => {
    expect(wholes('Lease · ⁦AK-⁠113⁩')).toEqual(['AK-⁠113']);
    expect(wholes('Paid 13 Oct 2026')).toEqual(['13 Oct 2026']);
    expect(wholes('Rent · BA\u2011121')).toEqual(['BA\u2011121']);
  });

  it('leaves ordinary words and non-strings alone', () => {
    expect(html('No-objection certificate')).toBe('<p>No-objection certificate</p>');
    expect(keepWhole(42)).toBe(42);
  });
});
