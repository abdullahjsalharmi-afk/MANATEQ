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
  /** Called once, when the person leaves the confirmation. */
  onSigned: () => void;
}

/**
 * The demo e-signature: see what is being signed, sign on the pad (or adopt the typed signature),
 * tick the consent, sign. It is a simulation and says so. While the signature is "processing" the
 * sheet cannot be dismissed.
 */
export function SignSheet({ open, onClose, title, documentName, lines, signerName, onSigned }: SignSheetProps) {
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settled = useRef(false);

  // Every opening starts clean: nothing signed, nothing ticked.
  useEffect(() => {
    if (!open) return;
    settled.current = false;
    setPhase('review');
    setHasSignature(false);
    setConsent(false);
    setChecked(false);
    setHold(undefined);
    return () => clearTimeout(timer.current);
  }, [open]);

  useEffect(() => {
    if (phase === 'success') document.getElementById(doneId)?.focus();
  }, [phase, doneId]);

  const sign = () => {
    if (!hasSignature || !consent) {
      // Say what is missing and take the person to it.
      setChecked(true);
      document.getElementById(hasSignature ? consentId : padId)?.focus();
      return;
    }
    clearTimeout(timer.current);
    setHold(contentRef.current?.offsetHeight);
    setPhase('processing');
    timer.current = setTimeout(() => setPhase('success'), SIGN_MS);
  };

  // However the confirmation is left (the button, Escape, a swipe), the document has been signed.
  const finish = () => {
    if (!settled.current) {
      settled.current = true;
      onSigned();
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={phase === 'success' ? finish : onClose}
      title={title}
      dismissible={phase !== 'processing'}
      closeLabel={t('close')}
      footer={<SignFooter phase={phase} onSign={sign} onDone={finish} doneId={doneId} />}
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
}

/** The inside of the signature sheet in each phase. `SignSheet` adds the sheet and the timing. */
export function SignContent({ phase, documentName, lines, signerName, consent, onConsent, onSignature, signatureError, consentError, defaultAdopted, padId, consentId, minHeight }: SignContentProps) {
  const t = useT(strings);

  if (phase === 'success') {
    return (
      <SheetSuccess title={t('signed')} minHeight={minHeight}>
        <p className={styles.signedName}>{documentName}</p>
        <p className={styles.signedNote}>{t('signedNote')}</p>
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
            <Icon icon={FileSignature} size={20} />
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
}

/** The one button of the signature sheet: sign, then done. */
export function SignFooter({ phase, onSign, onDone, doneId }: SignFooterProps) {
  const t = useT(strings);
  if (phase === 'success') {
    return (
      <Button block id={doneId} className={sheetActionClass} onClick={onDone}>
        {t('done')}
      </Button>
    );
  }
  return (
    <Button block className={sheetActionClass} loading={phase === 'processing'} onClick={onSign}>
      {phase === 'processing' ? t('processing') : t('sign')}
    </Button>
  );
}
