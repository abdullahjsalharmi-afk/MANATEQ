import { Lock, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Card, Grid, Icon, Pill, Screen, toast } from '@/design/core';
import { Avatar, EmptyState, Toggle } from '@/design/forms';
import type { AppState, TeamMember } from '@/domain/types';
import { setDelegated, useApp } from '@/state';
import { orderTeam } from './account-model';
import styles from './TeamScreen.module.css';
import { strings } from './strings';

const selectTeam = (state: AppState): TeamMember[] => state.world.team;

/** Team and delegates: who may act for the company, and the digital mandate of each member. */
export function TeamScreen() {
  const t = useT(strings);
  const team = useApp(selectTeam);
  const members = useMemo(() => orderTeam(team), [team]);
  return (
    <Screen title={t('teamTitle')} nav="back" backTo="/account" width="content">
      <div className={styles.intro}>
        <p className="type-body">{t('teamIntro')}</p>
        <p className={`type-callout ${styles.quiet}`}>{t('teamService')}</p>
      </div>
      {members.length === 0 ? (
        <EmptyState icon={Users} title={t('noTeamTitle')} body={t('noTeamBody')} />
      ) : (
        <Grid as="ul" columns={2} aria-label={t('members')}>
          {members.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </Grid>
      )}
      <p className={`type-foot ${styles.fine}`}>{t('illustrative')}</p>
    </Screen>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  const t = useT(strings);
  const { pick } = useLang();
  const name = pick(member.name);
  const owner = member.scope === 'owner';
  return (
    <Card as="li" className={styles.member}>
      <div className={styles.who}>
        <Avatar name={name} size="lg" />
        <div className={styles.words}>
          <h2 className={styles.name}>{name}</h2>
          <p className={`type-callout ${styles.quiet}`}>{pick(member.role)}</p>
          <p className={styles.scope}>
            <Pill tone="neutral">{t(`scope.${member.scope}`)}</Pill>
          </p>
        </div>
      </div>
      <div className={styles.mandate}>
        {owner ? (
          <p className={`type-callout ${styles.fixed}`}>
            <Icon icon={Lock} size={16} />
            <span>{t('signatoryFixed')}</span>
          </p>
        ) : (
          <Toggle
            label={t('delegateLabel')}
            checked={member.delegated}
            onChange={(on) => {
              setDelegated(member.id, on);
              toast(t(on ? 'delegatedOn' : 'delegatedOff', { name }), { tone: 'ok' });
            }}
          />
        )}
      </div>
    </Card>
  );
}
