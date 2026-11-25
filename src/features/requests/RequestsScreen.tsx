import { useMemo } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { getService, requestLabelOf } from '@/data/catalog';
import { Button, Card, EmptyState, Grid, List, Screen, Segmented, Skeleton } from '@/design/core';
import { useNow } from '@/features/shared/useNow';
import { selectActiveRequests, selectDoneRequests, useApp, useCatalogueReady } from '@/state';
import { groupRequests, type RequestGroup } from './logic';
import { RequestRow } from './RequestRow';
import styles from './RequestsScreen.module.css';
import { strings } from './strings';

type Segment = 'active' | 'done';

/** «طلباتي»: the requests that are moving (those waiting for the investor first) and those that are complete. */
export function RequestsScreen() {
  const t = useT(strings);
  const query = useQuery();
  const segment: Segment = query.tab === 'done' ? 'done' : 'active';
  const active = useApp(selectActiveRequests);
  const done = useApp(selectDoneRequests);
  const ready = useCatalogueReady();
  const now = useNow();

  const all = useMemo(() => [...active, ...done], [active, done]);
  const groups = useMemo(() => groupRequests(segment === 'active' ? active : done, all), [segment, active, done, all]);

  const choose = (value: Segment) => navigate(value === 'done' ? '/requests?tab=done' : '/requests', { replace: true });

  return (
    <Screen title={t('title')} large width="content">
      <Segmented<Segment>
        className={styles.filter}
        label={t('filter')}
        value={segment}
        onChange={choose}
        options={[
          { value: 'active', label: t('active'), count: active.length },
          { value: 'done', label: t('done'), count: done.length },
        ]}
      />

      {!ready && groups.length ? (
        <div aria-busy="true" className={styles.loading}>
          <Card pad="none">
            <Skeleton variant="row" count={Math.min(4, groups.length)} label={t('loadingList')} />
          </Card>
        </div>
      ) : groups.length ? (
        <Grid as="ul" columns={2} className={styles.grid}>
          {groups.map((group) => (
            <GroupCard key={group.key} group={group} now={now} />
          ))}
        </Grid>
      ) : (
        <EmptyState
          compact
          render="plot"
          title={segment === 'active' ? t('emptyActiveTitle') : t('emptyDoneTitle')}
          body={segment === 'active' ? t('emptyActiveBody') : t('emptyDoneBody')}
          action={
            <Button variant="quiet" to="/services">
              {t('browse')}
            </Button>
          }
        />
      )}
    </Screen>
  );
}

/** One thread: its latest stage on top, the other stages of the same segment under it, and where it sits in its chain. */
function GroupCard({ group, now }: { group: RequestGroup; now: number }) {
  const t = useT(strings);
  const { fmt, pick } = useLang();
  const root = group.place ? getService(group.place.rootServiceId) : undefined;
  return (
    <Card as="li" pad="none" className={styles.card}>
      <List variant="plain">
        <RequestRow request={group.top} now={now} />
        {group.rest.map((request) => (
          <RequestRow key={request.id} request={request} now={now} />
        ))}
      </List>
      {group.place && root ? (
        <p className={`type-callout ${styles.partOf}`}>
          {t('partOf', { name: pick(requestLabelOf(root)), n: fmt.num(group.place.position), m: fmt.num(group.place.total) })}
        </p>
      ) : null}
    </Card>
  );
}
