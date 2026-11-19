import { Award, BadgeCheck, ClipboardList, FileCheck, FilePenLine, FileSpreadsheet, FileText, Handshake, Receipt, Stamp, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import type { DocKind } from '@/domain/types';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { Row } from '../List/List';
import { Pill } from '../Pill/Pill';
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
  /** The document carries an electronic signature: shows the gold "موثّق" mark. */
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

/** The icon tile of a document kind. */
export function DocIcon({ kind, className }: { kind: DocKind; className?: string }) {
  return (
    <span className={cx(styles.tile, className)} aria-hidden="true">
      <Icon icon={KIND_ICON[kind]} size={20} />
    </span>
  );
}

/**
 * A document from the wallet. `row` is its line in a list; `paper` is the document itself: issuer,
 * title, facts, QR and verification code, a signature mark when signed — and a clear prototype line.
 */
export function DocCard(props: DocCardProps) {
  const t = useT(strings);
  const titleId = useId();
  const mark = props.signed ? (
    <Pill tone="gold" icon={BadgeCheck}>
      {t('verified')}
    </Pill>
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
        <div className={styles.verify}>
          {qr ? <div className={styles.qr}>{qr}</div> : null}
          <div className={styles.verifyWords}>
            <p className={styles.verifyLabel}>{t('verifyCode')}</p>
            <p className={cx(styles.code, 'ltr')}>{verifyCode}</p>
            <p className={styles.hint}>{t('verifyHint')}</p>
          </div>
        </div>
        {signed ? (
          <div className={styles.signature}>
            <SignatureMark />
            <p className={styles.signedBy}>{t('signed')}</p>
          </div>
        ) : null}
      </footer>

      <p className={styles.watermark}>{t('watermark')}</p>
    </article>
  );
}

/** A pen flourish: says "signed" without imitating anyone's signature. */
function SignatureMark() {
  return (
    <svg className={styles.flourish} viewBox="0 0 132 40" width="132" height="40" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 27c6-11 11-19 15-19 5 0-4 23 1 23 4 0 7-15 12-15 4 0-1 12 3 12 5 0 6-17 12-17 5 0 0 16 5 16 4 0 6-9 10-9 3 0 1 7 5 7 6 0 9-10 16-10 9 0 5 8 14 8 8 0 13-5 29-9" />
      <path d="M22 35c24-3 56-4 96-3" />
    </svg>
  );
}
