/**
 * Support (`#/account/support`): the Business Services Center. Three ways to reach people (an
 * appointment, WhatsApp, email), the investor's upcoming appointments with cancel, a way to make a
 * complaint or a suggestion, and five honest answers to common questions.
 */
import { CalendarDays, ChevronDown, MessageCircle, MessageSquareWarning, Mail, Phone, Video, Building2 } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Link } from '@/app/router';
import { zonesData } from '@/data/catalog';
import type { Appointment } from '@/domain/types';
import { Button, Card, Container, Grid, Icon, List, Render, Row, Screen, Section, Sheet, Tile, toast } from '@/design/core';
import { DemoPill, EmptyState } from '@/design/forms';
import { useNow } from '@/features/shared/useNow';
import { cancelAppointment } from '@/state/actions';
import { selectAppointments } from '@/state/selectors';
import { useApp } from '@/state/store';
import { supportStrings as strings } from './misc-strings';
import styles from './SupportScreen.module.css';

const CHANNEL_ICON = { in_person: Building2, video: Video, phone: Phone } as const;
const CHANNEL_LABEL = { in_person: 'inPerson', video: 'video', phone: 'phone' } as const;

/** A published phone number as a wa.me link: digits only, with the country code. */
export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

/** The appointments still ahead, soonest first. */
export function upcoming(appointments: readonly Appointment[], now: number): Appointment[] {
  return appointments.filter((a) => a.status === 'booked' && a.at >= now).sort((a, b) => a.at - b.at);
}

function contactOf(key: string): string | null {
  return zonesData.channels.find((channel) => channel.key === key)?.contact ?? null;
}

export function SupportScreen() {
  const t = useT(strings);
  const whatsapp = contactOf('whatsapp');
  const email = contactOf('bsc');

  return (
    <Screen title={t('title')} nav="back" backTo="/account" bleed>
      <Tile tone="light" eyebrow={t('eyebrow')} headline={t('headline')} tagline={t('tagline')} mediaWidth="small" media={<Render name="services" eager decorative />} />

      <Container width="content">
        <Section title={t('ways')}>
          <Grid as="ul" className={styles.ways}>
            <Way icon={CalendarDays} title={t('visitTitle')} line={t('visitLine')}>
              <Button to="/start/E1">{t('book')}</Button>
            </Way>
            {whatsapp ? (
              <Way icon={MessageCircle} title={t('whatsappTitle')} line={t('whatsappLine')}>
                <Contact value={whatsapp} kind="whatsapp" />
                <ExternalLink href={whatsappHref(whatsapp)}>{t('whatsappOpen')}</ExternalLink>
              </Way>
            ) : null}
            {email ? (
              <Way icon={Mail} title={t('emailTitle')} line={t('emailLine')}>
                <Contact value={email} kind="email" />
                <ExternalLink href={`mailto:${email}`}>{t('emailOpen')}</ExternalLink>
              </Way>
            ) : null}
          </Grid>
          <p className={styles.note}>
            <DemoPill kind="indicative" /> {t('indicativeNote')}
          </p>
        </Section>

        <Appointments />

        <Section title={t('feedback')}>
          <List>
            <Row leading={<Icon icon={MessageSquareWarning} />} title={t('feedbackRow')} subtitle={t('feedbackLine')} to="/start/E6" wrap />
          </List>
        </Section>

        <Faq />
      </Container>
    </Screen>
  );
}

function Way({ icon, title, line, children }: { icon: typeof Mail; title: string; line: string; children: ReactNode }) {
  return (
    <Card as="li" className={styles.way}>
      <Icon icon={icon} className={styles.wayIcon} />
      <h3 className={styles.wayTitle}>{title}</h3>
      <p className={styles.wayLine}>{line}</p>
      <div className={styles.wayAction}>{children}</div>
    </Card>
  );
}

/**
 * A published number or address as selectable text, with a quiet copy action beside it. Inside a frame or on a
 * computer without a mail or chat app the link may do nothing; the copy always leaves the investor with the contact.
 */
function Contact({ value, kind }: { value: string; kind: 'whatsapp' | 'email' }) {
  const t = useT(strings);
  const text = useRef<HTMLSpanElement>(null);
  const copy = () => {
    const selectIt = () => {
      const node = text.current;
      const selection = window.getSelection();
      if (!node || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
      toast(t('copySelected'));
    };
    if (!navigator.clipboard?.writeText) {
      selectIt();
      return;
    }
    navigator.clipboard.writeText(value).then(
      () => toast(t(kind === 'email' ? 'copiedEmail' : 'copiedNumber'), { tone: 'ok' }),
      selectIt,
    );
  };
  return (
    <span className={styles.contactLine}>
      <span ref={text} className={styles.contact} dir="ltr">
        {value}
      </span>
      <Button variant="quiet" size="sm" onClick={copy} aria-label={t(kind === 'email' ? 'copyEmail' : 'copyNumber')}>
        {t('copy')}
      </Button>
    </span>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const t = useT(strings);
  const external = href.startsWith('http');
  return (
    <a className={styles.link} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
      {external ? <span className="visually-hidden"> {t('opensOutside')}</span> : null}
    </a>
  );
}

function Appointments() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const now = useNow(30_000);
  const all = useApp(selectAppointments);
  const list = useMemo(() => upcoming(all, now), [all, now]);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const when = (a: Appointment) => `${fmt.date(a.at)} · ${fmt.time(a.at)}`;

  const confirm = () => {
    if (!cancelling) return;
    cancelAppointment(cancelling.id);
    setCancelling(null);
    toast(t('cancelled'), { tone: 'ok' });
  };

  return (
    <Section title={t('appointments')}>
      {list.length === 0 ? (
        <Card>
          <EmptyState compact level={3} icon={CalendarDays} title={t('noAppointments')} body={t('noAppointmentsBody')} />
        </Card>
      ) : (
        <List>
          {list.map((a) => (
            <Row
              key={a.id}
              leading={<Icon icon={CHANNEL_ICON[a.channel]} />}
              title={pick(a.topic)}
              subtitle={`${when(a)} · ${t(CHANNEL_LABEL[a.channel])}`}
              wrap
              trailing={
                <Button variant="quiet" tone="danger" size="sm" onClick={() => setCancelling(a)} aria-label={t('cancelLabel', { topic: pick(a.topic) })}>
                  {t('cancel')}
                </Button>
              }
            />
          ))}
        </List>
      )}
      <Sheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t('cancelTitle')}
        footer={
          <div className={styles.sheetActions}>
            <Button block tone="danger" onClick={confirm}>
              {t('cancelConfirm')}
            </Button>
            <Button block variant="quiet" onClick={() => setCancelling(null)}>
              {t('keep')}
            </Button>
          </div>
        }
      >
        {cancelling ? (
          <p className={styles.sheetBody}>
            <strong>{pick(cancelling.topic)}</strong>
            <br />
            {t('cancelBody', { when: when(cancelling) })}
          </p>
        ) : null}
      </Sheet>
    </Section>
  );
}

const QUESTIONS = ['1', '2', '3', '4', '5'] as const;

function Faq() {
  const t = useT(strings);
  return (
    <Section title={t('faq')}>
      <Card pad="none" className={styles.faq}>
        {QUESTIONS.map((n) => (
          <details key={n} className={styles.qa}>
            <summary className={styles.question}>
              <span>{t(`q${n}`)}</span>
              <Icon icon={ChevronDown} size={18} className={styles.chevron} />
            </summary>
            <div className={styles.answer}>
              <p>{t(`a${n}`)}</p>
              {n === '4' ? (
                <Link to="/account/team" className={styles.link}>
                  {t('q4Link')}
                </Link>
              ) : null}
            </div>
          </details>
        ))}
      </Card>
    </Section>
  );
}
