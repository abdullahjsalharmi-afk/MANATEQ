import { CalendarDays, FileText, IdCard, Wrench, type LucideIcon } from 'lucide-react';
import { useT } from '@/app/i18n';
import { Card, Grid, Icon, Section } from '@/design/core';
import styles from './Home.module.css';
import { strings } from './strings';

type Key = keyof typeof strings;

const SHORTCUTS: { to: string; icon: LucideIcon; title: Key; sub: Key }[] = [
  { to: '/start/D1', icon: Wrench, title: 'scFault', sub: 'scFaultSub' },
  { to: '/start/D2', icon: IdCard, title: 'scPass', sub: 'scPassSub' },
  { to: '/start/B8', icon: FileText, title: 'scStatement', sub: 'scStatementSub' },
  { to: '/start/E1', icon: CalendarDays, title: 'scHelp', sub: 'scHelpSub' },
];

/** The four things an operating investor does most, as four white cards. */
export function Shortcuts() {
  const t = useT(strings);
  return (
    <Section title={t('shortcutsTitle')}>
      <Grid as="ul" columns={4} compact>
        {SHORTCUTS.map((shortcut) => (
          <Card as="li" key={shortcut.to} to={shortcut.to} className={styles.shortcut}>
            <Icon icon={shortcut.icon} size={22} className={styles.shortcutIcon} />
            <h3 className={styles.shortcutTitle}>{t(shortcut.title)}</h3>
            <p className={styles.shortcutSub}>{t(shortcut.sub)}</p>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}
