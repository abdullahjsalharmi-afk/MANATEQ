import { Check, CircleAlert, Copy, SearchX, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import type { ServiceDetail, StepAction } from '@/data/types';
import { Button, Card, Container, EmptyState, List, Pill, Screen, Section, Sheet, Skeleton, Tile, toast } from '@/design/core';
import { Timeline } from '@/design/signature';
import type { RequestState } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { useService } from '@/features/shared/useService';
import { DocRow, PassRow } from '@/features/wallet';
import { cancelRequest, fastForwardRequest, selectDeadline, selectDocsOfRequest, selectPasses, selectRequest, selectThread, timelineRows, useApp, type RequestView } from '@/state';
import type { Doc, Pass } from '@/domain/types';
import { ActionRunner } from './ActionRunner';
import { RequestRing } from './RequestRing';
import { RequestRow } from './RequestRow';
import styles from './RequestScreen.module.css';
import { hasDayClock, passOfRequest } from './logic';
import { strings, workingDays, workingDaysAfter } from './strings';
import { nationalHolder, useHolderWords, useRequestName, useRequestView } from './useRequestFacts';

const HOUR = 3_600_000;

/** One request as an order-status page: who has it now, the standard clock, what to do, how it moves. */
export function RequestScreen() {
  const t = useT(strings);
  const { id } = useParams<{ id: string }>();
  const request = useApp(selectRequest(id));
  const { summary, detail, failed } = useService(request?.serviceId);
  const name = useRequestName();
  const title = request && summary ? name(request.serviceId, summary.label) : t('requestFallback');

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
  const { pick } = lang;
  const now = useNow();
  const view = useRequestView(request, now, service) as RequestView;
  const docs = useApp(selectDocsOfRequest(request.id));
  const passes = useApp(selectPasses);
  const thread = useApp(selectThread(request.id));
  const deadline = useApp(selectDeadline(request.id));
  // The action being run stays mounted until its sheets close, even once the step it completes has moved on.
  const [running, setRunning] = useState<StepAction | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const announcement = useLiveAnnouncement(request, view);
  const headlineId = useId();

  const related = thread.filter((other) => other.id !== request.id);
  const pass = passOfRequest(request, passes);
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

  // After "move time forward", what changed is at the top of the page (the holder, and the action card
  // when it is now the investor's turn) while the control sits at its foot: once the request waits for
  // the investor or ends, go up there and put the focus on the headline. The move can land a tick later.
  const fastForwarded = useRef(false);
  const fastForward = () => {
    fastForwarded.current = true;
    fastForwardRequest(request.id);
    toast(t('fastForwarded'), { tone: 'info' });
  };
  useEffect(() => {
    if (!fastForwarded.current || request.status === 'active') return;
    fastForwarded.current = false;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    document.getElementById(headlineId)?.focus({ preventScroll: true });
  }, [request.status, headlineId]);

  return (
    <Screen title={title} nav="back" backTo="/requests" bleed>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>

      <HolderTile request={request} view={view} service={service} now={now} copy={copy} deadline={deadline} docs={docs} pass={pass} headlineId={headlineId} />

      <Container className={styles.body}>
        <div className={styles.columns}>
          <div className={styles.main}>
            {action ? (
              <div className={styles.partAction}>
                <Section title={t('actionEyebrow')}>
                  <Card className={styles.action}>
                    <h3 className="type-heading">{pick(action.title)}</h3>
                    <p className={styles.text}>{pick(action.detail)}</p>
                    <div className={styles.actionCta}>
                      <Button onClick={() => setRunning(action)}>{pick(action.cta)}</Button>
                    </div>
                  </Card>
                </Section>
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

            {docs.length || pass ? (
              <div className={styles.partDocs}>
                <Section title={t('docs')}>
                  <List>
                    {pass ? <PassRow pass={pass} now={now} /> : null}
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
          <p className={`type-foot ${styles.quiet}`}>{open ? t('demoNote') : t('demoNoteDone')}</p>
          {open ? (
            <div className={styles.demoActions}>
              {request.status === 'active' ? (
                <Button variant="quiet" size="sm" onClick={fastForward}>
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

      {running ?? action ? (
        <ActionRunner
          request={request}
          service={service}
          action={(running ?? action) as StepAction}
          open={running !== null}
          onClose={() => setRunning(null)}
          {...(deadline ? { deadline } : {})}
        />
      ) : null}

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

/** Says politely when the request moves to someone else or ends, while the page is open. */
function useLiveAnnouncement(request: RequestState, view: RequestView): string {
  const t = useT(strings);
  const words = useHolderWords();
  const key = `${request.current ?? 'end'}:${request.status}`;
  const previous = useRef(key);
  const [message, setMessage] = useState('');
  const holder = view.holder;
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    if (request.status === 'done') setMessage(t('completedLive'));
    else if (holder) setMessage(t('moved', { step: words.phrase(holder) }));
  }, [key, request.status, holder, t, words]);
  return message;
}

interface HolderTileProps {
  request: RequestState;
  view: RequestView;
  service: ServiceDetail;
  now: number;
  deadline: number | undefined;
  docs: Doc[];
  pass: Pass | undefined;
  headlineId: string;
  copy: () => void;
}

/**
 * "Who has it now?", as an order-status page: the ring, the holder as the headline, when to expect it
 * (or what to do, and by when) as the tagline, and one plain sentence. The workflow's own step wording
 * stays in the timeline below; the tile speaks to the investor.
 */
function HolderTile({ request, view, now, deadline, docs, pass, headlineId, copy }: HolderTileProps) {
  const t = useT(strings);
  const { pick, fmt, lang } = useLang();
  const words = useHolderWords();
  const finished = request.status === 'done' || request.status === 'stopped';
  const step = view.currentStep;
  const holder = view.holder;

  let eyebrow: string;
  let headline: string;
  let tagline: string | undefined;
  let body: string | undefined;
  let meta: string | undefined;
  let actions: ReactNode;

  if (finished) {
    eyebrow = t('status');
    headline = request.status === 'done' ? t('finished') : t('stopped');
    tagline = t('finishedOn', { date: fmt.date(view.finishedAt ?? request.updatedAt) });
    // The deliverable first: what the request issued, not a receipt of a fee paid on the way.
    const deliverable = docs.find((doc) => doc.kind !== 'receipt') ?? docs[0];
    if (request.status === 'stopped') body = t('stoppedBody');
    else if (pass) actions = <Button to={`/account/wallet/${pass.id}`}>{t('viewPass')}</Button>;
    else if (deliverable) actions = <Button to={`/account/wallet/${deliverable.id}`}>{t('viewDoc')}</Button>;
    else body = t('doneBody');
  } else if (holder?.lane === 'inv') {
    eyebrow = t('now');
    headline = words.headline(holder);
    // By when; the action card right below says what to do (in its words when there is no deadline).
    if (deadline) tagline = t('actBy', { date: fmt.date(deadline) });
    else {
      tagline = view.pendingAction ? pick(view.pendingAction.title) : undefined;
      meta = view.heldSince ? t('waitingSince', { date: fmt.dayMonth(view.heldSince) }) : undefined;
    }
  } else {
    eyebrow = holder && holder.lane !== 'eng' ? t('nowWith') : t('now');
    headline = holder ? words.headline(holder) : t('statusActive');
    if (view.expectedAt !== undefined && view.expectedAt - now > HOUR) tagline = t('expected', { when: fmt.relative(view.expectedAt, now) });
    else if (step && pick(step.std)) tagline = t('stepStandard', { std: pick(step.std) });
    switch (holder?.lane) {
      case 'one':
        body = t('bodyOne');
        break;
      case 'eng': {
        // Right after the investor acted, confirm it was received rather than describe the machinery.
        const lastDone = [...view.timeline].reverse().find((entry) => entry.state === 'done');
        body = lastDone?.lane === 'inv' ? t('bodyReceived') : t('bodyEngine');
        break;
      }
      case 'staff':
        body = t('bodyStaff');
        break;
      case 'field':
        body = t('bodyField');
        break;
      case 'nat': {
        const platform = withoutEntity(pick(holder.name));
        body = platform && platform !== nationalHolder(holder.name, lang).headline ? t('bodyNat', { platform }) : t('bodyNatPlain');
        break;
      }
      default:
        body = undefined;
    }
  }

  return (
    <Tile
      tone="light"
      className={styles.tile}
      lead={
        <div className={styles.lead}>
          <div className={styles.meta}>
            <StatusPill request={request} />
            <Button variant="pearl" size="sm" icon={Copy} onClick={copy} aria-label={t('copyRef', { ref: request.ref })}>
              <span className="ltr">{request.ref}</span>
            </Button>
          </div>
          <RequestRing request={request} view={view} size="lg" />
        </div>
      }
      eyebrow={eyebrow}
      headline={
        <span id={headlineId} tabIndex={-1} className={styles.headline}>
          {headline}
        </span>
      }
      tagline={tagline}
      actions={actions}
    >
      {body || meta ? (
        <div className={styles.tileText}>
          {body ? <p className={styles.text}>{body}</p> : null}
          {meta ? <p className={`type-callout ${styles.quiet}`}>{meta}</p> : null}
        </div>
      ) : null}
    </Tile>
  );
}

/** A platform's own name, without the entity in brackets (the headline already names it). */
const withoutEntity = (name: string): string => name.replace(/\s*[(（][^()（）]+[)）]\s*$/, '').trim();

function StatusPill({ request }: { request: RequestState }) {
  const t = useT(strings);
  switch (request.status) {
    case 'needs_you':
      return (
        <Pill tone="warn" icon={CircleAlert}>
          {t('needsYou')}
        </Pill>
      );
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

/** The published service standard: where the request stands against it, the standard's words, and why the clock pauses. */
function ClockCard({ request, view, service }: { request: RequestState; view: RequestView; service: ServiceDetail }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const { clock } = view;
  const done = request.status === 'done';
  const open = request.status === 'active' || request.status === 'needs_you';
  const target = hasDayClock(request.serviceId, clock) ? clock.targetDays : null;

  let figure: string | undefined;
  if (target !== null) {
    if (done) {
      const used = Math.max(1, Math.ceil(clock.usedDays));
      figure = `${t('clockDone', { n: fmt.plural(used, workingDaysAfter) })} · ${used <= target ? t('clockWithin') : t('clockBeyond', { m: fmt.plural(target, workingDays) })}`;
    } else if (open) {
      figure = `${t('clockDay', { n: fmt.num(clock.dayNumber) })} · ${t('clockOf', { m: fmt.plural(target, workingDays) })}`;
    }
  }

  return (
    <Section title={t('clockTitle')}>
      <Card className={styles.clockPlain}>
        {figure ? <p className={styles.figure}>{figure}</p> : null}
        <p className={`type-callout ${styles.standard}`}>{pick(service.standard)}</p>
        <Pill tone="neutral">{t('indicative')}</Pill>
        {target !== null && open ? <p className={`type-callout ${styles.quiet}`}>{t('clockPause')}</p> : null}
      </Card>
    </Section>
  );
}
