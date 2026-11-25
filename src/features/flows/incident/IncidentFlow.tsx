/**
 * D3 · Report an emergency (`#/start/D3`, query: plot). Sober on purpose: first the 999 call for a life
 * at risk, then the incident types of the D3 data as large cards; one tap chooses and moves on. The
 * place and a photo are optional; the type is the only answer required. The confirmation says who was
 * alerted (from the workflow), gives the reference and three things to do now.
 */
import { Check, Phone, ShieldCheck, Siren, Building2, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import type { ServiceDetail } from '@/data/types';
import { Button, Card, CardChoiceGroup, Chip, ChipRow, Container, Grid, Icon, List, Pill, Row, Screen, Section, cx } from '@/design/core';
import { PhotoPick, StepHead, TextField, type PickedPhoto } from '@/design/forms';
import type { FormValue } from '@/domain/types';
import { useService } from '@/features/shared/useService';
import { selectPlots, selectRequest, startRequest, useApp } from '@/state';
import { ConfirmationTile, FlowFailed, FlowLoading, leaveFlow, OptionCard } from '../maintenance/parts/Parts';
import { initialPlotId, plotOptions } from '../maintenance/parts/plots';
import { partsStrings } from '../maintenance/parts/strings';
import { alertedParties, incidentIcon, type AlertedParty } from './alerted';
import styles from './IncidentFlow.module.css';
import { strings } from './strings';

const HERE = 'here';
const ELSEWHERE = 'elsewhere';
const EMERGENCY_NUMBER = '999';
const STEPS = 2;
/** The keys with which the type group moves between its cards (see `CardChoiceGroup`). */
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function IncidentFlow() {
  const t = useT(strings);
  const { detail, failed } = useService('D3');
  const [submitted, setSubmitted] = useState<{ id: string; type: string } | null>(null);
  if (failed) return <FlowFailed title={t('title')} />;
  if (!detail) return <FlowLoading title={t('title')} />;
  if (submitted) return <IncidentSubmitted service={detail} requestId={submitted.id} type={submitted.type} />;
  return <IncidentSteps service={detail} onSubmitted={(id, type) => setSubmitted({ id, type })} />;
}

/** The 999 call: a plain `tel:` link drawn as a block pill in the status colour for danger. */
function CallEmergency({ quiet = false }: { quiet?: boolean }) {
  const t = useT(strings);
  return (
    <a href={`tel:${EMERGENCY_NUMBER}`} className={cx(quiet ? styles.callQuiet : styles.call)}>
      <Icon icon={Phone} size={quiet ? 18 : 22} />
      <span>{t('call')}</span>
    </a>
  );
}

function IncidentSteps({ service, onSubmitted }: { service: ServiceDetail; onSubmitted: (id: string, type: string) => void }) {
  const t = useT(strings);
  const tp = useT(partsStrings);
  const { pick } = useLang();
  const query = useQuery();
  const plots = plotOptions(useApp(selectPlots));
  const typeField = service.fields.find((field) => field.key === 'type');
  const photoField = service.fields.find((field) => field.key === 'photo');
  const types = typeField?.options ?? [];

  const [step, setStep] = useState(1);
  const [type, setType] = useState<string | null>(null);
  const [place, setPlace] = useState<string>(() => (query.plot ? (initialPlotId(plots, query.plot) ?? HERE) : HERE));
  const [elsewhere, setElsewhere] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const chosen = types.find((option) => option.value === type);
  const plot = plots.find((option) => option.id === place);

  const choose = (value: string) => {
    setType(value);
    setStep(2);
  };
  // One tap (or Enter / Space) chooses and moves on; the arrow keys of the group only move between the types.
  const moving = useRef(false);
  const pickType = (value: string) => (moving.current ? setType(value) : choose(value));

  const send = () => {
    if (!type) return;
    setSending(true);
    const form: Record<string, FormValue> = { type };
    if (plot) form.location = t('plotValue', { plot: plot.number, zone: pick(plot.zoneName) });
    else if (place === ELSEWHERE && elsewhere.trim()) form.location = elsewhere.trim();
    else form.location = t('hereValue');
    if (photo) form.photo = photo;
    onSubmitted(startRequest('D3', form, plot ? { plotId: plot.id } : {}), type);
  };

  if (step === 1 || !type) {
    return (
      <Screen title={t('title')} nav="close" navLabel={tp('close')} onNav={leaveFlow} width="form">
        <Card className={styles.life}>
          <h2 className="type-heading">{t('lifeQ')}</h2>
          <p className={styles.lifeHint}>{t('lifeHint')}</p>
          <CallEmergency />
        </Card>
        <div
          className={styles.types}
          onKeyDownCapture={(event) => {
            moving.current = MOVE_KEYS.has(event.key);
          }}
          onKeyDown={() => {
            moving.current = false;
          }}
        >
          <StepHead current={1} total={STEPS} question={t('whatQ')} hint={t('whatHint')} />
          <CardChoiceGroup label={t('types')}>
            <Grid compact columns={4}>
              {types.map((option) => (
                <OptionCard key={option.value} size="lg" icon={incidentIcon(option.value)} label={pick(option)} selected={type === option.value} onClick={() => pickType(option.value)} />
              ))}
            </Grid>
          </CardChoiceGroup>
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title={t('title')}
      nav="back"
      navLabel={tp('back')}
      onNav={() => setStep(1)}
      width="form"
      footerContext={chosen ? <span className={styles.context}>{t('type', { v: pick(chosen) })}</span> : undefined}
      footer={
        <Button block onClick={send} loading={sending}>
          {t('send')}
        </Button>
      }
    >
      <StepHead current={2} total={STEPS} question={t('whereQ')} hint={t('whereHint')} />
      <ChipRow label={t('places')} wrap>
        <Chip selected={place === HERE} onClick={() => setPlace(HERE)}>
          {t('here')}
        </Chip>
        {plots.map((option) => (
          <Chip key={option.id} selected={place === option.id} onClick={() => setPlace(option.id)}>
            <span className="ltr">{option.number}</span>
          </Chip>
        ))}
        <Chip selected={place === ELSEWHERE} onClick={() => setPlace(ELSEWHERE)}>
          {t('elsewhere')}
        </Chip>
      </ChipRow>
      <div className={styles.fields}>
        {place === ELSEWHERE ? <TextField label={t('elsewhereLabel')} hint={t('elsewhereHint')} value={elsewhere} onChange={setElsewhere} /> : null}
        <PhotoPick label={t('photo')} hint={pick(photoField?.help)} value={photo} onChange={setPhoto} />
      </div>
    </Screen>
  );
}

const PARTY_ICON: Record<AlertedParty, LucideIcon> = { control: ShieldCheck, responders: Siren, civilDefence: Building2 };

const FIRST_STEP: Record<string, 'firstFire' | 'firstSpill' | 'firstAccident' | 'firstSecurity'> = {
  fire: 'firstFire',
  spill: 'firstSpill',
  accident: 'firstAccident',
  security: 'firstSecurity',
};

function IncidentSubmitted({ service, requestId, type }: { service: ServiceDetail; requestId: string; type: string }) {
  const t = useT(strings);
  const tp = useT(partsStrings);
  const { pick } = useLang();
  const selector = useMemo(() => selectRequest(requestId), [requestId]);
  const request = useApp(selector);
  const parties = alertedParties(service.workflow, type);
  const todo = [t(FIRST_STEP[type] ?? 'firstOther'), t('second'), t('third')];

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
        <Section title={t('nowTitle')}>
          <Card>
            <ol className={styles.todo}>
              {todo.map((line, index) => (
                <li key={line} className={styles.todoItem}>
                  <span className={cx(styles.todoNumber, 'num')} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>
        <Section title={t('alertedTitle')}>
          <List>
            {parties.map(({ party, when }) => (
              <Row
                key={party}
                leading={<Icon icon={PARTY_ICON[party]} />}
                title={t(party)}
                trailing={
                  when === 'now' ? (
                    <Pill tone="ok" icon={Check}>
                      {t('now')}
                    </Pill>
                  ) : (
                    <Pill>{t('ifNeeded')}</Pill>
                  )
                }
              />
            ))}
          </List>
          <p className={styles.fine}>
            {t('standard', { v: pick(service.standard) })} · {tp('indicative')}
          </p>
        </Section>
        <div className={styles.worse}>
          <p className={styles.worseText}>{t('worse')}</p>
          <CallEmergency quiet />
        </div>
      </Container>
    </Screen>
  );
}
