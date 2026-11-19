import { Ban, CircleCheck, Clock, HardHat, Truck, UserRound, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import type { Pass, PassKind } from '@/domain/types';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { Pill, type Tone } from '../Pill/Pill';
import styles from './PassCard.module.css';
import { strings } from './strings';

export type PassStatus = Pass['status'];

const KIND_ICON: Record<PassKind, LucideIcon> = { visitor: UserRound, contractor: HardHat, vehicle: Truck };

const STATUS: Record<PassStatus, { tone: Tone; icon: LucideIcon }> = {
  active: { tone: 'ok', icon: CircleCheck },
  expired: { tone: 'neutral', icon: Clock },
  revoked: { tone: 'bad', icon: Ban },
};

export interface PassCardProps {
  kind: PassKind;
  /** The person, or the driver of the vehicle. */
  holder: string;
  /** ID number for a person, plate for a vehicle. */
  idOrPlate?: string;
  /** The holder's company, for contractors. */
  company?: string;
  /** The zone's name. */
  zone: string;
  /** The plot number, e.g. "BA-117". */
  plot: string;
  /** Start and end of validity, already formatted. */
  validFrom: string;
  validTo: string;
  status: PassStatus;
  /** The pass code printed under the QR. */
  code?: string;
  /** The QR code the gate scans (pass the QR component). */
  qr?: ReactNode;
  className?: string;
}

/**
 * A gate pass, in the shape of a ticket: who, where, until when — and the code the gate scans.
 * The notches and the perforation are drawn with CSS only.
 */
export function PassCard({ kind, holder, idOrPlate, company, zone, plot, validFrom, validTo, status, code, qr, className }: PassCardProps) {
  const t = useT(strings);
  const titleId = useId();
  const state = STATUS[status];
  const valid = status === 'active';
  return (
    <article className={cx(styles.pass, !valid && styles.spent, className)} aria-labelledby={titleId} data-status={status}>
      <div className={styles.main}>
        <div className={styles.mainInner}>
          <header className={styles.head}>
            <span className={styles.tile} aria-hidden="true">
              <Icon icon={KIND_ICON[kind]} size={20} />
            </span>
            <p className={styles.kind}>{t(kind)}</p>
            <Pill tone={state.tone} icon={state.icon}>
              {t(status)}
            </Pill>
          </header>

          <div className={styles.who}>
            <p id={titleId} className={styles.holder}>
              {holder}
            </p>
            {company ? <p className={styles.company}>{company}</p> : null}
          </div>

          <dl className={styles.facts}>
            <div className={cx(styles.fact, styles.wide)}>
              <dt>{t('zone')}</dt>
              <dd>{zone}</dd>
            </div>
            <div className={cx(styles.fact, !idOrPlate && styles.wide)}>
              <dt>{t('plot')}</dt>
              <dd className="ltr num">{plot}</dd>
            </div>
            {idOrPlate ? (
              <div className={styles.fact}>
                <dt>{t(kind === 'vehicle' ? 'plate' : 'id')}</dt>
                <dd className="ltr num">{idOrPlate}</dd>
              </div>
            ) : null}
            <div className={styles.fact}>
              <dt>{t('validFrom')}</dt>
              <dd className="num">{validFrom}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{t('validTo')}</dt>
              <dd className="num">{validTo}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className={styles.stub}>
        <div className={styles.stubInner}>
          {qr ? <div className={styles.qr}>{qr}</div> : null}
          {code ? <p className={cx(styles.code, 'ltr')}>{code}</p> : null}
          <p className={styles.hint}>{t(valid ? 'showAtGate' : 'notValid')}</p>
        </div>
      </div>
    </article>
  );
}
