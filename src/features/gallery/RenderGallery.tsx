/**
 * Gallery section for the building renders: every render on a white tile, a parchment tile, a near-black
 * tile and the maroon tile, large (as on a hero) and small (as at the head of a card), each with its name.
 */
import type { CSSProperties } from 'react';
import { useT } from '@/app/i18n';
import { Grid, Render, RENDER_NAMES, Tile, type RenderName } from '@/design/core';

const strings = {
  eyebrow: { ar: 'مجسّمات المباني', en: 'Building renders' },
  light: { ar: 'على بلاطة بيضاء', en: 'On a white tile' },
  parchment: { ar: 'على بلاطة بلون الصفحة', en: 'On a parchment tile' },
  dark: { ar: 'على بلاطة داكنة', en: 'On a dark tile' },
  brand: { ar: 'على البلاطة العنّابية', en: 'On the maroon tile' },
  tagline: {
    ar: 'المجسّم يستقر على السطح مباشرة: بلا إطار، بلا قصّ، وبالظل الوحيد في النظام.',
    en: 'The model rests directly on the surface: no frame, no crop, and the one shadow in the system.',
  },
  large: { ar: 'كبير: حتى 560 بكسل', en: 'Large: up to 560 px' },
  wide: { ar: 'عريض: بعرض العمود', en: 'Wide: the whole column' },
  small: { ar: 'صغير: 160 بكسل', en: 'Small: 160 px' },
} as const;

const TONES = ['light', 'parchment', 'dark', 'brand'] as const;
/** The wide render is shown on its own row; the rest fill the grids. */
const SQUARE: RenderName[] = RENDER_NAMES.filter((name) => name !== 'journey');

const group: CSSProperties = { marginBlockStart: 'var(--s-10)' };
const groupHead: CSSProperties = { marginBlockEnd: 'var(--s-6)', color: 'var(--ink-3)' };
/** Each model stands on the bottom of its cell, so the names of a row line up. */
const figure: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--s-2)', minWidth: 0, height: '100%' };
const caption: CSSProperties = { color: 'var(--ink-3)' };
const largeBox: CSSProperties = { width: 'min(100%, 560px)' };
const smallBox: CSSProperties = { width: 'min(100%, 160px)' };

function Named({ name, box, mirror = false }: { name: RenderName; box: CSSProperties; mirror?: boolean }) {
  return (
    <figure style={figure}>
      <div style={box}>
        <Render name={name} mirrorInRtl={mirror} />
      </div>
      <figcaption className="type-foot ltr" style={caption}>
        {name}
      </figcaption>
    </figure>
  );
}

export function RenderGallery() {
  const t = useT(strings);
  return (
    <>
      {TONES.map((tone) => (
        <Tile key={tone} tone={tone} eyebrow={t('eyebrow')} headline={t(tone)} tagline={t('tagline')}>
          <h3 className="type-callout" style={groupHead}>
            {t('large')}
          </h3>
          <Grid columns={2}>
            {SQUARE.map((name) => (
              <Named key={name} name={name} box={largeBox} />
            ))}
          </Grid>

          <div style={group}>
            <h3 className="type-callout" style={groupHead}>
              {t('wide')}
            </h3>
            <Named name="journey" box={{ width: '100%' }} mirror />
          </div>

          <div style={group}>
            <h3 className="type-callout" style={groupHead}>
              {t('small')}
            </h3>
            <Grid columns={4} compact>
              {SQUARE.map((name) => (
                <Named key={name} name={name} box={smallBox} />
              ))}
            </Grid>
          </div>
        </Tile>
      ))}
    </>
  );
}
