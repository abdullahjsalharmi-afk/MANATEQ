import { CloudOff, SearchX } from 'lucide-react';
import { Suspense, useEffect } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { useParams, useQuery } from '@/app/routes';
import { Button, Card, EmptyState, Screen, type RenderName } from '@/design/core';
import { Skeleton } from '@/design/forms';
import type { DomainCode } from '@/data/types';
import { bespokeFlows, startRedirects } from '@/features/flows/registry';
import { signInThen } from '@/features/services/catalogue';
import { useService } from '@/features/shared/useService';
import { selectCompany, selectPersona, useApp } from '@/state';
import { GenericFlow } from './GenericFlow';
import styles from './Start.module.css';
import { strings } from './strings';

/** SPEC 3.5: the render of each service domain. */
const DOMAIN_RENDER: Record<DomainCode, RenderName> = { A: 'zone', B: 'plot', C: 'construction', D: 'utilities', E: 'services', F: 'units', G: 'gate' };

/**
 * `#/start/:id`: starts a service. A purpose-built flow when the service has one, a dedicated screen when it
 * redirects, otherwise the generic flow driven by the service's fields. Query: plot, zone, activity, from.
 */
export function StartScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery();
  const persona = useApp(selectPersona);
  const company = useApp(selectCompany);
  const redirect = startRedirects[id];
  const Bespoke = bespokeFlows[id];
  const guest = persona === 'guest' || !company;

  useEffect(() => {
    if (guest) {
      // Back to this very flow (with its plot, zone or activity) once signed in.
      const params = new URLSearchParams(query).toString();
      navigate(signInThen(params ? `/start/${id}?${params}` : `/start/${id}`), { replace: true });
      return;
    }
    if (redirect) {
      const params = new URLSearchParams(query).toString();
      navigate(params ? `${redirect}?${params}` : redirect, { replace: true });
    }
    // The query is read once, when the screen opens.
  }, [guest, redirect]);

  if (guest || redirect) return <StartLoading />;
  if (Bespoke) {
    return (
      <Suspense fallback={<StartLoading />}>
        <Bespoke />
      </Suspense>
    );
  }
  return <GenericStart id={id} />;
}

function GenericStart({ id }: { id: string }) {
  const t = useT(strings);
  const { pick } = useLang();
  const company = useApp(selectCompany);
  const { summary, detail, loading, failed } = useService(id);

  if (!summary) {
    return (
      <Screen title={t('notFoundName')} nav="back" backTo="/services">
        <EmptyState icon={SearchX} title={t('notFoundTitle')} body={t('notFoundBody')} action={<Button to="/services">{t('browse')}</Button>} />
      </Screen>
    );
  }

  if (!summary.startable) {
    return (
      <Screen title={pick(summary.label)} nav="back" backTo={`/services/${id}`}>
        <EmptyState
          render={DOMAIN_RENDER[summary.domain]}
          title={t('notStartableTitle')}
          body={pick(summary.triggeredBy.note) || pick(summary.summary)}
          action={<Button to={`/services/${id}`}>{t('openService')}</Button>}
        />
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen title={pick(summary.label)} nav="close" backTo={`/services/${id}`}>
        <EmptyState icon={CloudOff} title={t('failedTitle')} body={t('failedBody')} action={<Button onClick={() => window.location.reload()}>{t('tryAgain')}</Button>} />
      </Screen>
    );
  }

  if (loading || !detail || !company) return <StartLoading title={pick(summary.label)} />;
  return <GenericFlow key={id} service={detail} company={company} />;
}

/** The flow's frame while the service (or a bespoke flow) loads. */
function StartLoading({ title }: { title?: string }) {
  const t = useT(strings);
  return (
    <Screen title={title ?? t('loading')} nav="close" width="form">
      <div className={styles.loading} aria-busy="true">
        <Skeleton variant="text" count={2} label={t('loading')} />
        <Card>
          <Skeleton variant="row" count={3} />
        </Card>
        <Skeleton variant="block" height={160} />
      </div>
    </Screen>
  );
}
