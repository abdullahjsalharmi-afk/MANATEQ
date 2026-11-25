import { Check, Copy, SearchX, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import type { ServiceDetail } from '@/data/types';
import { Button, Card, Container, EmptyState, List, Pill, Screen, Section, Sheet, Skeleton, Tile, toast } from '@/design/core';
import { Timeline } from '@/design/signature';
import type { RequestState } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { useService } from '@/features/shared/useService';
import { DocRow } from '@/features/wallet';
import { cancelRequest, fastForwardRequest, selectDeadline, selectDocsOfRequest, selectRequest, selectThread, timelineRows, useApp, type RequestView } from '@/state';
import { ActionRunner } from './ActionRunner';
import { RequestRing } from './RequestRing';
import { RequestRow } from './RequestRow';
import styles from './RequestScreen.module.css';
import { strings, workingDays } from './strings';
import { useHolderWords, useRequestView } from './useRequestFacts';

const HOUR = 3_600_000;

/** One request as an order-status page: who has it now, the standard clock, what to do, how it moves. */
export function RequestScreen() {
  const t = useT(strings);
  const { pick } = useLang();
  const { id } = useParams<{ id: string }>();
  const request = useApp(selectRequest(id));
  const { summary, detail, failed } = useService(request?.serviceId);
  const title = summary ? pick(summary.label) : t('requestFallback');

  if (!request) {
    return (
      <Screen title={t('requestFallback')} nav="back" backTo="/requests">
        <EmptyState
          icon={SearchX}
          title={t('notFoundTitle')}
          body={t('notFoundBody')}
          action={
            <Button variant="secondary" to="/requests">
              {t('back')}
            </Button>
          }
        />
      </Screen>
    );
  }

  if (!detail) {
    return (
      <Screen title={title} nav="back" backTo="/requests">
        {failed ? (
          <EmptyState
            icon={TriangleAlert}
            title={t('failedTitle')}
            body={t('failedBody')}
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                {t('retry')}
              </Button>
            }
          />
        ) : (
          <div className={styles.loading} aria-busy="true">
            <Skeleton variant="block" height={220} label={t('loading')} />
            <Skeleton variant="block" height={120} />
            <Skeleton variant="row" count={4} />
          </div>
        )}
      </Screen>
    );
  }

  return <RequestPage request={request} service={detail} title={title} />;
}

function RequestPage({ request, service, title }: { request: RequestState; service: ServiceDetail; title: string }) {
  const t = useT(strings);
  const lang = useLang();
  const { pick, fmt } = lang;
  const now = useNow();
  const view = useRequestView(request, now, service) as RequestView;
  const docs = useApp(selectDocsOfRequest(request.id));
  const thread = useApp(selectThread(request.id));
  const deadline = useApp(selectDeadline(request.id));
  const [running, setRunning] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const announcement = useLiveAnnouncement(request, view);

  const related = thread.filter((other) => other.id !== request.id);
  // The tile above already tells what the current step is about: the timeline keeps it to its title.
  const rows = timelineRows(view.timeline, lang, now).map((row) => (row.state === 'current' && view.holder?.lane !== 'inv' ? { ...row, text: undefined } : row));
  const action = view.pendingAction;
  const open = request.status === 'active' || request.status === 'needs_you';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(request.ref);
      toast(t('copied'), { tone: 'ok' });
    } catch {
      toast(request.ref, { tone: 'info' });
    }
  };

  return (
    <Screen title={title} nav="back" backTo="/requests" bleed>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>

      <HolderTile request={request} view={view} service={service} now={now} copy={copy} deadline={deadline} />

      <Container className={styles.body}>
        <div className={styles.columns}>
          <div className={styles.main}>
            {action ? (
              <div className={styles.partAction}>
                <Card className={styles.action} aria-labelledby="request-action-title">
                  <p className={`type-callout ${styles.eyebrow}`}>{t('actionEyebrow')}</p>
                  <h2 id="request-action-title" className="type-heading">
                    {pick(action.title)}
                  </h2>
                  <p className={styles.text}>{pick(action.detail)}</p>
                  <div className={styles.actionCta}>
                    <Button onClick={() => setRunning(true)}>{pick(action.cta)}</Button>
                  </div>
                </Card>
              </div>
            ) : null}

            <div className={styles.partTimeline}>
              <Section title={t('timeline')}>
                <Card>
                  <Timeline items={rows} collapsedCount={2} label={t('timelineLabel')} />
                </Card>
              </Section>
            </div>
          </div>

          <div className={styles.aside}>
            <div className={styles.partClock}>
              <ClockCard request={request} view={view} service={service} />
            </div>

            {docs.length ? (
              <div className={styles.partDocs}>
                <Section title={t('docs')}>
                  <List>
                    {docs.map((doc) => (
                      <DocRow key={doc.id} doc={doc} />
                    ))}
                  </List>
                </Section>
              </div>
            ) : null}

            {related.length ? (
              <div className={styles.partRelated}>
                <Section title={t('related')}>
                  <List>
                    {[...related].reverse().map((other) => (
                      <RequestRow key={other.id} request={other} now={now} />
                    ))}
                  </List>
                </Section>
              </div>
            ) : null}
          </div>
        </div>

        <footer className={styles.demo} aria-label={t('demo')}>
          <p className={`type-foot ${styles.quiet}`}>{t('demoNote')}</p>
          {open ? (
            <div className={styles.demoActions}>
              {request.status === 'active' ? (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    fastForwardRequest(request.id);
                    toast(t('fastForwarded'), { tone: 'info' });
                  }}
                >
                  {t('fastForward')}
                </Button>
              ) : null}
              <Button variant="quiet" tone="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                {t('cancel')}
              </Button>
            </div>
          ) : null}
        </footer>
      </Container>

      {action ? <ActionRunner request={request} service={service} action={action} open={running} onClose={() => setRunning(false)} {...(deadline ? { deadline } : {})} /> : null}

      <Sheet
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t('cancelTitle')}
        closeLabel={t('close')}
        footer={
          <div className={styles.sheetFooter}>
            <Button
              block
              variant="danger"
              onClick={() => {
                cancelRequest(request.id);
                setConfirmCancel(false);
                toast(t('cancelled'), { tone: 'info' });
              }}
            >
              {t('cancelConfirm')}
            </Button>
            <Button variant="quiet" onClick={() => setConfirmCancel(false)}>
              {t('keep')}
            </Button>
          </div>
        }
      >
        <p className={styles.text}>{t('cancelBody')}</p>
      </Sheet>
    </Screen>
  );
}

/** Says politely when the request moves to another step or ends, while the page is open. */
function useLiveAnnouncement(request: RequestState, view: RequestView): string {
  const t = useT(strings);
  const { pick } = useLang();
  const key = `${request.current ?? 'end'}:${request.status}`;
  const previous = useRef(key);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (request.status === 'done') setMessage(t('completedLive'));
    else if (view.currentStep) setMessage(t('moved', { step: pick(view.currentStep.label) }));
  }, [key, request.status, view.currentStep, t, pick]);
  return message;
}

interface HolderTileProps {
  request: RequestState;
  view: RequestView;
  service: ServiceDetail;
  now: number;
  deadline: number | undefined;
  copy: () => void;
}

/** "Who has it now?": the holder as the headline, what is happening in one sentence, and when to expect it. */
function HolderTile({ request, view, now, deadline, copy }: HolderTileProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const words = useHolderWords();
  const finished = request.status === 'done' || request.status === 'stopped';
  const step = view.currentStep;

  let eyebrow: string;
  let headline: string;
  let tagline: string | undefined;
  let body: string | undefined;
  let meta: string | undefined;

  if (finished) {
    eyebrow = t('status');
    headline = request.status === 'done' ? t('finished') : t('stopped');
    tagline = t('finishedOn', { date: fmt.date(view.finishedAt ?? request.updatedAt) });
    const lastDone = [...view.timeline].reverse().find((entry) => entry.state === 'done');
    body = lastDone ? pick(lastDone.title) : undefined;
  } else {
    const holder = view.holder;
    eyebrow = holder && holder.lane !== 'inv' && holder.lane !== 'eng' ? t('nowWith') : t('now');
    headline = holder ? words.headline(holder) : t('statusActive');
    tagline = step ? pick(step.label) : undefined;
    // With the investor, the action card below says what to do: the tile stays short.
    body = step && holder?.lane !== 'inv' ? pick(step.text) : undefined;
    const platform = holder?.lane === 'nat' ? pick(holder.name) : '';
    if (platform && platform !== headline) body = body ? `${platform}: ${body}` : platform;
    if (holder?.lane === 'inv') {
      meta = deadline ? t('actBy', { date: fmt.date(deadline) }) : view.heldSince ? t('waitingSince', { date: fmt.dayMonth(view.heldSince) }) : undefined;
    } else if (view.expectedAt !== undefined && view.expectedAt - now > HOUR) {
      meta = t('expected', { when: fmt.relative(view.expectedAt, now) });
    } else if (step && pick(step.std)) {
      meta = t('stepStandard', { std: pick(step.std) });
    }
  }

  return (
    <Tile
      tone="light"
      className={styles.tile}
      lead={
        <div className={styles.meta}>
          <StatusPill request={request} />
          <Button variant="pearl" size="sm" icon={Copy} onClick={copy} aria-label={t('copyRef', { ref: request.ref })}>
            <span className="ltr">{request.ref}</span>
          </Button>
        </div>
      }
      eyebrow={eyebrow}
      headline={headline}
      tagline={tagline}
    >
      {body || meta ? (
        <div className={styles.tileText}>
          {body && body !== tagline ? <p className={styles.text}>{body}</p> : null}
          {meta ? <p className={`type-callout ${styles.quiet}`}>{meta}</p> : null}
        </div>
      ) : null}
    </Tile>
  );
}

function StatusPill({ request }: { request: RequestState }) {
  const t = useT(strings);
  switch (request.status) {
    case 'needs_you':
      return <Pill tone="accent">{t('needsYou')}</Pill>;
    case 'done':
      return (
        <Pill tone="ok" icon={Check}>
          {t('statusDone')}
        </Pill>
      );
    case 'stopped':
      return <Pill tone="neutral">{t('statusStopped')}</Pill>;
    default:
      return <Pill tone="neutral">{t('statusActive')}</Pill>;
  }
}

/** The service-standard clock: the ring, the day of the standard, the published standard and why the clock pauses. */
function ClockCard({ request, view, service }: { request: RequestState; view: RequestView; service: ServiceDetail }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const { clock } = view;
  const done = request.status === 'done';
  const target = clock.ratio !== null ? clock.targetDays : null;

  // A standard with no duration in days has no clock to show: its words are the standard.
  if (target === null) {
    return (
      <Section title={t('clockTitle')}>
        <Card className={styles.clockPlain}>
          <p className={styles.text}>{pick(service.standard)}</p>
          <Pill tone="neutral">{t('indicative')}</Pill>
        </Card>
      </Section>
    );
  }

  const figure = done ? t('clockDone', { n: fmt.plural(Math.max(1, Math.ceil(clock.usedDays)), workingDays) }) : t('clockDay', { n: fmt.num(clock.dayNumber) });
  const of = t('clockOf', { m: fmt.plural(target, workingDays) });

  return (
    <Section title={t('clockTitle')}>
      <Card className={styles.clock}>
        <RequestRing request={request} view={view} size="lg" />
        <div className={styles.clockText}>
          <p className={styles.figure}>
            <strong>{figure}</strong> <span className={styles.unit}>{of}</span>
          </p>
          <p className={`type-callout ${styles.standard}`}>{pick(service.standard)}</p>
          <Pill tone="neutral">{t('indicative')}</Pill>
          {!done && request.status !== 'stopped' ? <p className={`type-callout ${styles.quiet}`}>{t('clockPause')}</p> : null}
        </div>
      </Card>
    </Section>
  );
}
