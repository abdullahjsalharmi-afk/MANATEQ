import { Copy, FileQuestion, Printer, Share2, ShieldCheck, SunMedium } from 'lucide-react';
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import { Button, EmptyState, Icon, List, Pill, Row, Screen, Sheet, toast } from '@/design/core';
import { QR, Skeleton } from '@/design/forms';
import { DocCard, PassCard } from '@/design/signature';
import { getZone } from '@/data/catalog';
import type { Doc, Pass } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { plotIdOfDoc, revokePass, selectDoc, selectPass, selectPlot, selectPlots, selectRequest, useApp, useCatalogueReady } from '@/state';
import { canPrint, canShare } from './device';
import { useValidityLine } from './DocRow';
import { holderName, passCardState, passMoment, passValidity, verifyUrl } from './logic';
import { strings } from './strings';
import { VerifySheet } from './VerifySheet';
import styles from './Wallet.module.css';

/** A document or a gate pass from the wallet, by id. */
export function WalletItemScreen() {
  const t = useT(strings);
  const { id } = useParams<{ id: string }>();
  const ready = useCatalogueReady();
  const doc = useApp(selectDoc(id));
  const pass = useApp(selectPass(id));

  if (doc) return <DocView doc={doc} />;
  if (pass) return <PassView pass={pass} />;
  return (
    <Screen title={t('title')} nav="back" backTo="/account/wallet">
      {!ready ? (
        <Skeleton variant="block" height={520} label={t('loading')} />
      ) : (
        <EmptyState icon={FileQuestion} title={t('notFound')} body={t('notFoundBody')} action={<Button to="/account/wallet">{t('toWallet')}</Button>} />
      )}
    </Screen>
  );
}

/** Copies text to the clipboard; false when the browser refuses. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function DocView({ doc }: { doc: Doc }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  // Only what this page shows: the request and the plot of the document, not the whole world.
  const request = useApp(selectRequest(doc.requestId));
  const plotId = useApp((state) => plotIdOfDoc(state.world, doc));
  const plot = useApp(selectPlot(plotId));
  const [checking, setChecking] = useState(false);
  const [printable] = useState(canPrint);
  const [shareable] = useState(canShare);
  const title = pick(doc.title);

  const copy = async () => {
    const ok = await copyText(doc.verifyCode);
    toast(ok ? t('copied') : t('copyFailed', { code: doc.verifyCode }), { tone: ok ? 'ok' : 'info' });
  };

  const share = async () => {
    const text = t('shareText', { title, code: doc.verifyCode });
    try {
      await navigator.share({ title, text, url: verifyUrl(doc.verifyCode) });
    } catch (error) {
      // The person closed the share sheet: nothing more to do. Any other failure: the code is copied instead.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await copy();
    }
  };

  return (
    <Screen title={t(`k_${doc.kind}`)} nav="back" backTo="/account/wallet" width="content">
      <div className={styles.docLayout}>
        <div className={styles.paperWrap}>
          <DocCard
            variant="paper"
            className={styles.printable}
            kind={doc.kind}
            title={title}
            reference={doc.ref}
            date={fmt.date(doc.issuedAt)}
            issuer={pick(doc.issuer)}
            signed={doc.signed}
            verifyCode={doc.verifyCode}
            lines={doc.lines.map((line) => ({ label: pick(line.label), value: pick(line.value) }))}
            qr={<QR value={verifyUrl(doc.verifyCode)} size={112} label={t('qrDoc', { title })} />}
          />
        </div>

        <aside className={styles.aside} aria-label={t('about')}>
          <div className={styles.actions}>
            <Button block icon={ShieldCheck} onClick={() => setChecking(true)}>
              {t('verify')}
            </Button>
            {shareable || printable ? (
              <div className={styles.secondary}>
                {shareable ? (
                  <Button variant="quiet" size="sm" icon={Share2} onClick={share}>
                    {t('share')}
                  </Button>
                ) : null}
                {printable ? (
                  <Button variant="quiet" size="sm" icon={Printer} onClick={() => window.print()}>
                    {t('savePdf')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <List className={styles.asideList}>
            <Row title={<span className="ltr">{doc.verifyCode}</span>} subtitle={t('copyCode')} trailing={<Icon icon={Copy} size={20} />} onClick={copy} chevron={false} />
            <Row title={pick(doc.issuer)} subtitle={t('issuer')} />
            <Row title={t(doc.signed ? 'signedYes' : 'signedNo')} subtitle={t('status')} />
            {request ? <Row title={<span className="ltr">{request.ref}</span>} subtitle={t('fromRequest')} to={`/requests/${request.id}`} /> : null}
            {plot ? <Row title={<span className="ltr">{plot.number}</span>} subtitle={t('plot')} to={`/account/plots/${plot.id}`} /> : null}
          </List>
          {printable ? <p className={styles.fine}>{t('printNote')}</p> : null}
        </aside>
      </div>

      <VerifySheet open={checking} onClose={() => setChecking(false)} code={doc.verifyCode} />
    </Screen>
  );
}

function PassView({ pass }: { pass: Pass }) {
  const t = useT(strings);
  const { lang, pick, fmt } = useLang();
  const now = useNow(30_000);
  const plots = useApp(selectPlots);
  const [confirming, setConfirming] = useState(false);
  const plot = plots.find((candidate) => candidate.id === pass.plotId);
  const zoneCode = plot?.zoneCode ?? pass.plotId.split('-')[0];
  const zone = zoneCode === undefined ? undefined : getZone(zoneCode);
  const validity = passValidity(pass, now);
  const live = validity.state === 'valid' || validity.state === 'upcoming';
  const card = passCardState(validity);
  const line = useValidityLine(pass, now);
  const holder = holderName(pass.holder, lang);

  const revoke = () => {
    revokePass(pass.id);
    setConfirming(false);
    toast(t('revoked'), { tone: 'ok' });
  };

  return (
    <Screen title={t('passTitle')} nav="back" backTo="/account/wallet?tab=passes" width="form">
      <div className={styles.passWrap}>
        {card.upcomingFrom !== undefined ? (
          <p className={styles.upcoming}>
            <Pill tone={line.pill.tone} icon={line.pill.icon}>
              {line.pill.label}
              <span aria-hidden="true"> · </span>
              <span className="visually-hidden">, </span>
              {line.text}
            </Pill>
          </p>
        ) : null}
        <PassCard
          kind={pass.kind}
          holder={holder}
          idOrPlate={pass.idOrPlate}
          company={pass.company === undefined ? undefined : holderName(pass.company, lang)}
          zone={pick(zone?.name) || zoneCode || ''}
          plot={plot?.number ?? pass.plotId}
          validFrom={passMoment(pass.from, fmt, lang)}
          validTo={passMoment(pass.to, fmt, lang)}
          status={card.status}
          code={pass.code}
          qr={<QR value={pass.code} size={200} label={t('qrPass', { holder })} />}
        />
        {live ? (
          <>
            <p className={styles.hint}>
              <Icon icon={SunMedium} size={18} />
              <span>{t('brightness')}</span>
            </p>
            <div className={styles.passActions}>
              <Button variant="secondary" tone="danger" onClick={() => setConfirming(true)}>
                {t('revoke')}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('revokeTitle')}
        description={t('revokeBody')}
        closeLabel={t('close')}
        footer={
          <>
            <Button block variant="danger" onClick={revoke}>
              {t('revokeConfirm')}
            </Button>
            <Button block variant="quiet" onClick={() => setConfirming(false)}>
              {t('keep')}
            </Button>
          </>
        }
      >
        <List variant="plain">
          <Row title={holder} subtitle={<span className="ltr num">{pass.code}</span>} />
        </List>
      </Sheet>
    </Screen>
  );
}
