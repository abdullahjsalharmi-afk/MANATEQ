/**
 * The confirmation of a land application: a white tile with the accent check, "your application is in",
 * the reference in a pearl capsule, then what happens next (evaluation, offer, contract, handover) with
 * who holds each step and its indicative standard, and the one pill: track the request.
 */
import { useEffect } from 'react';
import { CircleCheck } from 'lucide-react';
import { navigate } from '@/app/router';
import { useLang, useT } from '@/app/i18n';
import { Button, Card, Container, Icon, Screen, Section, Tile, cx } from '@/design/core';
import { DemoPill, Skeleton } from '@/design/forms';
import { Timeline, type TimelineItem } from '@/design/signature';
import { selectRequest, useApp } from '@/state';
import { strings } from './strings';
import styles from './Land.module.css';

export function Submitted({ requestId }: { requestId: string }) {
  const t = useT(strings);
  const { fmt } = useLang();
  const request = useApp(selectRequest(requestId));

  // The confirmation replaces the review in place: start it from the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const next: TimelineItem[] = [
    { id: 'eval', title: t('nEval'), text: t('nEvalText'), lane: 'eng', state: 'current', auto: true, standard: t('nEvalStd') },
    { id: 'offer', title: t('nOffer'), lane: 'one', state: 'upcoming', auto: true, standard: t('nOfferStd') },
    { id: 'contract', title: t('nContract'), lane: 'inv', state: 'upcoming', standard: t('nContractStd') },
    { id: 'handover', title: t('nHandover'), lane: 'staff', state: 'upcoming', standard: t('nHandoverStd') },
  ];

  return (
    <Screen
      title={t('title')}
      nav="close"
      navLabel={t('home')}
      onNav={() => navigate('/')}
      bleed
      width="form"
      footer={
        <Button block onClick={() => navigate(`/requests/${requestId}`, { replace: true })}>
          {t('track')}
        </Button>
      }
    >
      <Tile tone="light" lead={<Icon icon={CircleCheck} size={44} strokeWidth={1.25} className={styles.check} />} headline={t('received')} tagline={t('receivedTagline')}>
        <p className={styles.capsule} aria-live="polite">
          <span className="type-callout">{t('reference')}</span>
          {request ? <strong className={cx('type-body ltr num', styles.ref)}>{fmt.ltr(request.ref)}</strong> : <Skeleton variant="text" count={1} label={t('reference')} />}
        </p>
      </Tile>
      <Container width="form">
        <Section title={t('whatNext')}>
          <Card>
            <Timeline items={next} label={t('whatNext')} />
          </Card>
          <p className={cx('type-foot', styles.standards)}>
            <DemoPill kind="indicative" />
            <span>{t('whatNextHint')}</span>
          </p>
        </Section>
      </Container>
    </Screen>
  );
}
