import { Ban, CircleCheck, Clock, HardHat, Truck, UserRound, type LucideIcon } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { Card, Icon, Pill, Row, type Tone } from '@/design/core';
import { DocCard } from '@/design/signature';
import type { Doc, Pass, PassKind } from '@/domain/types';
import { holderName, passValidity, unbroken, type PassValidity } from './logic';
import { strings } from './strings';
import styles from './Wallet.module.css';

/** The facts every document card shows, in the reading language. */
function useDocProps(doc: Doc) {
  const { pick, fmt } = useLang();
  return { kind: doc.kind, title: pick(doc.title), reference: doc.ref, date: fmt.date(doc.issuedAt), signed: doc.signed, to: `/account/wallet/${doc.id}` };
}

/** One document in a list: kind glyph, title, reference · date, the gold check when signed. Links to the viewer. */
export function DocRow({ doc }: { doc: Doc }) {
  return <DocCard {...useDocProps(doc)} />;
}

/** One document in the wallet's grid: kind glyph and seal, title on up to two lines, reference · date. */
export function DocTile({ doc }: { doc: Doc }) {
  return <DocCard variant="card" {...useDocProps(doc)} />;
}

const DAY = 86_400_000;

export const PASS_ICON: Record<PassKind, LucideIcon> = { visitor: UserRound, worker: HardHat, vehicle: Truck };

const VALIDITY_PILL: Record<PassValidity['state'], { tone: Tone; icon: LucideIcon; key: 'stValid' | 'stUpcoming' | 'stExpired' | 'stRevoked' }> = {
  valid: { tone: 'ok', icon: CircleCheck, key: 'stValid' },
  upcoming: { tone: 'info', icon: Clock, key: 'stUpcoming' },
  expired: { tone: 'neutral', icon: Clock, key: 'stExpired' },
  revoked: { tone: 'bad', icon: Ban, key: 'stRevoked' },
};

/** The one line that says whether a pass can be used, and until when. */
export function useValidityLine(pass: Pass, now: number): { text: string; pill: (typeof VALIDITY_PILL)[PassValidity['state']] & { label: string } } {
  const t = useT(strings);
  const { lang, fmt } = useLang();
  const validity = passValidity(pass, now);
  const pill = VALIDITY_PILL[validity.state];
  const text =
    validity.state === 'valid'
      ? t('validUntil', {
          // A day pass ends at an hour; a longer one on a date.
          date: validity.until - now < 2 * DAY ? `${fmt.dayMonth(validity.until)}${lang === 'ar' ? '، ' : ', '}${unbroken(fmt.time(validity.until))}` : fmt.date(validity.until),
        })
      : validity.state === 'upcoming'
        ? t('startsOn', { date: fmt.date(validity.from) })
        : validity.state === 'expired'
          ? t('ended', { date: fmt.date(validity.at) })
          : t('revokedOn');
  return { text, pill: { ...pill, label: t(pill.key) } };
}

/** One gate pass in a list: holder, kind, validity and status. Links to the pass viewer. */
export function PassRow({ pass, now }: { pass: Pass; now: number }) {
  const t = useT(strings);
  const { lang } = useLang();
  const { text, pill } = useValidityLine(pass, now);
  return (
    <Row
      to={`/account/wallet/${pass.id}`}
      leading={<Icon icon={PASS_ICON[pass.kind]} size={22} />}
      title={holderName(pass.holder, lang)}
      subtitle={
        <>
          {t(pass.kind)}
          <span aria-hidden="true"> ·{'\u00A0'}</span>
          <span className="num">{text}</span>
        </>
      }
      trailing={
        <Pill tone={pill.tone} icon={pill.icon}>
          {pill.label}
        </Pill>
      }
      wrap
    />
  );
}

/** One gate pass in the wallet's grid: kind glyph and status, holder, kind · validity. */
export function PassTile({ pass, now }: { pass: Pass; now: number }) {
  const t = useT(strings);
  const { lang } = useLang();
  const { text, pill } = useValidityLine(pass, now);
  return (
    <Card as="li" to={`/account/wallet/${pass.id}`} className={styles.passTile}>
      <span className={styles.passTileHead}>
        <Icon icon={PASS_ICON[pass.kind]} size={22} strokeWidth={1.5} className={styles.passGlyph} />
        <Pill tone={pill.tone} icon={pill.icon}>
          {pill.label}
        </Pill>
      </span>
      <span className={styles.passTileTitle}>{holderName(pass.holder, lang)}</span>
      <span className={styles.passTileMeta}>
        {t(pass.kind)}
        <span aria-hidden="true"> ·{'\u00A0'}</span>
        <span className="num">{text}</span>
      </span>
    </Card>
  );
}
