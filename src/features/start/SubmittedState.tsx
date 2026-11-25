import { CircleCheck, Copy } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { getService, peekServiceDetail } from '@/data/catalog';
import { Button, Card, Container, Icon, Screen, Section, Tile, toast } from '@/design/core';
import { Skeleton } from '@/design/forms';
import { Timeline } from '@/design/signature';
import { requestView, selectRequest, selectSpeed, timelineRows, useApp, type TimelineEntry } from '@/state';
import { useCatalogueReady } from '@/state/catalogue';
import { useNow } from '@/features/shared/useNow';
import styles from './Start.module.css';
import { strings } from './strings';

/** A step worth telling the investor about right after sending: not a decision gateway, a stop branch or the engine's own bookkeeping. */
function isInvestorStep(entry: TimelineEntry): boolean {
  return entry.kind !== 'gate' && entry.kind !== 'stop' && entry.lane !== 'eng';
}

export interface SubmittedStateProps {
  /** The request just started (`startRequest` → id). */
  requestId: string;
  /** How many of the next steps to show. Default 3. */
  steps?: number;
}

/**
 * "تم الاستلام": the confirmation every flow ends on. A white tile with the accent check, the reference in a
 * pearl capsule (tap to copy), the next steps of the real workflow with who holds them, and "تتبّع الطلب".
 */
export function SubmittedState({ requestId, steps = 3 }: SubmittedStateProps) {
  const t = useT(strings);
  const lang = useLang();
  const { pick } = lang;
  const request = useApp(useMemo(() => selectRequest(requestId), [requestId]));
  const speed = useApp(selectSpeed);
  // Re-renders when the workflows arrive, so the next steps can be read.
  const ready = useCatalogueReady();
  const now = useNow(1000);
  const summary = request ? getService(request.serviceId) : undefined;
  const detail = request ? peekServiceDetail(request.serviceId) : undefined;

  // The steps that were still ahead when the screen opened stay in view: as the demo clock moves they turn
  // current and done in place, instead of sliding away.
  const anchor = useRef<number | null>(null);
  const next = useMemo(() => {
    if (!request || !detail) return null;
    const view = requestView(request, detail, now, speed);
    // Only the steps the investor would recognise: no decision gateways, no stop branches, no engine housekeeping.
    // The full workflow, word for word, stays on the request page.
    const meaningful = view.timeline.filter(isInvestorStep);
    const shown = meaningful.length ? meaningful : view.timeline;
    if (anchor.current === null) {
      const open = shown.findIndex((entry) => entry.state !== 'done');
      anchor.current = open >= 0 ? open : Math.min(1, shown.length - 1);
    }
    const start = Math.max(0, anchor.current);
    // Each step says who holds it and its own expected time ("فوري", "يوما عمل"), not a wall-clock time, and
    // keeps to its title: the long workflow sentence belongs to the request page.
    return timelineRows(shown.slice(start, start + steps), lang, now).map((row) => {
      const brief = { ...row };
      delete brief.text;
      delete brief.time;
      return brief;
    });
  }, [request, detail, now, speed, steps, lang, ready]);

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
        headline={t('submittedHeadline')}
        tagline={summary ? pick(summary.label) : undefined}
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
        <Section title={t('whatNext')} hint={t('whatNextHint')}>
          <Card>
            {next ? <Timeline items={next} label={t('nextLabel')} /> : <Skeleton variant="row" count={3} label={t('loading')} />}
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
