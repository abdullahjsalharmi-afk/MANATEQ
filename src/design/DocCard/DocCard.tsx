import { Award, BadgeCheck, ClipboardList, FileCheck, FilePenLine, FileSpreadsheet, FileText, Handshake, Receipt, Stamp, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import type { DocKind } from '@/domain/types';
import { cx } from '../cx';
import { Card } from '../Card/Card';
import { Icon } from '../Icon/Icon';
import { Row } from '../List/List';
import { keepWhole } from '../List/keepWhole';
import styles from './DocCard.module.css';
import { strings } from './strings';

const KIND_ICON: Record<DocKind, LucideIcon> = {
  contract: FilePenLine,
  offer: Handshake,
  noc: FileCheck,
  permit: Stamp,
  certificate: Award,
  receipt: Receipt,
  statement: FileSpreadsheet,
  letter: FileText,
  report: ClipboardList,
};

interface DocCardBase {
  kind: DocKind;
  title: string;
  /** The document's reference number, e.g. "MQ-LC-2611-0042". */
  reference: string;
  /** The issue date, already formatted. */
  date: string;
  /** The document carries an electronic signature: shows the small gold "موثّق" check-seal. */
  signed?: boolean;
  className?: string;
}

export interface DocRowProps extends DocCardBase {
  /** One line of a document list. Renders a list row: place it inside `<List>`. */
  variant?: 'row';
  /** The route of the document viewer. */
  to?: string;
  onClick?: () => void;
}

export interface DocTileProps extends DocCardBase {
  /**
   * The document as a compact card for the wallet's card grid (put it in `<Grid as="ul">`): the kind glyph, the
   * title in 17/600 on up to two lines, reference · date in 14 px, the gold check-seal when signed.
   */
  variant: 'card';
  /** The route of the document viewer. */
  to: string;
  /** Render as a list item (inside `<Grid as="ul">`). Default true. */
  asItem?: boolean;
}

export interface DocLineItem {
  label: string;
  value: string;
}

export interface DocPaperProps extends DocCardBase {
  /** The document itself, on a sheet of paper. */
  variant: 'paper';
  /** Who issued it, e.g. "مناطق". */
  issuer: string;
  /** The facts the document states. */
  lines: DocLineItem[];
  /** The code a third party types or scans to verify the document. */
  verifyCode: string;
  /** The QR code that encodes the verification link (pass the QR component). */
  qr?: ReactNode;
  /** Heading level of the title. Default 2. */
  level?: 2 | 3;
}

export type DocCardProps = DocRowProps | DocTileProps | DocPaperProps;

/** The leading glyph of a document kind: a plain line icon, never inside a tinted shape. */
export function DocIcon({ kind, className }: { kind: DocKind; className?: string }) {
  return (
    <span className={cx(styles.tile, className)} aria-hidden="true">
      <Icon icon={KIND_ICON[kind]} size={22} strokeWidth={1.5} />
    </span>
  );
}

/**
 * A document from the wallet. `row` is its line in a list; `card` its compact card in the wallet's grid;
 * `paper` is the document itself on a white
 * sheet: issuer, title, facts, the verification code with its QR at the inline end, the check-seal when
 * signed, and a clear prototype line.
 */
export function DocCard(props: DocCardProps) {
  const t = useT(strings);
  const titleId = useId();
  const mark = props.signed ? (
    <span className={styles.seal}>
      <Icon icon={BadgeCheck} size={16} strokeWidth={1.75} />
      <span>{t('verified')}</span>
    </span>
  ) : null;

  if (props.variant === 'card') {
    const { kind, title, reference, date, to, asItem = true, className } = props;
    return (
      <Card as={asItem ? 'li' : 'div'} to={to} pad="sm" className={cx(styles.card, className)}>
        <span className={styles.cardHead}>
          <DocIcon kind={kind} />
          {mark}
        </span>
        <span className={styles.cardTitle}>{keepWhole(title)}</span>
        <span className={styles.cardMeta}>
          <span className={cx('ltr num', styles.whole)}>{reference}</span>
          <span aria-hidden="true"> · </span>
          <span className={cx('num', styles.whole)}>{date}</span>
        </span>
      </Card>
    );
  }

  if (props.variant !== 'paper') {
    const { kind, title, reference, date, to, onClick, className } = props;
    return (
      <Row
        className={className}
        leading={<DocIcon kind={kind} />}
        title={
          <span className={styles.rowTitle}>
            <span>{keepWhole(title)}</span> {mark}
          </span>
        }
        wrap
        subtitle={
          <>
            <span className={cx('ltr num', styles.whole)}>{reference}</span>
            <span aria-hidden="true"> · </span>
            <span className={cx('num', styles.whole)}>{date}</span>
          </>
        }
        to={to}
        onClick={onClick}
        chevron={to !== undefined || onClick !== undefined}
      />
    );
  }

  const { kind, title, reference, date, issuer, lines, verifyCode, qr, signed, level = 2, className } = props;
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <article className={cx(styles.paper, className)} aria-labelledby={titleId}>
      <header className={styles.head}>
        <div className={styles.issuer}>
          <p className={styles.issuerName}>{issuer}</p>
          <p className={styles.kind}>{t(kind)}</p>
        </div>
        {mark}
      </header>

      <Heading id={titleId} className={styles.title}>
        {keepWhole(title)}
      </Heading>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('reference')}</dt>
          <dd className="ltr num">{reference}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('issued')}</dt>
          <dd className={cx('num', styles.whole)}>{date}</dd>
        </div>
      </dl>

      {lines.length > 0 ? (
        <dl className={styles.lines}>
          {lines.map((line, index) => (
            <div key={index} className={styles.line}>
              <dt>{line.label}</dt>
              <dd>{keepWhole(line.value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <footer className={styles.foot}>
        <div className={styles.verifyWords}>
          <p className={styles.verifyLabel}>{t('verifyCode')}</p>
          <p className={cx(styles.code, 'ltr')}>{verifyCode}</p>
          <p className={styles.hint}>{t('verifyHint')}</p>
          {signed ? (
            <p className={styles.signedBy}>
              <Icon icon={BadgeCheck} size={14} strokeWidth={1.75} />
              <span>{t('signed')}</span>
            </p>
          ) : null}
        </div>
        {qr ? <div className={styles.qr}>{qr}</div> : null}
      </footer>

      <p className={styles.watermark}>{t('watermark')}</p>
    </article>
  );
}
