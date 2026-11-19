import { useMemo } from 'react';
import { cx } from '../cx';
import { qrMatrix } from './matrix';
import styles from './QR.module.css';

export interface QRProps {
  /** The text the code carries: a verification code or link. */
  value: string;
  /** Side of the square in px, quiet zone included. Default 168. */
  size?: number;
  /** What the code is for, for screen readers, e.g. "رمز التحقق من عقد الإيجار". Pass translated text. */
  label: string;
  className?: string;
}

/**
 * A scannable QR code as inline SVG. The modules are drawn in `currentColor` on a light plate that
 * stays light in the dark theme: scanners need dark modules on a light ground.
 */
export function QR({ value, size = 168, label, className }: QRProps) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  return (
    <span className={cx(styles.plate, className)} style={{ width: size, height: size }}>
      {matrix ? (
        <svg role="img" aria-label={label} className={styles.code} viewBox={`0 0 ${matrix.box} ${matrix.box}`} shapeRendering="crispEdges" data-modules={matrix.modules}>
          <path d={matrix.path} fill="currentColor" />
        </svg>
      ) : (
        <span role="img" aria-label={label} />
      )}
    </span>
  );
}
