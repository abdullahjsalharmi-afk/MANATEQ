import { BadgeCheck, CreditCard, FileText, Info, LifeBuoy, LogOut, MapPin, Settings, Users } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Button, Card, Container, Icon, List, Pill, Render, Row, Screen, Tile } from '@/design/core';
import { Avatar } from '@/design/forms';
import { selectCompany, selectDocs, selectDues, selectPasses, selectPersona, selectPlots, signOut, useApp } from '@/state';
import { useNow } from '@/features/shared/useNow';
import styles from './AccountScreen.module.css';
import { strings } from './strings';

/** The account home: the verified company, then the investor's records and the app's own pages. */
export function AccountScreen() {
  const t = useT(strings);
  const persona = useApp(selectPersona);
  const company = useApp(selectCompany);
  const signedIn = persona !== 'guest' && company !== null;

  return (
    <Screen title={t('title')} large bleed>
      {signedIn ? (
        <Container width="content">
          <div className={styles.layout}>
            <CompanyCard />
            <div className={styles.lists}>
              <CompanyList />
              <AppList />
              <div className={styles.signOut}>
                <Button
                  variant="quiet"
                  icon={LogOut}
                  flipIcons
                  onClick={() => {
                    signOut();
                    navigate('/welcome', { replace: true });
                  }}
                >
                  {t('signOut')}
                </Button>
              </div>
            </div>
          </div>
        </Container>
      ) : (
        <>
          <Tile
            tone="light"
            headline={t('guestHeadline')}
            tagline={t('guestTagline')}
            actions={<Button to="/welcome">{t('guestCta')}</Button>}
            media={<Render name="services" eager decorative />}
            mediaWidth="small"
          />
          <Container width="form">
            <AppList />
          </Container>
        </>
      )}
    </Screen>
  );
}

function CompanyCard() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const company = useApp(selectCompany);
  const now = useNow(30_000);
  if (!company) return null;
  const name = pick(company.name);
  return (
    <Card to="/account/company" className={styles.company} aria-label={`${t('companyCardLabel')}: ${name}`}>
      <div className={styles.companyHead}>
        <Avatar name={name} size="xl" />
        <Pill tone="gold" icon={BadgeCheck}>
          {t('verified')}
        </Pill>
      </div>
      <h2 className={`type-heading ${styles.companyName}`}>{name}</h2>
      <p className="type-callout">
        {t('crLabel')} <span className="ltr num">{company.cr}</span>
      </p>
      <p className={`type-foot ${styles.sync}`}>{t('lastSync', { when: fmt.relative(company.syncedAt, now) })}</p>
    </Card>
  );
}

function CompanyList() {
  const t = useT(strings);
  const { fmt } = useLang();
  const plots = useApp(selectPlots);
  const docs = useApp(selectDocs);
  const passes = useApp(selectPasses);
  const dues = useApp(selectDues);
  return (
    <List aria-label={t('companyGroup')}>
      <Row leading={<Icon icon={MapPin} />} title={t('plotsRow')} trailing={<span className="num">{fmt.num(plots.length)}</span>} to="/account/plots" />
      <Row leading={<Icon icon={FileText} />} title={t('walletRow')} trailing={<span className="num">{fmt.num(docs.length + passes.length)}</span>} to="/account/wallet" />
      <Row
        leading={<Icon icon={CreditCard} />}
        title={t('paymentsRow')}
        trailing={dues.total > 0 ? <span className="num">{fmt.money(dues.total)}</span> : t('nothingDue')}
        to="/account/payments"
      />
      <Row leading={<Icon icon={Users} />} title={t('teamRow')} to="/account/team" />
    </List>
  );
}

function AppList() {
  const t = useT(strings);
  return (
    <List aria-label={t('appGroup')}>
      <Row leading={<Icon icon={Settings} />} title={t('settingsRow')} to="/account/settings" />
      <Row leading={<Icon icon={LifeBuoy} />} title={t('supportRow')} to="/account/support" />
      <Row leading={<Icon icon={Info} />} title={t('aboutRow')} to="/account/about" />
    </List>
  );
}
