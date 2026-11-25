import { Star } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import type { ServiceDetail, StepAction } from '@/data/types';
import { Button, Chip, ChipRow, Icon, Sheet, toast } from '@/design/core';
import { Checkbox, FilePick, Lines, SignSheet, TextArea, TextField, type PickedFile, type SheetLine } from '@/design/forms';
import type { FormValue, RequestState } from '@/domain/types';
import { FormFields, validateFields, type FormErrors, type FormValues } from '@/features/shared/FormFields';
import { requestLabelOf } from '@/data/catalog';
import { completeStep, getState, selectCompany, selectDoc, selectPlots, selectRenewalTerms, selectStepAmount, stepTasks, useApp, type ActPayload } from '@/state';
import styles from './ActionRunner.module.css';
import { offeredSlots, renewalLines, runnerTasks } from './logic';
import { StepPaySheet } from './StepPaySheet';
import { paidStrings, paidToastText } from '@/features/payments/paidToast';
import { strings } from './strings';

export interface ActionRunnerProps {
  request: RequestState;
  service: ServiceDetail;
  action: StepAction;
  open: boolean;
  onClose: () => void;
  /** The date by which the investor must act, when there is one. */
  deadline?: number;
  /** Called after the step has been completed. */
  onDone?: () => void;
}

const FIVE = [1, 2, 3, 4, 5] as const;

/**
 * Runs what a step asks of the investor, task by task, inside one sheet: accept, upload, choose,
 * form, rate, reference, declare, schedule, acknowledge. Payment and signature open their own
 * sheets (both are simulations and say so). After the last task the step is completed with
 * `completeStep`, and the request moves on.
 */
export function ActionRunner({ request, service, action, open, onClose, deadline, onDone }: ActionRunnerProps) {
  const t = useT(strings);
  const paidT = useT(paidStrings);
  const { pick, fmt, lang } = useLang();
  const baseId = useId();
  const company = useApp(selectCompany);
  const plots = useApp(selectPlots);
  // The deposit already paid with the offer (A6) of the same thread: the step does not ask for it again.
  const prepaidReceipt = useApp(selectDoc(request.prepaidDocId));
  // The amount the state will charge for this step: the amount shown is the amount charged.
  const amount = useApp(selectStepAmount(request.id, action));
  // A lease renewal (B3): what accepting agrees to.
  const terms = useApp(selectRenewalTerms(request.id));

  const [choice, setChoice] = useState<string | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<FormValues>({});
  const [files, setFiles] = useState<Record<number, PickedFile | null>>({});
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [reference, setReference] = useState('');
  const [declared, setDeclared] = useState(false);
  const [slot, setSlot] = useState<number | undefined>(undefined);
  const [errors, setErrors] = useState<FormErrors>({});
  const [declined, setDeclined] = useState(false);
  const [slots, setSlots] = useState<number[]>([]);
  const advanced = useRef(false);
  const paidReceipt = useRef('');

  // Every opening starts afresh.
  useEffect(() => {
    if (!open) return;
    setChoice(undefined);
    setIndex(0);
    setForm({});
    setFiles({});
    setStars(0);
    setComment('');
    setReference('');
    setDeclared(false);
    setSlot(undefined);
    setErrors({});
    setDeclined(false);
    setSlots(offeredSlots(Date.now()));
    advanced.current = false;
    paidReceipt.current = '';
  }, [open]);

  // With the request, `stepTasks` leaves out a payment already made earlier in the thread.
  const tasksOf = (picked: string | undefined) => runnerTasks(action, picked, (option) => stepTasks(service.id, action, option, request));
  const tasks = useMemo(() => runnerTasks(action, choice, (picked) => stepTasks(service.id, action, picked, request)), [action, choice, service.id, request]);
  const prepaid = request.prepaidDocId !== undefined;
  const choiceWasPaid = prepaid && choice !== undefined && stepTasks(service.id, action, choice).includes('pay');
  const current = tasks[Math.min(index, tasks.length - 1)];
  const last = index >= tasks.length - 1;

  const plot = plots.find((candidate) => candidate.id === request.plotId);
  const plotNumber = plot?.number ?? request.plotId;
  const docs = action.docs?.length ? action.docs.map((doc) => pick(doc)) : [t('uploadDefault')];

  const payLine = tasks.includes('pay') && amount !== undefined;
  const summary: SheetLine[] = [
    { label: t('service'), value: pick(requestLabelOf(service)) },
    { label: t('reference'), value: <span className="ltr">{request.ref}</span> },
    ...(plotNumber ? [{ label: t('plot'), value: <span className="ltr">{plotNumber}</span> }] : []),
    ...(terms ? renewalLines(terms, fmt, t, !payLine) : []),
    ...(payLine ? [{ label: pick(action.amount?.label) || t('amount'), value: fmt.money(amount) }] : []),
    ...(tasks.includes('sign') && action.document ? [{ label: t('document'), value: pick(action.document) }] : []),
  ];

  /* ── finishing ── */

  /** Completes the step with what was collected. */
  const act = (): ReturnType<typeof completeStep> => {
    const payload: ActPayload = {};
    if (choice !== undefined) payload.choice = choice;
    const answers: Record<string, FormValue> = { ...form };
    if (tasks.includes('reference')) answers.reference = reference.trim();
    if (tasks.includes('declare')) answers.declaration = true;
    if (tasks.includes('schedule') && slot !== undefined) answers.slot = slot;
    if (Object.keys(answers).length) payload.form = answers;
    if (tasks.includes('upload')) {
      payload.files = docs.map((_, i) => files[i]).filter((file): file is PickedFile => Boolean(file)).map((file) => ({ name: file.name, ...(file.size !== undefined ? { size: file.size } : {}) }));
    }
    if (tasks.includes('rate')) payload.rating = comment.trim() ? { stars, comment: comment.trim() } : stars;
    return completeStep(request.id, payload);
  };

  const submit = () => {
    const { ok } = act();
    onClose();
    if (ok) {
      toast(t('submitted'), { tone: 'ok' });
      onDone?.();
    } else {
      toast(t('failed'), { tone: 'bad' });
    }
  };

  const advance = () => {
    setErrors({});
    // A choice may change the tasks that follow: read them afresh.
    const now = tasksOf(choice);
    if (index + 1 < now.length) setIndex(index + 1);
    else submit();
  };

  /* ── checks of the general sheet ── */

  const check = (): FormErrors => {
    switch (current) {
      case 'upload': {
        const missing: FormErrors = {};
        docs.forEach((_, i) => {
          if (!files[i]) missing[`file${i}`] = t('needFile');
        });
        return missing;
      }
      case 'choose':
        return choice === undefined ? { choice: t('needChoice') } : {};
      case 'form':
        return validateFields(action.fields ?? [], form, lang);
      case 'rate':
        return stars < 1 ? { stars: t('needStars') } : {};
      case 'reference':
        return reference.trim() ? {} : { reference: t('needReference') };
      case 'declare':
        return declared ? {} : { declare: t('needDeclare') };
      case 'schedule':
        return slot === undefined ? { slot: t('needSlot') } : {};
      default:
        return {};
    }
  };

  const next = () => {
    const found = check();
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    advance();
  };

  /* ── the two dedicated sheets ── */

  // A signature that is not the step's last task counts only once what follows it is done (the payment):
  // the step's tasks are completed together, or not at all.
  const afterSign = tasks.includes('sign') ? tasks[tasks.indexOf('sign') + 1] : undefined;
  const signedAlready = tasks.includes('sign') && tasks.indexOf('sign') < index;
  /** The person signed, then left before the rest was done: nothing was completed, and they are told so. */
  const sayUnfinished = () => toast(t('unfinishedAfterSigning'), { tone: 'info', duration: 7000 });

  const leaveDedicated = () => {
    if (advanced.current) {
      advanced.current = false;
      return;
    }
    if (signedAlready) sayUnfinished();
    onClose();
  };

  const signer = company ? pick(company.signatory.name) : '';
  const companyName = company ? pick(company.name) : '';

  const generalOpen = open && current !== 'pay' && current !== 'sign';
  const primaryLabel = declined ? t('understood') : current === 'accept' ? t('agree') : current === 'acknowledge' ? t('acknowledge') : last ? t('submit') : t('continue');

  return (
    <>
      <Sheet
        open={generalOpen}
        onClose={onClose}
        title={pick(action.title)}
        description={tasks.length > 1 && !declined ? t('stepOf', { n: fmt.num(index + 1), m: fmt.num(tasks.length) }) : undefined}
        closeLabel={t('close')}
        footer={
          <div className={styles.footer}>
            <Button block onClick={declined ? onClose : next}>
              {primaryLabel}
            </Button>
            {current === 'accept' && !declined ? (
              <Button variant="quiet" onClick={() => setDeclined(true)}>
                {t('decline')}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className={styles.body}>
          {declined ? (
            <div className={styles.stack} role="status">
              <h3 className="type-heading">{t('declineTitle')}</h3>
              <p className={styles.text}>{t('declineBody')}</p>
              {deadline ? <p className={styles.text}>{t('declineDeadline', { date: fmt.date(deadline) })}</p> : null}
            </div>
          ) : (
            <>
              {index === 0 || current === 'acknowledge' ? <p className={styles.text}>{terms && current === 'accept' ? t('renewIntro') : pick(action.detail)}</p> : null}

              {current === 'accept' ? <Lines lines={summary} /> : null}

              {current === 'upload' ? (
                <div className={styles.stack}>
                  <p className={styles.note}>{t('uploadIntro')}</p>
                  {docs.map((label, i) => (
                    <FilePick
                      key={label + i}
                      id={`${baseId}-file${i}`}
                      label={label}
                      hint={t('uploadHint')}
                      required
                      value={files[i] ?? null}
                      onChange={(value) => setFiles((prev) => ({ ...prev, [i]: value }))}
                      {...(errors[`file${i}`] ? { error: errors[`file${i}`] } : {})}
                    />
                  ))}
                </div>
              ) : null}

              {current === 'choose' ? (
                <div className={styles.stack}>
                  <ChipRow label={t('chooseLabel')} wrap>
                    {(action.options ?? []).map((option) => (
                      <Chip key={option.value} selected={choice === option.value} onClick={() => setChoice(option.value)}>
                        {pick(option)}
                      </Chip>
                    ))}
                  </ChipRow>
                  {errors.choice ? <p className={styles.error} role="alert">{errors.choice}</p> : null}
                  {choiceWasPaid ? (
                    <p className={styles.note} role="status">
                      {prepaidReceipt ? t('paidWithOfferRef', { ref: prepaidReceipt.ref }) : t('paidWithOffer')}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {current === 'form' ? (
                <FormFields
                  idPrefix={`${baseId}-form`}
                  fields={action.fields ?? []}
                  values={form}
                  onChange={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
                  errors={errors}
                  context={{ ...(request.zoneCode ? { zoneCode: request.zoneCode } : {}), ...(request.plotId ? { plotId: request.plotId } : {}) }}
                />
              ) : null}

              {current === 'rate' ? (
                <div className={styles.stack}>
                  <fieldset className={styles.stars}>
                    <legend className="type-heading">{t('rateQuestion')}</legend>
                    <div className={styles.starRow}>
                      {FIVE.map((n) => (
                        <label key={n} className={styles.star} data-on={n <= stars || undefined}>
                          <input type="radio" name={`${baseId}-stars`} value={n} checked={stars === n} onChange={() => setStars(n)} className={styles.radio} aria-label={t('star', { n })} />
                          <Icon icon={Star} size={32} strokeWidth={1.5} />
                        </label>
                      ))}
                    </div>
                    {errors.stars ? <p className={styles.error} role="alert">{errors.stars}</p> : null}
                  </fieldset>
                  <TextArea id={`${baseId}-comment`} label={t('comment')} value={comment} onChange={setComment} maxLength={280} rows={3} />
                </div>
              ) : null}

              {current === 'reference' ? (
                <TextField id={`${baseId}-ref`} label={t('referenceLabel')} hint={t('referenceHint')} required ltr value={reference} onChange={setReference} {...(errors.reference ? { error: errors.reference } : {})} />
              ) : null}

              {current === 'declare' ? (
                <Checkbox id={`${baseId}-declare`} label={t('declaration')} required checked={declared} onChange={setDeclared} {...(errors.declare ? { error: errors.declare } : {})} />
              ) : null}

              {current === 'schedule' ? (
                <div className={styles.stack}>
                  <ChipRow label={t('slotsLabel')} wrap>
                    {slots.map((at) => (
                      <Chip key={at} selected={slot === at} onClick={() => setSlot(at)} detail={fmt.time(at)}>
                        {fmt.date(at)}
                      </Chip>
                    ))}
                  </ChipRow>
                  {errors.slot ? <p className={styles.error} role="alert">{errors.slot}</p> : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </Sheet>

      <StepPaySheet
        open={open && current === 'pay'}
        onClose={leaveDedicated}
        title={pick(action.amount?.label) || pick(action.title)}
        amount={amount ?? 0}
        closeLabel={t('close')}
        lines={[
          { label: t('service'), value: pick(requestLabelOf(service)) },
          { label: t('reference'), value: <span className="ltr">{request.ref}</span> },
          ...(plotNumber ? [{ label: t('plot'), value: <span className="ltr">{plotNumber}</span> }] : []),
        ]}
        onPay={() => {
          // The payment is the last task of every step that asks for one: completing the step files the receipt.
          if (!last) return '';
          const { ok, receiptDocIds } = act();
          if (!ok) return null;
          const docs = getState().world.docs;
          paidReceipt.current = receiptDocIds.map((id) => docs.find((doc) => doc.id === id)?.ref).filter((ref): ref is string => ref !== undefined).join(' · ');
          return paidReceipt.current;
        }}
        onFailed={() => {
          onClose();
          toast(t('failed'), { tone: 'bad' });
        }}
        onDone={() => {
          if (!last) {
            advanced.current = true;
            advance();
            return;
          }
          onClose();
          toast(paidToastText(paidT, fmt, paidReceipt.current || undefined), { tone: 'ok' });
          onDone?.();
        }}
      />

      <SignSheet
        open={open && current === 'sign'}
        onClose={leaveDedicated}
        title={pick(action.title)}
        documentName={pick(action.document) || pick(service.label)}
        signerName={signer}
        lines={[
          ...(companyName ? [{ label: t('parties'), value: t('partiesValue', { company: companyName }) }] : []),
          ...(plotNumber ? [{ label: t('plot'), value: <span className="ltr">{plotNumber}</span> }] : []),
          { label: t('reference'), value: <span className="ltr">{request.ref}</span> },
        ]}
        {...(afterSign ? { then: afterSign === 'pay' ? { note: t('signedThenPay'), label: t('continueToPay') } : { note: t('signedThenMore'), label: t('continue') } } : {})}
        onSigned={(away) => {
          // The screen went away between the signature and what follows it: there is no one to ask for the rest.
          if (away && afterSign) {
            sayUnfinished();
            onClose();
            return;
          }
          advanced.current = true;
          advance();
        }}
      />
    </>
  );
}
