/**
 * D2 · Request a gate pass (`#/start/D2`, query: plot). Who (the pass types of the D2 data), the
 * details for that type only with the plot and the validity, then a review. A standard pass is issued
 * at once: it goes to the wallet, the D2 request records it, and the success state shows the pass with
 * its QR, ready to send.
 */
import { MapPin, Share2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import type { FieldDef, ServiceDetail } from '@/data/types';
import { Button, Chip, ChipRow, Container, Grid, Icon, List, Row, Screen, Section, toast } from '@/design/core';
import { DateField, EmptyState, isoDateToMs, msToIsoDate, Stepper, TextField, QR } from '@/design/forms';
import { PassCard } from '@/design/signature';
import type { PassKind } from '@/domain/types';
import { useService } from '@/features/shared/useService';
import { issuePass, selectPass, selectPlots, startRequest, useApp } from '@/state';
import { ConfirmationTile, FlowFailed, FlowLoading, leaveFlow, OptionCard, Question } from '../maintenance/parts/Parts';
import { initialPlotId, plotOptions, type PlotOption } from '../maintenance/parts/plots';
import { partsStrings } from '../maintenance/parts/strings';
import styles from './PassFlow.module.css';
import { KIND_ICON, passKinds } from './kinds';
import { strings } from './strings';
import { customRange, idOrPlateOf, missingDetails, quickRange, QUICK_VALIDITY, type PassDetails, type Range, type Validity } from './validity';

const STEPS = 3;
const EMPTY_DETAILS: PassDetails = { name: '', qid: '', plate: '', company: '' };

export function PassFlow() {
  const t = useT(strings);
  const { detail, failed } = useService('D2');
  const plots = useApp(selectPlots);
  const [issued, setIssued] = useState<string | null>(null);
  if (failed) return <FlowFailed title={t('title')} />;
  if (!detail) return <FlowLoading title={t('title')} />;
  if (plots.length === 0) return <NoPlot />;
  if (issued) return <PassIssued passId={issued} onAnother={() => setIssued(null)} />;
  return <PassSteps service={detail} onIssued={setIssued} />;
}

function NoPlot() {
  const t = useT(strings);
  const tp = useT(partsStrings);
  return (
    <Screen title={t('title')} nav="close" navLabel={tp('close')} onNav={leaveFlow} width="form">
      <EmptyState render="gate" title={t('noPlotTitle')} body={t('noPlotBody')} action={<Button to="/eligibility">{t('noPlotAction')}</Button>} />
    </Screen>
  );
}

const fieldOf = (service: ServiceDetail, key: string): FieldDef | undefined => service.fields.find((field) => field.key === key);

function PassSteps({ service, onIssued }: { service: ServiceDetail; onIssued: (passId: string) => void }) {
  const t = useT(strings);
  const tp = useT(partsStrings);
  const { pick, fmt } = useLang();
  const query = useQuery();
  const plots = plotOptions(useApp(selectPlots));
  const kinds = passKinds(service);
  const qidLabel = pick(fieldOf(service, 'qid')?.label);
  const plateLabel = pick(fieldOf(service, 'plate')?.label);

  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<PassKind | null>(null);
  const [details, setDetails] = useState<PassDetails>(EMPTY_DETAILS);
  const [plotId, setPlotId] = useState<string | null>(() => initialPlotId(plots, query.plot));
  const [validity, setValidity] = useState<Validity>('today');
  const [fromIso, setFromIso] = useState<string | null>(null);
  const [toIso, setToIso] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const kindOption = kinds.find((option) => option.kind === kind);
  const plot = plots.find((option) => option.id === plotId);
  const range: Range | 'missing' | 'past' | 'order' = validity === 'custom' ? customRange(isoDateToMs(fromIso), isoDateToMs(toIso), now) : quickRange(validity, now);
  const missing = kind ? missingDetails(kind, details) : [];
  const detailsValid = missing.length === 0 && plot !== undefined && typeof range !== 'string';

  const set = (key: keyof PassDetails) => (value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const chooseKind = (next: PassKind) => {
    if (next !== kind) setShowErrors(false);
    setKind(next);
  };

  const next = () => {
    if (step === 2 && !detailsValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((current) => Math.min(STEPS, current + 1));
  };

  const issue = () => {
    if (!kind || !plot || typeof range === 'string') return;
    setIssuing(true);
    const holder = details.name.trim();
    const idOrPlate = idOrPlateOf(kind, details);
    const company = kind === 'visitor' ? details.company.trim() : '';
    const passId = issuePass({ kind, holder, plotId: plot.id, from: range.from, to: range.to, ...(idOrPlate ? { idOrPlate } : {}), ...(company ? { company } : {}) });
    // The request records the pass in the D2 workflow; when it reaches the gates it finds this pass and issues no second one.
    startRequest(
      'D2',
      {
        passType: kind,
        holder,
        ...(kind === 'worker' ? { qid: details.qid.trim() } : {}),
        ...(kind === 'vehicle' && idOrPlate ? { plate: idOrPlate } : {}),
        ...(kind === 'visitor' ? { visitor: { name: holder } } : {}),
        ...(company ? { company } : {}),
        validFrom: range.from,
        validTo: range.to,
        plot: plot.id,
      },
      { plotId: plot.id },
    );
    onIssued(passId);
  };

  const err = (key: 'name' | 'qid' | 'plate', message: string) => (showErrors && missing.includes(key) ? message : undefined);
  const rangeError = showErrors && typeof range === 'string' ? t(range === 'missing' ? 'datesMissing' : range === 'past' ? 'datesPast' : 'datesOrder') : undefined;
  const rangeText = typeof range === 'string' ? '' : validity === 'today' ? `${t('today')} · ${fmt.date(range.from)}` : t('range', { from: fmt.date(range.from), to: fmt.date(range.to) });
  const plotLabel = (option: PlotOption) => tp('plotIn', { plot: fmt.ltr(option.number), zone: pick(option.zoneName) });

  const footer =
    step === STEPS ? (
      <Button block onClick={issue} loading={issuing}>
        {t('issue')}
      </Button>
    ) : (
      <Button block onClick={next} disabled={step === 1 && !kind}>
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
      footerContext={<span className={styles.context}>{kindOption ? pick(kindOption.option) : tp('stepOf', { n: step, m: STEPS })}</span>}
      footer={footer}
    >
      {step === 1 ? (
        <>
          <Question hint={t('whoHint')}>{t('whoQ')}</Question>
          <Grid as="ul" columns={3} aria-label={t('kinds')}>
            {kinds.map((option) => (
              <OptionCard key={option.kind} size="lg" icon={KIND_ICON[option.kind]} label={pick(option.option)} detail={t(`${option.kind}Detail`)} selected={kind === option.kind} onSelect={() => chooseKind(option.kind)} />
            ))}
          </Grid>
        </>
      ) : null}

      {step === 2 && kind ? (
        <>
          <Question>{t(`${kind}Q`)}</Question>
          <div className={styles.fields}>
            <TextField label={t(kind === 'worker' ? 'workerName' : kind === 'vehicle' ? 'driverName' : 'visitorName')} value={details.name} onChange={set('name')} required autoComplete="off" error={err('name', t('nameMissing'))} />
            {kind === 'worker' ? <TextField label={qidLabel} value={details.qid} onChange={set('qid')} required ltr inputMode="numeric" autoComplete="off" error={err('qid', t('qidMissing'))} /> : null}
            {kind === 'vehicle' ? <TextField label={plateLabel} value={details.plate} onChange={set('plate')} required ltr autoComplete="off" error={err('plate', t('plateMissing'))} /> : null}
            {kind === 'visitor' ? <TextField label={t('company')} value={details.company} onChange={set('company')} autoComplete="organization" /> : null}
          </div>

          <Section title={t('plot')} hint={plots.length > 1 ? t('plotHint') : undefined} level={3}>
            {plots.length === 1 && plot ? (
              <List>
                <Row leading={<Icon icon={MapPin} />} title={<span className="ltr">{plot.number}</span>} subtitle={pick(plot.zoneName)} />
              </List>
            ) : (
              <>
                <ChipRow label={t('plot')} wrap>
                  {plots.map((option) => (
                    <Chip key={option.id} selected={plotId === option.id} onClick={() => setPlotId(option.id)} detail={pick(option.zoneName)}>
                      <span className="ltr">{option.number}</span>
                    </Chip>
                  ))}
                </ChipRow>
                {showErrors && !plot ? (
                  <p className={styles.error} role="alert">
                    {t('plotMissing')}
                  </p>
                ) : null}
              </>
            )}
          </Section>

          <Section title={t('validity')} level={3}>
            <ChipRow label={t('validity')} wrap>
              {QUICK_VALIDITY.map((choice) => (
                <Chip key={choice} selected={validity === choice} onClick={() => setValidity(choice)}>
                  {t(choice)}
                </Chip>
              ))}
              <Chip selected={validity === 'custom'} onClick={() => setValidity('custom')}>
                {t('custom')}
              </Chip>
            </ChipRow>
            {validity === 'custom' ? (
              <div className={styles.dates}>
                <DateField label={t('from')} value={fromIso} onChange={setFromIso} min={msToIsoDate(now)} required />
                <DateField label={t('to')} value={toIso} onChange={setToIso} min={fromIso ?? msToIsoDate(now)} required />
              </div>
            ) : null}
            {rangeText ? <p className={styles.rangeLine}>{rangeText}</p> : null}
            {rangeError ? (
              <p className={styles.error} role="alert">
                {rangeError}
              </p>
            ) : null}
          </Section>
        </>
      ) : null}

      {step === 3 && kind && plot ? (
        <>
          <Question hint={t('reviewHint')}>{t('reviewQ')}</Question>
          <List>
            <Row title={t('rowType')} trailing={kindOption ? pick(kindOption.option) : ''} onClick={() => setStep(1)} chevron />
            <Row title={t('rowHolder')} subtitle={[details.name.trim(), idOrPlateOf(kind, details), kind === 'visitor' ? details.company.trim() : ''].filter(Boolean).join(' · ')} onClick={() => setStep(2)} chevron wrap />
            <Row title={t('plot')} subtitle={plotLabel(plot)} onClick={() => setStep(2)} chevron />
            <Row title={t('rowValid')} subtitle={rangeText} onClick={() => setStep(2)} chevron wrap />
          </List>
          <p className={styles.fine}>{t('simulated')}</p>
        </>
      ) : null}
    </Screen>
  );
}

function PassIssued({ passId, onAnother }: { passId: string; onAnother: () => void }) {
  const t = useT(strings);
  const tp = useT(partsStrings);
  const { pick, fmt } = useLang();
  const selector = useMemo(() => selectPass(passId), [passId]);
  const pass = useApp(selector);
  const plots = plotOptions(useApp(selectPlots));
  const plot = plots.find((option) => option.id === pass?.plotId);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  if (!pass) return <FlowLoading title={t('doneTitle')} />;

  const zone = pick(plot?.zoneName);
  const plotNumber = plot?.number ?? pass.plotId;

  const send = async () => {
    const text = t('shareText', { zone, plot: plotNumber, holder: pass.holder, to: fmt.date(pass.to), code: pass.code });
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('shareTitle'), text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast(t('copied'));
    } catch {
      toast(t('copyFailed'));
    }
  };

  return (
    <Screen
      title={t('doneTitle')}
      nav="close"
      navLabel={tp('close')}
      onNav={leaveFlow}
      bleed
      width="form"
      footer={
        <Button block icon={Share2} onClick={() => void send()}>
          {t('send')}
        </Button>
      }
    >
      <ConfirmationTile headline={t('doneHeadline')} tagline={t('doneTagline')}>
        <div className={styles.pass}>
          <PassCard
            kind={pass.kind}
            holder={pass.holder}
            idOrPlate={pass.idOrPlate}
            company={pass.company}
            zone={zone}
            plot={plotNumber}
            validFrom={fmt.date(pass.from)}
            validTo={fmt.date(pass.to)}
            status={pass.status}
            code={pass.code}
            qr={<QR value={pass.code} label={t('qrLabel', { code: pass.code })} />}
          />
        </div>
      </ConfirmationTile>
      <Container width="form">
        <div className={styles.after}>
          <Button variant="secondary" to={`/account/wallet/${pass.id}`}>
            {t('wallet')}
          </Button>
          <Button variant="quiet" onClick={onAnother}>
            {t('another')}
          </Button>
          <p className={styles.fine}>{t('simulated')}</p>
        </div>
      </Container>
    </Screen>
  );
}
