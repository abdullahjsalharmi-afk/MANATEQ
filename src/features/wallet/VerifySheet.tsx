import { BadgeCheck, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Button, Icon, List, Row, Sheet } from '@/design/core';
import type { Doc } from '@/domain/types';
import { selectDocs, useApp } from '@/state';
import { findByCode, verifyRoute } from './logic';
import { strings } from './strings';
import styles from './Wallet.module.css';

/** How long the simulated Tasdeeq check takes. */
export const VERIFY_MS = 1000;

export interface VerifySheetProps {
  open: boolean;
  onClose: () => void;
  /** The code to check, as printed on the document. */
  code: string;
}

/**
 * A simulated Tasdeeq check of a document's code: about a second of checking, then the result found
 * among the documents of the demo world. It says plainly that it is a simulation.
 */
export function VerifySheet({ open, onClose, code }: VerifySheetProps) {
  const t = useT(strings);
  const docs = useApp(selectDocs);
  // Read at the end of the check; a change of the wallet meanwhile does not restart it.
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const [result, setResult] = useState<{ doc: Doc | undefined } | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    const timer = window.setTimeout(() => setResult({ doc: findByCode(docsRef.current, code) }), VERIFY_MS);
    return () => window.clearTimeout(timer);
  }, [open, code]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('verify')}
      closeLabel={t('close')}
      footer={
        <Button block onClick={onClose} disabled={result === null}>
          {t('done')}
        </Button>
      }
    >
      <div aria-live="polite">{result === null ? <Checking /> : <VerifyResult doc={result.doc} code={code} />}</div>
      <p className={styles.note}>{t('simulation')}</p>
    </Sheet>
  );
}

function Checking() {
  const t = useT(strings);
  return (
    <div className={styles.status} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <p>{t('checking')}</p>
    </div>
  );
}

/** The calm answer of a check: the facts of the document, or what to look at when nothing matched. */
export function VerifyResult({ doc, code, link = 'public' }: { doc: Doc | undefined; code: string; link?: 'public' | 'open' }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  if (!doc) {
    return (
      <div className={styles.status}>
        <Icon icon={SearchX} size={28} className={styles.neutralMark} />
        <p className={styles.statusTitle} tabIndex={-1} data-verdict="">
          {t('invalidDoc')}
        </p>
        <p className="type-callout">{t('vNotFoundBody')}</p>
      </div>
    );
  }
  return (
    <div className={styles.status}>
      <Icon icon={BadgeCheck} size={32} className={styles.okMark} />
      <p className={styles.statusTitle} tabIndex={-1} data-verdict="">
        {t('validDoc')}
      </p>
      <List variant="plain" className={styles.facts}>
        <Row fact title={t('title_')} trailing={pick(doc.title)} />
        <Row fact title={t('reference')} trailing={<span className="ltr">{doc.ref}</span>} />
        <Row fact title={t('issuedOn')} trailing={fmt.date(doc.issuedAt)} />
        <Row fact title={t('vSignature')} trailing={t(doc.signed ? 'vSigned' : 'vUnsigned')} />
      </List>
      {link === 'public' ? (
        <Button variant="quiet" size="sm" to={verifyRoute(code)}>
          {t('publicCheck')}
        </Button>
      ) : (
        <Button variant="quiet" size="sm" to={`/account/wallet/${doc.id}`}>
          {t('vOpen')}
        </Button>
      )}
    </div>
  );
}
