import { CircleCheck, Copy } from 'lucide-react';
import { useMemo } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { getService, peekServiceDetail } from '@/data/catalog';
import { Button, Card, Container, Icon, Screen, Section, Tile, toast } from '@/design/core';
import { Skeleton } from '@/design/forms';
import { Timeline } from '@/design/signature';
import { requestView, selectRequest, selectSpeed, timelineRows, useApp } from '@/state';
import { useCatalogueReady } from '@/state/catalogue';
import { useNow } from '@/features/shared/useNow';
import styles from './Start.module.css';
import { strings } from './strings';

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

  const next = useMemo(() => {
    if (!request || !detail) return null;
    const view = requestView(request, detail, now, speed);
    const upcoming = view.timeline.filter((entry) => entry.state !== 'done').slice(0, steps);
    return timelineRows(upcoming, lang, now);
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
