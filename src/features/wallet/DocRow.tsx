import { Ban, BadgeCheck, CircleCheck, Clock, HardHat, Truck, UserRound, type LucideIcon } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { Card, Icon, Pill, Row, type Tone } from '@/design/core';
import { DocIcon } from '@/design/signature';
import type { Doc, Pass, PassKind } from '@/domain/types';
import { holderName, passValidity, unbroken, type PassValidity } from './logic';
import { strings } from './strings';
import { Atom, CodedText } from './Unbroken';
import styles from './Wallet.module.css';

/** The small gold check-seal «موثّق» of a signed document. */
export function Seal() {
  const t = useT(strings);
  return (
    <span className={styles.seal}>
      <Icon icon={BadgeCheck} size={16} strokeWidth={1.75} />
      <span>{t('verified')}</span>
    </span>
  );
}

/** Reference · date of a document, each kept whole. */
function DocMeta({ doc }: { doc: Doc }) {
  const { fmt } = useLang();
  return (
    <>
      <Atom code>{doc.ref}</Atom>
      <span aria-hidden="true"> ·{'\u00A0'}</span>
      <Atom>{fmt.date(doc.issuedAt)}</Atom>
    </>
  );
}

/** One document in a list: kind glyph, title, reference · date, the gold check when signed. Links to the viewer. */
export function DocRow({ doc }: { doc: Doc }) {
  const { pick } = useLang();
  return (
    <Row
      leading={<DocIcon kind={doc.kind} />}
      title={
        <span className={styles.rowTitle}>
          <span>
            <CodedText text={pick(doc.title)} />
          </span>
          {doc.signed ? <Seal /> : null}
        </span>
      }
      subtitle={<DocMeta doc={doc} />}
      to={`/account/wallet/${doc.id}`}
      wrap
    />
  );
}

/** One document in the wallet's grid: kind glyph and seal, title on up to two lines, reference · date. */
export function DocTile({ doc }: { doc: Doc }) {
  const { pick } = useLang();
  return (
    <Card as="li" to={`/account/wallet/${doc.id}`} className={styles.docTile}>
      <span className={styles.docTileHead}>
        <DocIcon kind={doc.kind} />
        {doc.signed ? <Seal /> : null}
      </span>
      <span className={styles.docTileTitle}>
        <CodedText text={pick(doc.title)} />
      </span>
      <span className={styles.docTileMeta}>
        <DocMeta doc={doc} />
      </span>
    </Card>
  );
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
          date: validity.until - now < 2 * DAY ? `${unbroken(fmt.dayMonth(validity.until))}${lang === 'ar' ? '، ' : ', '}${unbroken(fmt.time(validity.until))}` : unbroken(fmt.date(validity.until)),
        })
      : validity.state === 'upcoming'
        ? t('startsOn', { date: unbroken(fmt.date(validity.from)) })
        : validity.state === 'expired'
          ? t('ended', { date: unbroken(fmt.date(validity.at)) })
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
    <Card as="li" to={`/account/wallet/${pass.id}`} className={styles.docTile}>
      <span className={styles.docTileHead}>
        <Icon icon={PASS_ICON[pass.kind]} size={22} strokeWidth={1.5} className={styles.passGlyph} />
        <Pill tone={pill.tone} icon={pill.icon}>
          {pill.label}
        </Pill>
      </span>
      <span className={styles.docTileTitle}>{holderName(pass.holder, lang)}</span>
      <span className={styles.docTileMeta}>
        {t(pass.kind)}
        <span aria-hidden="true"> ·{'\u00A0'}</span>
        <span className="num">{text}</span>
      </span>
    </Card>
  );
}
