import { Circle, CircleCheck, CircleDot } from 'lucide-react';
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Card, Icon, List, Row, Section, Sheet } from '@/design/core';
import { JourneyRibbon, type JourneyStation as RibbonStation } from '@/design/signature';
import { getService } from '@/data/catalog';
import type { Journey, JourneyItem, StationKey } from '@/state';
import { itemRoute } from './logic';
import styles from './Home.module.css';
import { strings } from './strings';

export interface JourneyCardProps {
  journey: Journey;
  /** The plot number the journey is about, e.g. "AW-116". */
  plotNumber: string;
}

const ITEM_ICON = { done: CircleCheck, current: CircleDot, upcoming: Circle } as const;

/** The journey of the plot furthest behind, as a ribbon in a card. A station opens its checklist. */
export function JourneyCard({ journey, plotNumber }: JourneyCardProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const [open, setOpen] = useState<StationKey | null>(null);

  const stations: RibbonStation[] = journey.stations.map((station) => ({ key: station.key, label: pick(station.name), state: station.state }));
  const current = journey.stations.find((station) => station.key === journey.station);
  const shown = journey.stations.find((station) => station.key === open);
  const plot = fmt.ltr(plotNumber);

  const itemText = (item: JourneyItem): string => {
    if (item.state === 'done') return t('itemDone');
    if (item.state === 'current') return t('itemCurrent');
    return item.canStart ? t('itemStart') : t('itemUpcoming');
  };

  return (
    <Section title={t('journeyTitle')} hint={t('journeyHint')}>
      <Card>
        <JourneyRibbon
          label={t('journeyTitle')}
          stations={stations}
          caption={t('plotCaption', { plot, station: current ? pick(current.name) : '' })}
          onSelect={(key) => setOpen(key as StationKey)}
        />
      </Card>
      <Sheet open={shown !== undefined} onClose={() => setOpen(null)} title={shown ? pick(shown.name) : ''} description={t('stationSheetBody', { plot })}>
        <JourneyRibbon label={t('journeyTitle')} stations={stations} size="expanded" onSelect={(key) => setOpen(key as StationKey)} className={styles.sheetRibbon} />
        {shown ? (
          <List variant="plain" aria-label={pick(shown.name)}>
            {shown.items.map((item) => {
              const service = getService(item.serviceId);
              return (
                <Row
                  key={item.serviceId}
                  to={itemRoute(item)}
                  leading={<Icon icon={ITEM_ICON[item.state]} size={22} className={item.state === 'current' ? styles.itemCurrent : item.state === 'done' ? styles.itemDone : styles.itemUpcoming} />}
                  title={service ? pick(service.label) : item.serviceId}
                  subtitle={itemText(item)}
                />
              );
            })}
          </List>
        ) : null}
      </Sheet>
    </Section>
  );
}
