import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/app/i18n';
import { cx } from '../cx';
import { RENDERS, type RenderName } from './renders';
import { renderAlt } from './strings';
import styles from './Render.module.css';

export interface RenderProps {
  name: RenderName;
  /** Replaces the built-in description. */
  alt?: string;
  /** Purely decorative here: hidden from assistive technology. */
  decorative?: boolean;
  /** Load at once (for the first screenful). Renders further down load when they come near. */
  eager?: boolean;
  /** The single soft shadow of the system, under the model. On by default. */
  shadow?: boolean;
  /** Mirror in right-to-left layouts, so a sequence (the journey) starts on the reading side. */
  mirrorInRtl?: boolean;
  className?: string;
}

/**
 * A building render: an architectural scale model resting on the surface behind it.
 * It is the only imagery in the product and the only thing that carries a shadow.
 * The parent sets its width; the height follows the picture.
 */
export function Render({ name, alt, decorative = false, eager = false, shadow = true, mirrorInRtl = false, className }: RenderProps) {
  const { pick, dir } = useLang();
  const asset = RENDERS[name];
  const ref = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ref.current?.complete) setReady(true);
  }, []);

  return (
    <img
      ref={ref}
      className={cx(styles.render, shadow && styles.shadow, ready && styles.ready, mirrorInRtl && dir === 'rtl' && styles.mirror, className)}
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt={decorative ? '' : (alt ?? pick(renderAlt[name]))}
      aria-hidden={decorative || undefined}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onLoad={() => setReady(true)}
    />
  );
}
