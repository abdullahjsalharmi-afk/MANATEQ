import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Tile.module.css';

const MEDIA = { small: styles.mediaSmall, default: styles.mediaDefault, wide: styles.mediaWide } as const;

export interface TileProps {
  /**
   * `light` white · `parchment` the page colour · `dark` near-black · `brand` Manateq maroon (the one loud moment:
   * the welcome and the next-step hero of Home). Inside `dark` and `brand` the tokens switch, so every component reads.
   */
  tone?: 'light' | 'parchment' | 'dark' | 'brand';
  /** Dark tiles only: the second or third near-black, for where two dark tiles touch. */
  shade?: 1 | 2 | 3;
  /** `hero` sets the headline in the hero size: the one big moment of a screen. */
  size?: 'default' | 'hero';
  /** A glyph or the product mark above everything else (a 44 px check on a confirmation). */
  lead?: ReactNode;
  /** One short line above the headline, 14 px, in gold. */
  eyebrow?: ReactNode;
  /** Two to five words, as on a product page. */
  headline?: ReactNode;
  /** One line under the headline. */
  tagline?: ReactNode;
  /** One or two pills: the primary, and a `secondary` beside it. */
  actions?: ReactNode;
  /** A building render (or a map, a figure) below the actions. It rests on the tile: never box it. */
  media?: ReactNode;
  /** How wide the media may grow: `small` 280 px · `default` 560 px (a render) · `wide` the whole column (the journey render, a map). */
  mediaWidth?: 'small' | 'default' | 'wide';
  /** Fill the viewport under the bars and centre the content (the welcome screen). */
  fill?: boolean;
  /** Heading level of the headline. Default 2: the screen owns the h1. */
  level?: 1 | 2 | 3;
  /** Anything else, after the media: captions, a card grid, fine print. */
  children?: ReactNode;
  as?: 'section' | 'div' | 'header';
  id?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * A full-bleed section for a big moment: white, parchment, near-black or maroon, edge to edge, no border,
 * no corner radius, no shadow. The change of surface is the divider. Text inside a tile is centred.
 * Use it directly inside a `<Screen bleed>`.
 */
export function Tile({
  tone = 'light',
  shade = 1,
  size = 'default',
  lead,
  eyebrow,
  headline,
  tagline,
  actions,
  media,
  mediaWidth = 'default',
  fill = false,
  level = 2,
  children,
  as: Tag = 'section',
  id,
  className,
  'aria-label': ariaLabel,
}: TileProps) {
  const Heading = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
  const dark = tone === 'dark';
  const toned = dark || tone === 'brand';
  return (
    <Tag
      id={id}
      aria-label={ariaLabel}
      className={cx(styles.tile, styles[tone], dark && shade === 2 && styles.shade2, dark && shade === 3 && styles.shade3, size === 'hero' && styles.hero, fill && styles.fill, className)}
      data-tile={tone}
      data-tone={toned ? tone : undefined}
    >
      <div className={styles.inner}>
        {lead ? <div className={styles.lead}>{lead}</div> : null}
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        {headline ? <Heading className={styles.headline}>{headline}</Heading> : null}
        {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
        {media ? <div className={cx(styles.media, MEDIA[mediaWidth])}>{media}</div> : null}
        {children ? <div className={styles.more}>{children}</div> : null}
      </div>
    </Tag>
  );
}
