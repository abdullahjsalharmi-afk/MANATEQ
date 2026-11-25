import { useEffect, useMemo, type ReactNode } from 'react';
import {
  Bell,
  CalendarCheck,
  ChevronDown,
  CircleCheck,
  CircleDot,
  FileText,
  Info,
  Receipt,
  SearchX,
  Ticket,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Button, Card, Container, Icon, List, Pill, Render, Screen, Section, Tile } from '@/design/core';
import { EmptyState, Skeleton } from '@/design/forms';
import { FetchedList, LevelMeter, StandardBadge, type FetchedItem } from '@/design/signature';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import { getIntegration, getService, getSystem, reference } from '@/data/catalog';
import type { ReceiveKind, ServiceDetail, ServiceSummary } from '@/data/types';
import { standardHeadline } from '@/domain/standard';
import { useService } from '@/features/shared/useService';
import { bespokeFlows, startRedirects } from '@/features/flows/registry';
import { buildPages } from '@/features/start/paginate';
import { selectDraft, selectPersona, useApp } from '@/state';
import type { AppState } from '@/domain/types';
import { FOLLOW_ROUTE, followOf, rememberService, renderOfDomain, startTarget } from './catalogue';
import { PLOT_GATE_ACTION, usePlotGate } from './plotGate';
import { ServiceRow } from './ServiceRow';
import { strings } from './strings';
import styles from './ServiceScreen.module.css';

const RECEIVE_ICON: Record<ReceiveKind, LucideIcon> = {
  document: FileText,
  decision: CircleCheck,
  status: Bell,
  payment: Receipt,
  pass: Ticket,
  appointment: CalendarCheck,
  other: CircleDot,
};

const selectRequests = (state: AppState) => state.world.requests;

/** The service page: the four published elements (promise, standard, what we need and fetch, what you get), then the steps and the details. */
export function ServiceScreen() {
  const t = useT(strings);
  const { id } = useParams<{ id: string }>();
  const { summary, detail, loading, failed } = useService(id);

  useEffect(() => {
    if (summary) rememberService(summary.id);
  }, [summary]);

  if (!summary) {
    return (
      <Screen title={t('notFound')} nav="back" backTo="/services">
        <EmptyState icon={SearchX} title={t('notFound')} body={t('notFoundBody')} action={<Button to="/services">{t('browse')}</Button>} />
      </Screen>
    );
  }

  return (
    <ServicePage summary={summary} detail={detail} loading={loading} failed={failed} />
  );
}

interface ServicePageProps {
  summary: ServiceSummary;
  detail: ServiceDetail | undefined;
  loading: boolean;
  failed: boolean;
}

function ServicePage({ summary, detail, loading, failed }: ServicePageProps) {
  const t = useT(strings);
  const { lang, pick } = useLang();
  const persona = useApp(selectPersona);
  const requests = useApp(selectRequests);
  const draft = useApp(useMemo(() => selectDraft(summary.id), [summary.id]));
  const headline = standardHeadline(summary.standard, lang);

  // The investor's latest request of this service, for "track your request".
  const own = persona === 'guest' ? undefined : [...requests].filter((request) => request.serviceId === summary.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const follow = followOf(summary.id);
  const followLink = persona === 'guest' ? undefined : own ? { to: `/requests/${own.id}`, label: t('followRequest') } : follow ? { to: FOLLOW_ROUTE[follow], label: t(`follow_${follow}`) } : undefined;

  // A plot service and no plot it could be for: no «ابدأ», but the one way there and a line saying why.
  const gate = usePlotGate(summary, detail);
  // A draft kept with «متابعة لاحقًا» turns «ابدأ» into «أكمل طلبك» and says where the investor stopped.
  const resumable = summary.startable && persona !== 'guest' && draft !== undefined && !gate;
  const footer = gate ? (
    <Button block to={PLOT_GATE_ACTION[gate.kind].to(gate)}>
      {t(PLOT_GATE_ACTION[gate.kind].label)}
    </Button>
  ) : summary.startable ? (
    <Button block to={startTarget(summary.id, persona)}>
      {resumable ? t('continueDraft') : t('start')}
    </Button>
  ) : followLink ? (
    <Button block variant="secondary" to={followLink.to}>
      {followLink.label}
    </Button>
  ) : undefined;
  const draftStep = resumable && draft ? draftStepOf(summary.id, detail, draft.page) : null;
  const footerContext = gate
    ? t(gate.kind === 'plots' ? 'needsPlotNoneContext' : 'needsPlotContext')
    : resumable
      ? draftStep
        ? t('draftContextStep', { n: draftStep.n, m: draftStep.m })
        : t('draftContext')
      : summary.startable
        ? headline
          ? t('standardContext', { value: headline })
          : undefined
        : t('automaticContext');

  return (
    <Screen title={pick(summary.label)} nav="back" backTo="/services" navLabel={t('back')} bleed footer={footer} footerContext={footer ? footerContext : undefined}>
      <Tile
        tone="light"
        headline={pick(summary.label)}
        tagline={
          <>
            <span className={styles.official}>
              {pick(summary.name)} · <span className="ltr">{summary.id}</span>
            </span>
            <span className={styles.promise}>{pick(summary.promise)}</span>
          </>
        }
        actions={<StandardBadge variant="hero" standard={summary.standard} fallback={heroWords(pick(summary.standard))} />}
        media={<Render name={renderOfDomain(summary.domain)} eager decorative />}
      />

      <Container>
        {summary.startable ? null : (
          <Section title={t('howItStarts')}>
            <Card>
              <div className={styles.starts}>
                <Icon icon={Info} size={22} className={styles.startsIcon} />
                <div className={styles.startsText}>
                  <p className={styles.startsLead}>{t('startsByItself')}</p>
                  <p>{pick(summary.triggeredBy.note)}</p>
                  {detail && pick(detail.appNote) ? <p>{pick(detail.appNote)}</p> : null}
                </div>
              </div>
            </Card>
          </Section>
        )}

        <Section title={t('standard')}>
          <Card>
            <StandardBadge standard={summary.standard} />
          </Card>
        </Section>

        {detail ? (
          <Details detail={detail} />
        ) : failed ? (
          <EmptyState compact icon={WifiOff} title={t('failed')} body={t('failedBody')} action={<Button variant="secondary" onClick={() => window.location.reload()}>{t('retry')}</Button>} />
        ) : loading ? (
          <div aria-busy="true" className={styles.loading}>
            <Skeleton label={t('loading')} variant="block" height={160} />
            <Skeleton variant="block" height={220} />
            <Skeleton variant="text" count={4} />
          </div>
        ) : null}
      </Container>
    </Screen>
  );
}

/** Where a saved draft of the generic flow stopped: step n of m. Null for the purpose-built flows, whose steps differ. */
function draftStepOf(id: string, detail: ServiceDetail | undefined, page: number): { n: number; m: number } | null {
  if (!detail || bespokeFlows[id] || startRedirects[id]) return null;
  const pages = buildPages(detail.fields);
  return { n: Math.min(Math.max(page, 0), pages.length - 1) + 1, m: pages.length };
}

/**
 * The hero's words for a standard with no headline duration: its first clause when it is short enough for the
 * large figure, e.g. "تأكيد الاكتمال عند التقديم؛ إشعار …" → "تأكيد الاكتمال عند التقديم". A longer clause would fill
 * the tile, so the hero then shows no figure. The full sentence stays in the card below either way.
 */
function heroWords(text: string): string | undefined {
  const clause = (text.split(/[؛;]/)[0] ?? '').trim().replace(/[.،,]$/, '');
  return clause && clause.split(/\s+/).length <= HERO_WORDS ? clause : undefined;
}

/** The longest clause, in words, that the hero shows as its figure. */
const HERO_WORDS = 4;

function Details({ detail }: { detail: ServiceDetail }) {
  const t = useT(strings);
  const { pick } = useLang();

  const fetched: FetchedItem[] = detail.fetched.map((item) => {
    if (!item.source) return { text: pick(item) };
    const integration = getIntegration(item.source);
    if (integration) return { text: pick(item), source: { name: pick(integration.short), live: integration.live } };
    const system = getSystem(item.source);
    return { text: pick(item), source: system ? { name: pick(system.name), live: true } : undefined };
  });

  const phase = reference.phases.find((p) => p.n === detail.phase);
  const nextServices = detail.next.map((id) => getService(id)).filter((s): s is ServiceSummary => s !== undefined);

  return (
    <>
      <div className={styles.pair}>
        <div>
          <Section title={t('provides')}>
            <Card pad="none">
              {detail.provides.length ? (
                <ul className={styles.items}>
                  {detail.provides.map((item, index) => (
                    <li key={index} className={styles.item}>
                      <span>{pick(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.none}>{t('providesNone')}</p>
              )}
            </Card>
          </Section>
        </div>
        <div>
          <Section title={t('fetched')}>
            {fetched.length ? <FetchedList items={fetched} label={t('fetched')} /> : <Card><p className={styles.noneText}>{t('fetchedNone')}</p></Card>}
          </Section>
        </div>
      </div>

      <div className={styles.pair}>
        {/* F2, F3 and G4 give the investor nothing to keep: the section is left out rather than shown empty. */}
        {detail.receives.length ? (
          <div>
            <Section title={t('receives')}>
              <Card pad="none">
                <ul className={styles.items}>
                  {detail.receives.map((item, index) => (
                    <li key={index} className={styles.item}>
                      <Icon icon={RECEIVE_ICON[item.kind]} size={20} className={styles.itemIcon} label={t(`receiveKind_${item.kind}`)} />
                      <span>{pick(item)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Section>
          </div>
        ) : null}
        <div>
          <Section title={t('steps')}>
            <Card pad="none">
              <ol className={styles.steps} aria-label={t('stepsLabel')}>
                {detail.steps.map((step, index) => (
                  <li key={index} className={styles.step}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>{pick(step)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </Section>
        </div>
      </div>

      <Section title={t('more')}>
        <Card pad="none" className={styles.disclosures}>
          <Disclosure title={t('behind')}>
            <p className={styles.lead}>{t('behindIntro')}</p>
            <ol className={styles.flow}>
              {detail.flow.map((line, index) => (
                <li key={index}>{pick(line)}</li>
              ))}
            </ol>
            {detail.integrations.length || detail.systems.length ? (
              <>
                <h4 className={styles.subhead}>{t('platforms')}</h4>
                <ul className={styles.platforms}>
                  {detail.integrations.map((code) => {
                    const integration = getIntegration(code);
                    if (!integration) return null;
                    return (
                      <li key={code} className={styles.platform}>
                        <span>{pick(integration.short)}</span>
                        {integration.live ? <Pill tone="ok">{t('live')}</Pill> : <Pill>{t('planned')}</Pill>}
                      </li>
                    );
                  })}
                  {detail.systems.map((code) => {
                    const system = getSystem(code);
                    if (!system) return null;
                    return (
                      <li key={code} className={styles.platform}>
                        <span>{pick(system.name)}</span>
                        <Pill>{t('internal')}</Pill>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            <h4 className={styles.subhead}>{t('automation')}</h4>
            <LevelMeter now={detail.level.now} target={detail.level.target} />
            {phase ? (
              <p className={styles.phase}>
                {t('phase', { n: phase.n, name: pick(phase.name), when: pick(phase.when) })} <span className={styles.tag}>{t('indicative')}</span>
              </p>
            ) : null}
          </Disclosure>

          {detail.who.length ? (
            <Disclosure title={t('who')}>
              <ul className={styles.bullets}>
                {detail.who.map((line, index) => (
                  <li key={index}>{pick(line)}</li>
                ))}
              </ul>
              {detail.benefits.length ? (
                <>
                  <h4 className={styles.subhead}>{t('gains')}</h4>
                  <ul className={styles.bullets}>
                    {detail.benefits.map((line, index) => (
                      <li key={index}>{pick(line)}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Disclosure>
          ) : null}

          {pick(detail.example) ? (
            <Disclosure title={t('example')}>
              <div>
                <Pill>{t('exampleTag')}</Pill>
              </div>
              <p className={styles.example}>{pick(detail.example)}</p>
            </Disclosure>
          ) : null}

          {nextServices.length ? (
            <Disclosure title={t('next')}>
              <List variant="plain" aria-label={t('next')}>
                {nextServices.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </List>
            </Disclosure>
          ) : null}
        </Card>
      </Section>
    </>
  );
}

/** A calm native disclosure: a 52 px row with a chevron, closed by default. */
function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.details}>
      <summary className={styles.summary}>
        <span>{title}</span>
        <Icon icon={ChevronDown} size={16} strokeWidth={2} className={styles.chevron} />
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
