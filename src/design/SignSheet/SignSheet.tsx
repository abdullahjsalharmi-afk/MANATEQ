import { FileSignature } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { Banner } from '../Banner/Banner';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { Checkbox } from '../Field/Checkbox';
import { ReturnFocus } from '../Field/ReturnFocus';
import { Icon } from '../Icon/Icon';
import { Lines, sheetActionClass, SheetSuccess, type SheetLine } from '../PaySheet/parts';
import { Sheet } from '../Sheet/Sheet';
import { useConfirmedTask } from '../Sheet/useConfirmedTask';
import { SignaturePad } from '../SignaturePad/SignaturePad';
import styles from './SignSheet.module.css';
import { strings } from './strings';

export type SignPhase = 'review' | 'processing' | 'success';

/** How long the simulated signing takes. */
export const SIGN_MS = 1100;

export interface SignSheetProps {
  open: boolean;
  onClose: () => void;
  /** What is being signed, as an action, e.g. "وقّع عقد الإيجار". Pass translated text. */
  title: string;
  /** The document's name as it appears in the wallet. */
  documentName: string;
  /** A few facts about the document: parties, term, amount. */
  lines: SheetLine[];
  /** The authorised signatory. */
  signerName: string;
  /**
   * Called once, when the person leaves the confirmation: or, with `away` set, when the sheet went away before
   * they could (the screen changed, the page was closed). A signature that was given is always reported.
   */
  onSigned: (away: boolean) => void;
  /**
   * Set when the signature does not finish the task: something still has to be done before the document is
   * saved (a payment). The confirmation then says so, with `note`, instead of saying the document is saved,
   * and its button reads `label` ("Continue to payment").
   */
  then?: { note: string; label: string };
}

/**
 * The demo e-signature: see what is being signed, sign on the pad (or adopt the typed signature),
 * tick the consent, sign. It is a simulation and says so. While the signature is "processing" the
 * sheet cannot be dismissed, and a signature the person gave is reported exactly once even if the sheet
 * goes away first (see `useConfirmedTask`).
 */
export function SignSheet({ open, onClose, title, documentName, lines, signerName, onSigned, then }: SignSheetProps) {
  const t = useT(strings);
  const baseId = useId();
  const padId = `${baseId}-pad`;
  const consentId = `${baseId}-consent`;
  const doneId = `${baseId}-done`;
  const [phase, setPhase] = useState<SignPhase>('review');
  const [hasSignature, setHasSignature] = useState(false);
  const [consent, setConsent] = useState(false);
  const [checked, setChecked] = useState(false);
  const [hold, setHold] = useState<number | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const task = useConfirmedTask(
    open,
    SIGN_MS,
    () => {
      setPhase('success');
      return true;
    },
    onSigned,
  );

  // Every opening starts clean: nothing signed, nothing ticked.
  useEffect(() => {
    if (!open) return;
    setPhase('review');
    setHasSignature(false);
    setConsent(false);
    setChecked(false);
    setHold(undefined);
  }, [open]);

  useEffect(() => {
    if (phase === 'success') document.getElementById(doneId)?.focus();
  }, [phase, doneId]);

  // The line that says what is missing sits under its field, which may end below the fold of the sheet:
  // once it has rendered, bring it into view with the field (inside the sheet's body; the sheet stays put).
  useEffect(() => {
    if (!checked || phase !== 'review') return;
    const missing = !hasSignature ? padId : !consent ? consentId : null;
    if (missing) document.getElementById(`${missing}-error`)?.scrollIntoView({ block: 'nearest' });
  }, [checked, hasSignature, consent, phase, padId, consentId]);

  const sign = () => {
    if (!hasSignature || !consent) {
      // Say what is missing and take the person to it.
      setChecked(true);
      document.getElementById(hasSignature ? consentId : padId)?.focus();
      return;
    }
    setHold(contentRef.current?.offsetHeight);
    setPhase('processing');
    task.start();
  };

  // However the confirmation is left (the button, Escape, a swipe), the document has been signed.
  const finish = () => {
    task.settle();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={phase === 'success' ? finish : onClose}
      title={title}
      dismissible={phase !== 'processing'}
      closeLabel={t('close')}
      footer={<SignFooter phase={phase} onSign={sign} onDone={finish} doneId={doneId} doneLabel={then?.label} />}
    >
      <ReturnFocus />
      <div ref={contentRef}>
        <SignContent
          phase={phase}
          documentName={documentName}
          lines={lines}
          signerName={signerName}
          consent={consent}
          onConsent={setConsent}
          onSignature={setHasSignature}
          signatureError={checked && !hasSignature ? t('needSignature') : undefined}
          consentError={checked && !consent ? t('needConsent') : undefined}
          padId={padId}
          consentId={consentId}
          minHeight={hold}
          signedNote={then?.note}
        />
      </div>
      <span className="visually-hidden" role="status">
        {phase === 'processing' ? t('processing') : phase === 'success' ? t('signed') : ''}
      </span>
    </Sheet>
  );
}

export interface SignContentProps {
  phase: SignPhase;
  documentName: string;
  lines: SheetLine[];
  signerName: string;
  consent: boolean;
  onConsent: (consent: boolean) => void;
  onSignature: (hasSignature: boolean) => void;
  signatureError?: string;
  consentError?: string;
  /** Start with the typed signature placed (for the component gallery). */
  defaultAdopted?: boolean;
  padId?: string;
  consentId?: string;
  minHeight?: number;
  /** What the confirmation says under the document's name, when it is not yet saved (see `SignSheetProps.then`). */
  signedNote?: string;
}

/** The inside of the signature sheet in each phase. `SignSheet` adds the sheet and the timing. */
export function SignContent({ phase, documentName, lines, signerName, consent, onConsent, onSignature, signatureError, consentError, defaultAdopted, padId, consentId, minHeight, signedNote }: SignContentProps) {
  const t = useT(strings);

  if (phase === 'success') {
    return (
      <SheetSuccess title={t('signed')} minHeight={minHeight}>
        <p className={styles.signedName}>{documentName}</p>
        <p className={styles.signedNote}>{signedNote ?? t('signedNote')}</p>
        <p className={styles.signedDemo}>{t('signedDemo')}</p>
      </SheetSuccess>
    );
  }

  const busy = phase === 'processing';
  return (
    <div className={cx(styles.review, busy && styles.busy)} inert={busy} aria-busy={busy || undefined}>
      <div className={styles.document}>
        <div className={styles.documentHead}>
          <span className={styles.tile} aria-hidden="true">
            <Icon icon={FileSignature} size={24} />
          </span>
          <div className={styles.documentText}>
            <p className={styles.kicker}>{t('document')}</p>
            <p className={styles.documentName}>{documentName}</p>
          </div>
        </div>
        <Lines lines={lines} bare className={styles.documentLines} />
      </div>
      <SignaturePad id={padId} label={t('yourSignature')} signerName={signerName} onChange={onSignature} error={signatureError} defaultAdopted={defaultAdopted} required />
      <Checkbox id={consentId} label={t('consent')} checked={consent} onChange={onConsent} error={consentError} required />
      <Banner tone="demo" compact>
        {t('notice')}
      </Banner>
    </div>
  );
}

export interface SignFooterProps {
  phase: SignPhase;
  onSign?: () => void;
  onDone?: () => void;
  /** The id of the "Done" button, so the sheet can move focus to it. */
  doneId?: string;
  /** What the confirmation's button reads when something still follows the signature. */
  doneLabel?: string;
}

/** The one button of the signature sheet: sign, then done. */
export function SignFooter({ phase, onSign, onDone, doneId, doneLabel }: SignFooterProps) {
  const t = useT(strings);
  if (phase === 'success') {
    return (
      <Button block id={doneId} className={sheetActionClass} onClick={onDone}>
        {doneLabel ?? t('done')}
      </Button>
    );
  }
  return (
    <Button block className={sheetActionClass} loading={phase === 'processing'} onClick={onSign}>
      {phase === 'processing' ? t('processing') : t('sign')}
    </Button>
  );
}
