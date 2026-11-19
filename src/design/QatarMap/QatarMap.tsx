import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useLang, useT } from '@/app/i18n';
import { qatarMap, zones } from '@/data/catalog';
import { cx } from '../cx';
import { neighbourMarker, nearestMarker, placeLabel, spreadMarkers, type Direction, type Size } from './layout';
import styles from './QatarMap.module.css';
import { strings } from './strings';

export interface QatarMapProps {
  /** The code of the selected zone, e.g. "BA". */
  selected?: string;
  /** Called with a zone code when a marker is chosen. */
  onSelect: (code: string) => void;
  /** When given, only these zones stay prominent and selectable; the others fade to small dots. */
  highlight?: string[];
  /** Height of the map in pixels; the width follows from the outline. Default 440. */
  height?: number;
  /** Names the map for screen readers. */
  label?: string;
  className?: string;
}

/** No two markers sit closer than this, so each keeps a touch target of at least this size. */
const MARKER_GAP = 28;
/** A marker with room around it gets the full-size touch target. */
const MAX_TARGET = 44;
/** A tap this close to a marker counts as a tap on it. */
const TAP_REACH = 30;
/** From the centre of the selected marker to the near edge of its name tag. */
const LABEL_OFFSET = 18;
/** The name tag keeps this far from the centre of every other marker. */
const MARKER_CLEARANCE = 10;
const KEYS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * The schematic map: Qatar's outline with the 13 zones. Land zones are circles and warehousing parks
 * are rounded squares; the selected zone grows, takes the accent and shows its name. Markers are real
 * buttons; arrow keys move between them by compass direction. East stays on the right in Arabic too —
 * a map does not mirror.
 */
export function QatarMap({ selected, onSelect, highlight, height = 440, label, className }: QatarMapProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [measured, setMeasured] = useState<{ label: Size; side: number } | null>(null);

  const [minX, minY, boxWidth, boxHeight] = qatarMap.viewBox;
  const width = Math.round((height * boxWidth) / boxHeight);

  const markers = useMemo(() => {
    const placed = spreadMarkers(
      zones.map((zone) => ({ id: zone.code, x: (zone.map.x / 100) * width, y: (zone.map.y / 100) * height })),
      MARKER_GAP,
    );
    return zones.map((zone, index) => ({ zone, ...(placed[index] as (typeof placed)[number]) }));
  }, [width, height]);

  const lit = useMemo(() => (highlight ? new Set(highlight) : null), [highlight]);
  const active = markers.filter((marker) => !lit || lit.has(marker.id) || marker.id === selected);
  const chosen = active.find((marker) => marker.id === selected);
  const tabStop = chosen ?? active[0];
  const chosenName = chosen ? pick(chosen.zone.name) : '';

  // The name of the selected zone is measured once it is on the page, so it can be kept inside the map.
  useLayoutEffect(() => {
    const measure = () => {
      const tag = labelRef.current;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const side = Math.max(0, (wrap.clientWidth - width) / 2);
      const size = tag ? { width: tag.offsetWidth, height: tag.offsetHeight } : { width: 0, height: 0 };
      setMeasured((previous) => (previous && previous.side === side && previous.label.width === size.width && previous.label.height === size.height ? previous : { label: size, side }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined' || !wrapRef.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [chosenName, width]);

  // The name tag of the selected zone, and the short stem that ties it to its marker.
  let tag: { left: number; top: number; stemX: number; stemY: number } | undefined;
  if (chosen) {
    // Before the first measurement, estimate from the length of the name.
    const size = measured && measured.label.width > 0 ? measured.label : { width: Math.min(220, chosenName.length * 7 + 20), height: 26 };
    const side = measured ? measured.side : 40;
    const place = placeLabel(
      chosen,
      size,
      active.filter((marker) => marker.id !== chosen.id),
      { minX: 4 - side, maxX: width + side - 4, minY: 0, maxY: height },
      LABEL_OFFSET,
      MARKER_CLEARANCE,
    );
    tag = { left: place.left, top: place.top, stemX: place.stem.x, stemY: place.stem.y };
  }

  const focusMarker = (id: string) => stageRef.current?.querySelector<HTMLButtonElement>(`[data-zone="${id}"]`)?.focus();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = (event.target as HTMLElement).dataset.zone;
    if (!from) return;
    let next: string | undefined;
    const direction = KEYS[event.key];
    if (direction) next = neighbourMarker(active, from, direction)?.id;
    else if (event.key === 'Home') next = active[0]?.id;
    else if (event.key === 'End') next = active[active.length - 1]?.id;
    else return;
    event.preventDefault();
    if (next) focusMarker(next);
  };

  // A tap that lands just beside a marker still chooses it.
  const onNearTap = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const stage = stageRef.current;
    if (!stage) return;
    const box = stage.getBoundingClientRect();
    const hit = nearestMarker(active, { x: event.clientX - box.left, y: event.clientY - box.top }, TAP_REACH);
    if (hit) onSelect(hit.id);
  };

  return (
    <figure className={cx(styles.map, className)}>
      <div ref={wrapRef} className={styles.wrap} onClick={onNearTap}>
        <div ref={stageRef} role="group" aria-label={label ?? t('map')} className={styles.stage} style={{ width, height }} onKeyDown={onKeyDown}>
          <svg className={styles.outline} width={width} height={height} viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path className={styles.shore} d={qatarMap.path} />
            <path className={styles.ground} d={qatarMap.path} />
          </svg>

          {markers.map((marker) => {
            const { zone } = marker;
            const position = { left: marker.x, top: marker.y };
            if (!active.includes(marker)) {
              return <span key={zone.code} className={cx(styles.faint, styles[zone.kind])} style={position} aria-hidden="true" />;
            }
            const on = marker.id === selected;
            const target = Math.min(MAX_TARGET, Math.floor(marker.room));
            return (
              <button
                key={zone.code}
                type="button"
                data-zone={zone.code}
                className={cx(styles.marker, on && styles.on)}
                style={{ ...position, width: target, height: target }}
                aria-pressed={on}
                aria-label={t('marker', { name: pick(zone.name), type: pick(zone.typeLabel) })}
                tabIndex={tabStop?.id === marker.id ? 0 : -1}
                onClick={() => onSelect(zone.code)}
              >
                <span className={cx(styles.glyph, styles[zone.kind])} />
              </button>
            );
          })}

          {chosen && tag ? (
            <>
              <svg className={styles.stem} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
                <line x1={chosen.x} y1={chosen.y} x2={tag.stemX} y2={tag.stemY} />
              </svg>
              <span ref={labelRef} className={styles.tag} style={{ left: tag.left, top: tag.top }} aria-hidden="true">
                {chosenName}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <figcaption className={styles.legend}>
        <ul className={styles.keys} aria-label={t('legend')}>
          <li className={styles.key}>
            <span className={cx(styles.sample, styles.land)} aria-hidden="true" />
            {t('land')}
          </li>
          <li className={styles.key}>
            <span className={cx(styles.sample, styles.warehousing)} aria-hidden="true" />
            {t('warehousing')}
          </li>
        </ul>
        <p className={styles.note}>{t('schematic')}</p>
      </figcaption>
    </figure>
  );
}
