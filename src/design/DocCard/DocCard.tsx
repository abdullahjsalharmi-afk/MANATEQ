import { Award, BadgeCheck, ClipboardList, FileCheck, FilePenLine, FileSpreadsheet, FileText, Handshake, Receipt, Stamp, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import type { DocKind } from '@/domain/types';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { Row } from '../List/List';
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

export type DocCardProps = DocRowProps | DocPaperProps;

/** The leading glyph of a document kind: a plain line icon, never inside a tinted shape. */
export function DocIcon({ kind, className }: { kind: DocKind; className?: string }) {
  return (
    <span className={cx(styles.tile, className)} aria-hidden="true">
      <Icon icon={KIND_ICON[kind]} size={22} strokeWidth={1.5} />
    </span>
  );
}

/**
 * A document from the wallet. `row` is its line in a list; `paper` is the document itself on a white
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

  if (props.variant !== 'paper') {
    const { kind, title, reference, date, to, onClick, className } = props;
    return (
      <Row
        className={className}
        leading={<DocIcon kind={kind} />}
        title={
          <span className={styles.rowTitle}>
            <span>{title}</span> {mark}
          </span>
        }
        wrap
        subtitle={
          <>
            <span className="ltr num">{reference}</span>
            <span aria-hidden="true"> · </span>
            <span className="num">{date}</span>
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
        {title}
      </Heading>

      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t('reference')}</dt>
          <dd className="ltr num">{reference}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t('issued')}</dt>
          <dd className="num">{date}</dd>
        </div>
      </dl>

      {lines.length > 0 ? (
        <dl className={styles.lines}>
          {lines.map((line, index) => (
            <div key={index} className={styles.line}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
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
