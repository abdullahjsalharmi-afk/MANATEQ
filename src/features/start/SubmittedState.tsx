import { CalendarCheck, CircleCheck, Copy } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { getService, peekServiceDetail, requestLabelOf } from '@/data/catalog';
import { Button, Card, Container, Icon, List, Row, Screen, Section, Tile, toast } from '@/design/core';
import { Skeleton } from '@/design/forms';
import { Timeline } from '@/design/signature';
import { requestView, selectAppointments, selectRequest, selectSpeed, timelineRows, useApp, type RequestView, type TimelineEntry } from '@/state';
import type { Appointment } from '@/domain/types';
import { useCatalogueReady } from '@/state/catalogue';
import { useNow } from '@/features/shared/useNow';
import styles from './Start.module.css';
import { strings } from './strings';

/**
 * A step a person or an authority takes, as the state layer's `RequestView.focus` reads it: not a decision,
 * not a step Manateq's own systems run by themselves in a moment, and not the end of the road.
 */
function isPersonStep(entry: TimelineEntry): boolean {
  if (entry.kind === 'gate' || entry.kind === 'stop' || entry.kind === 'end') return false;
  return !(entry.kind === 'auto' && entry.lane !== 'nat');
}

/**
 * The workflow steps the confirmation lists: the request's focus, then the person steps after it on the
 * usual path, at most `count`. Empty when nothing a person does is left (the request completes by itself).
 */
export function nextPersonSteps(view: Pick<RequestView, 'focus' | 'timeline'>, count: number): number[] {
  const focus = view.focus?.step.id;
  const from = focus === undefined ? -1 : view.timeline.findIndex((entry) => entry.step === focus && entry.state !== 'done');
  if (from < 0) return [];
  return [...new Set(view.timeline.slice(from).filter(isPersonStep).map((entry) => entry.step))].slice(0, count);
}

/** The appointment booked with a request (E1 with «أريد حجز موعد»), when it is still booked. */
export function appointmentOf(appointments: readonly Appointment[], requestId: string): Appointment | undefined {
  return appointments.find((appointment) => appointment.requestId === requestId && appointment.status === 'booked');
}

const CHANNEL: Record<Appointment['channel'], 'channelInPerson' | 'channelVideo' | 'channelPhone'> = {
  in_person: 'channelInPerson',
  video: 'channelVideo',
  phone: 'channelPhone',
};

export interface SubmittedStateProps {
  /** The request just started (`startRequest` → id). */
  requestId: string;
  /** How many of the next steps to show. Default 3. */
  steps?: number;
  /** The headline of the tile. Default «تم استلام طلبك». */
  headline?: string;
  /** The line under it. Default: the request's name (`requestLabelOf`). */
  tagline?: string;
}

/**
 * "تم الاستلام": the confirmation every flow ends on. A white tile with the accent check, the reference in a
 * pearl capsule (tap to copy), the next steps of the real workflow with who holds them, and "تتبّع الطلب".
 */
export function SubmittedState({ requestId, steps = 3, headline, tagline }: SubmittedStateProps) {
  const t = useT(strings);
  const lang = useLang();
  const { pick } = lang;
  const request = useApp(useMemo(() => selectRequest(requestId), [requestId]));
  const speed = useApp(selectSpeed);
  const appointment = appointmentOf(useApp(selectAppointments), requestId);
  // Re-renders when the workflows arrive, so the next steps can be read.
  const ready = useCatalogueReady();
  const now = useNow(1000);
  const summary = request ? getService(request.serviceId) : undefined;
  const detail = request ? peekServiceDetail(request.serviceId) : undefined;

  // The steps shown are fixed when the screen opens: the request's focus (the next step a person or an
  // authority takes) and the person steps after it. As the demo clock moves they turn current and done in
  // place, instead of sliding away. Each is kept by its workflow step, since a step's entry id changes once
  // the request reaches it.
  const chosen = useRef<number[] | null>(null);
  const next = useMemo(() => {
    if (!request || !detail) return null;
    const view = requestView(request, detail, now, speed);
    if (chosen.current === null) chosen.current = nextPersonSteps(view, steps);
    const latest = (step: number) => view.timeline.findLast((entry) => entry.step === step);
    const entries = chosen.current.map(latest).filter((entry): entry is TimelineEntry => entry !== undefined);
    // Each step keeps the book's own title, says who holds it and its own expected time ("فوري", "يوما عمل")
    // rather than a clock time. The long workflow sentence and the full timeline belong to the request page.
    return timelineRows(entries, lang, now).map((row) => {
      const brief = { ...row };
      delete brief.text;
      delete brief.time;
      return brief;
    });
  }, [request, detail, now, speed, steps, lang, ready]);
  const allDone = Boolean(next?.length) && next!.every((row) => row.state === 'done');

  const track = () => navigate(`/requests/${requestId}`, { replace: true });
  const ref = request?.ref ?? '';
  const copy = () => {
    const done = () => toast(t('copied'), { tone: 'ok' });
    try {
      void navigator.clipboard?.writeText(ref).then(done, () => undefined);
    } catch {
      /* Copying is a convenience; the number stays on screen. */
    }
  };

  return (
    <Screen
      title={t('submittedName')}
      nav="close"
      onNav={() => navigate('/', { replace: true })}
      bleed
      footer={
        <Button block onClick={track}>
          {t('track')}
        </Button>
      }
    >
      <Tile
        tone="light"
        lead={<Icon icon={CircleCheck} size={44} strokeWidth={1.5} className={styles.check} />}
        headline={headline ?? t('submittedHeadline')}
        tagline={tagline ?? (summary ? pick(requestLabelOf(summary)) : undefined)}
      >
        {ref ? (
          <div className={styles.refBlock}>
            <p className={styles.refLabel}>
              {t('reference')}
            </p>
            <Button variant="pearl" icon={Copy} onClick={copy} aria-label={t('copyReference', { ref })}>
              <span className="ltr">{ref}</span>
            </Button>
          </div>
        ) : null}
      </Tile>
      <Container width="form">
        {appointment ? (
          <Section title={t('appointmentTitle')}>
            <List aria-label={t('appointmentTitle')}>
              <Row
                leading={<Icon icon={CalendarCheck} size={20} />}
                title={t('appointmentWhen', { date: lang.fmt.date(appointment.at), time: lang.fmt.time(appointment.at) })}
                subtitle={t('appointmentWhere', { channel: t(CHANNEL[appointment.channel]) })}
                wrap
              />
            </List>
            <div className={styles.homeLink}>
              <Button variant="quiet" to="/account/support">
                {t('appointmentOpen')}
              </Button>
            </div>
          </Section>
        ) : null}
        <Section title={allDone ? t('whatDone') : t('whatNext')} hint={next?.length === 0 ? undefined : t('whatNextHint')}>
          <Card>
            {!next ? (
              <Skeleton variant="row" count={3} label={t('loading')} />
            ) : next.length ? (
              <Timeline items={next} label={t('nextLabel')} />
            ) : (
              <p className={styles.byItself}>{t('byItself')}</p>
            )}
          </Card>
          <p className={styles.fine}>{t('simulated')}</p>
          <div className={styles.homeLink}>
            <Button variant="quiet" to="/">
              {t('goHome')}
            </Button>
          </div>
        </Section>
      </Container>
    </Screen>
  );
}
