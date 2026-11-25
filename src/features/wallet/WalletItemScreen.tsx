import { Copy, FileQuestion, Printer, Share2, ShieldCheck, SunMedium } from 'lucide-react';
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import { Button, EmptyState, Icon, List, Row, Screen, Sheet, toast } from '@/design/core';
import { QR, Skeleton } from '@/design/forms';
import { DocCard, PassCard } from '@/design/signature';
import { getZone } from '@/data/catalog';
import type { Doc, Pass } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { plotIdOfDoc, revokePass, selectDoc, selectPass, selectPlots, useApp, useCatalogueReady } from '@/state';
import { holderName, passValidity, verifyUrl } from './logic';
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
  const world = useApp((state) => state.world);
  const [checking, setChecking] = useState(false);
  const title = pick(doc.title);
  const request = doc.requestId === undefined ? undefined : world.requests.find((candidate) => candidate.id === doc.requestId);
  const plotId = plotIdOfDoc(world, doc);
  const plot = plotId === undefined ? undefined : world.plots.find((candidate) => candidate.id === plotId);

  const copy = async () => {
    const ok = await copyText(doc.verifyCode);
    toast(ok ? t('copied') : t('copyFailed', { code: doc.verifyCode }), { tone: ok ? 'ok' : 'info' });
  };

  const share = async () => {
    const text = t('shareText', { title, code: doc.verifyCode });
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: verifyUrl(doc.verifyCode) });
        return;
      } catch (error) {
        // The person closed the share sheet: nothing more to do.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copy();
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
            <div className={styles.secondary}>
              <Button variant="secondary" icon={Share2} onClick={share}>
                {t('share')}
              </Button>
              <Button variant="secondary" icon={Printer} onClick={() => window.print()}>
                {t('savePdf')}
              </Button>
            </div>
          </div>

          <List className={styles.asideList}>
            <Row title={<span className="ltr num">{doc.verifyCode}</span>} subtitle={t('copyCode')} trailing={<Icon icon={Copy} size={20} />} onClick={copy} chevron={false} />
            <Row title={pick(doc.issuer)} subtitle={t('issuer')} />
            <Row title={t(doc.signed ? 'signedYes' : 'signedNo')} subtitle={t('status')} />
            {request ? <Row title={<span className="ltr num">{request.ref}</span>} subtitle={t('fromRequest')} to={`/requests/${request.id}`} /> : null}
            {plot ? <Row title={<span className="ltr num">{plot.number}</span>} subtitle={t('plot')} to={`/account/plots/${plot.id}`} /> : null}
          </List>
          <p className={styles.fine}>{t('printNote')}</p>
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
  const holder = holderName(pass.holder, lang);
  const when = (ms: number) => `${fmt.date(ms)}${lang === 'ar' ? '، ' : ', '}${fmt.time(ms)}`;

  const revoke = () => {
    revokePass(pass.id);
    setConfirming(false);
    toast(t('revoked'), { tone: 'ok' });
  };

  return (
    <Screen title={t('passTitle')} nav="back" backTo="/account/wallet?tab=passes" width="form">
      <div className={styles.passWrap}>
        <PassCard
          kind={pass.kind}
          holder={holder}
          idOrPlate={pass.idOrPlate}
          company={pass.company === undefined ? undefined : holderName(pass.company, lang)}
          zone={pick(zone?.name) || zoneCode || ''}
          plot={plot?.number ?? pass.plotId}
          validFrom={when(pass.from)}
          validTo={when(pass.to)}
          status={live ? 'active' : pass.status === 'revoked' ? 'revoked' : 'expired'}
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
