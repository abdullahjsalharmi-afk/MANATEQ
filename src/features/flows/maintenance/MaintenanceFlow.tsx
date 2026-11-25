/**
 * D1 · Report a maintenance issue (`#/start/D1`, query: plot). Three short steps for someone standing in
 * the zone with one hand free: what (category cards from the D1 field options), where (their plot or the
 * common area, and a photo), and an optional sentence. The confirmation shows the live promise,
 * received → scheduled → on site → fixed, read from the real workflow as it moves.
 */
import { Map as MapGlyph, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { getService } from '@/data/catalog';
import type { FieldDef, ServiceDetail } from '@/data/types';
import { Button, Card, Container, Grid, List, Pill, Row, Screen, Section } from '@/design/core';
import { PhotoPick, Stepper, TextArea, TextField, type PickedPhoto } from '@/design/forms';
import { JourneyRibbon } from '@/design/signature';
import type { FormValue } from '@/domain/types';
import { useService } from '@/features/shared/useService';
import { selectPlots, selectRequest, startRequest, useApp } from '@/state';
import styles from './MaintenanceFlow.module.css';
import { ConfirmationTile, FlowFailed, FlowLoading, leaveFlow, OptionCard, Question } from './parts/Parts';
import { initialPlotId, plotOptions } from './parts/plots';
import { partsStrings } from './parts/strings';
import { strings } from './strings';
import { categoryIcon, stageStates, trackStage, TRACK_STAGES, type TrackStage } from './track';

const PUBLIC = 'public';
const STEPS = 3;

export function MaintenanceFlow() {
  const t = useT(strings);
  const { detail, failed } = useService('D1');
  const [submitted, setSubmitted] = useState<string | null>(null);
  if (failed) return <FlowFailed title={t('title')} />;
  if (!detail) return <FlowLoading title={t('title')} />;
  if (submitted) return <MaintenanceSubmitted service={detail} requestId={submitted} onAnother={() => setSubmitted(null)} />;
  return <MaintenanceSteps service={detail} onSubmitted={setSubmitted} />;
}

/** The options of the D1 category field, in the order the data gives them. */
function categoryField(service: ServiceDetail): FieldDef | undefined {
  return service.fields.find((field) => field.key === 'category');
}

function MaintenanceSteps({ service, onSubmitted }: { service: ServiceDetail; onSubmitted: (id: string) => void }) {
  const t = useT(strings);
  const tp = useT(partsStrings);
  const { pick } = useLang();
  const query = useQuery();
  const plots = plotOptions(useApp(selectPlots));
  const categories = categoryField(service)?.options ?? [];

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(() => initialPlotId(plots, query.plot) ?? (plots.length === 0 ? PUBLIC : null));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [details, setDetails] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const chosen = categories.find((option) => option.value === category);
  const plot = plots.find((option) => option.id === place);
  const placeError = place === null ? t('placeMissing') : place === PUBLIC && !note.trim() ? t('noteMissing') : undefined;

  const locationText = (): string => {
    const extra = note.trim();
    if (plot) {
      const base = t('nearPlot', { plot: plot.number, zone: pick(plot.zoneName) });
      return extra ? t('withNote', { base, note: extra }) : base;
    }
    return t('commonArea', { note: extra });
  };

  const next = () => {
    if (step === 2 && placeError) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((current) => Math.min(STEPS, current + 1));
  };

  const send = () => {
    if (!category || placeError) return;
    setSending(true);
    const form: Record<string, FormValue> = { category, location: locationText() };
    if (photo) form.photo = photo;
    if (details.trim()) form.details = details.trim();
    const id = startRequest('D1', form, plot ? { plotId: plot.id } : {});
    onSubmitted(id);
  };

  const footer =
    step === STEPS ? (
      <Button block onClick={send} loading={sending}>
        {t('send')}
      </Button>
    ) : (
      <Button block onClick={next} disabled={step === 1 && !category}>
        {t('continue')}
      </Button>
    );

  return (
    <Screen
      title={t('title')}
      nav={step === 1 ? 'close' : 'back'}
      navLabel={step === 1 ? tp('close') : tp('back')}
      onNav={step === 1 ? leaveFlow : () => setStep(step - 1)}
      width="form"
      header={<Stepper current={step} total={STEPS} label={tp('stepOf', { n: step, m: STEPS })} />}
      footerContext={chosen ? <span className={styles.context}>{pick(chosen)}</span> : <span className={styles.context}>{tp('stepOf', { n: step, m: STEPS })}</span>}
      footer={footer}
    >
      {step === 1 ? (
        <>
          <Question hint={t('whatHint')}>{t('whatQ')}</Question>
          <Grid as="ul" compact columns={3} aria-label={t('categories')} className={styles.options}>
            {categories.map((option) => (
              <OptionCard key={option.value} icon={categoryIcon(option.value)} label={pick(option)} selected={category === option.value} onSelect={() => setCategory(option.value)} />
            ))}
          </Grid>
          <p className={styles.danger}>
            {t('danger')}{' '}
            <Button variant="quiet" tone="danger" to="/start/D3">
              {t('dangerLink')}
            </Button>
          </p>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Question hint={t('whereHint')}>{t('whereQ')}</Question>
          <Grid as="ul" compact columns={plots.length + 1 >= 3 ? 3 : 2} aria-label={t('places')} className={styles.options}>
            {plots.map((option) => (
              <OptionCard key={option.id} icon={MapPin} label={option.number} detail={pick(option.zoneName) || t('plotDetail')} selected={place === option.id} onSelect={() => setPlace(option.id)} />
            ))}
            <OptionCard icon={MapGlyph} label={t('publicArea')} detail={t('publicAreaDetail')} selected={place === PUBLIC} onSelect={() => setPlace(PUBLIC)} />
          </Grid>
          {showErrors && place === null ? (
            <p className={styles.error} role="alert">
              {t('placeMissing')}
            </p>
          ) : null}
          <div className={styles.fields}>
            {place === PUBLIC ? (
              <TextField label={t('note')} hint={t('noteHint')} value={note} onChange={setNote} required error={showErrors && !note.trim() ? t('noteMissing') : undefined} />
            ) : place !== null ? (
              <TextField label={t('noteOptional')} hint={t('noteOptionalHint')} value={note} onChange={setNote} />
            ) : null}
            <PhotoPick label={t('photo')} hint={t('photoHint')} value={photo} onChange={setPhoto} />
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Question hint={t('describeHint')}>{t('describeQ')}</Question>
          <TextArea label={t('details')} value={details} onChange={setDetails} maxLength={280} placeholder={t('detailsPlaceholder')} />
          <Section title={t('summary')} level={3}>
            <List>
              <Row title={t('rowWhat')} trailing={chosen ? pick(chosen) : ''} onClick={() => setStep(1)} chevron />
              <Row title={t('rowWhere')} subtitle={locationText()} onClick={() => setStep(2)} chevron wrap />
              <Row title={t('rowPhoto')} trailing={photo ? t('photoAttached') : t('photoNone')} onClick={() => setStep(2)} chevron />
            </List>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

const CAPTION: Record<TrackStage, 'captionReceived' | 'captionScheduled' | 'captionOnSite' | 'captionDone'> = {
  received: 'captionReceived',
  scheduled: 'captionScheduled',
  onSite: 'captionOnSite',
  done: 'captionDone',
};

function MaintenanceSubmitted({ service, requestId, onAnother }: { service: ServiceDetail; requestId: string; onAnother: () => void }) {
  const t = useT(strings);
  const tp = useT(partsStrings);
  const { pick } = useLang();
  const selector = useMemo(() => selectRequest(requestId), [requestId]);
  const request = useApp(selector);
  const stage = request ? trackStage(service.workflow, request) : 'received';
  const states = stageStates(stage);
  const summary = getService('D1');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <Screen
      title={t('doneTitle')}
      nav="close"
      navLabel={tp('close')}
      onNav={leaveFlow}
      bleed
      width="form"
      footer={
        <Button block to={`/requests/${requestId}`}>
          {t('track')}
        </Button>
      }
    >
      <ConfirmationTile headline={t('doneHeadline')} tagline={t('doneTagline')} reference={request?.ref} />
      <Container width="form">
        <Section title={t('trackTitle')}>
          <Card>
            <JourneyRibbon label={t('trackTitle')} stations={TRACK_STAGES.map((key) => ({ key, label: t(key), state: states[key] }))} caption={t(CAPTION[stage])} />
          </Card>
        </Section>
        <Section title={t('standard')}>
          <List>
            <Row title={pick(service.workflow.standard) || pick(summary?.standard)} trailing={<Pill>{tp('indicative')}</Pill>} wrap />
          </List>
        </Section>
        <div className={styles.after}>
          <p className={styles.danger}>
            {t('dangerAfter')}{' '}
            <Button variant="quiet" tone="danger" to="/start/D3">
              {t('dangerLink')}
            </Button>
          </p>
          <Button variant="quiet" onClick={onAnother}>
            {t('another')}
          </Button>
        </div>
      </Container>
    </Screen>
  );
}
