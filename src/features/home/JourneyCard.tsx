import { Circle, CircleCheck, CircleDashed, CircleDot, CircleX } from 'lucide-react';
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Card, Icon, List, Row, Section, Sheet } from '@/design/core';
import { JourneyRibbon, type JourneyStation as RibbonStation } from '@/design/signature';
import { getService, requestLabelOf } from '@/data/catalog';
import type { Journey, JourneyItem, StationKey } from '@/state';
import { DOT } from '@/domain/text';
import { itemRoute, itemWords } from './logic';
import styles from './Home.module.css';
import { strings } from './strings';

export interface JourneyCardProps {
  journey: Journey;
  /** The plot number the journey is about, e.g. "AW-116". */
  plotNumber: string;
}

/** In progress (a request is open) has the filled dot; "next" with nothing open a dashed ring. */
function itemIcon(item: JourneyItem) {
  if (item.state === 'done') return { icon: CircleCheck, className: styles.itemDone };
  if (item.open) return { icon: CircleDot, className: styles.itemCurrent };
  if (item.state === 'current') return { icon: CircleDashed, className: styles.itemCurrent };
  return { icon: Circle, className: styles.itemUpcoming };
}

/** The journey of the plot furthest behind, as a ribbon in a card. A station opens its checklist. */
export function JourneyCard({ journey, plotNumber }: JourneyCardProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const [open, setOpen] = useState<StationKey | null>(null);

  const stations: RibbonStation[] = journey.stations.map((station) => ({ key: station.key, label: pick(station.name), state: station.state }));
  const current = journey.stations.find((station) => station.key === journey.station);
  const plot = fmt.ltr(plotNumber);

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
      <StationSheet journey={journey} plotNumber={plotNumber} open={open} onChange={setOpen} />
    </Section>
  );
}

export interface StationSheetProps {
  journey: Journey;
  /** The plot number the journey is about, e.g. "AW-116". */
  plotNumber: string;
  /** The station whose checklist shows, or null when the sheet is closed. */
  open: StationKey | null;
  onChange: (station: StationKey | null) => void;
}

/**
 * The checklist of one station of a plot's journey, in a sheet: what is done, what is running and what comes
 * next, each a link to its request or its service. Home opens it for the plot furthest behind; a plot page for
 * that plot.
 */
export function StationSheet({ journey, plotNumber, open, onChange }: StationSheetProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const stations: RibbonStation[] = journey.stations.map((station) => ({ key: station.key, label: pick(station.name), state: station.state }));
  const shown = journey.stations.find((station) => station.key === open);
  const plot = fmt.ltr(plotNumber);

  return (
    <Sheet open={shown !== undefined} onClose={() => onChange(null)} title={shown ? pick(shown.name) : ''} description={t('stationSheetBody', { plot })}>
      <JourneyRibbon label={t('journeyTitle')} stations={stations} size="expanded" selected={open ?? undefined} onSelect={(key) => onChange(key as StationKey)} className={styles.sheetRibbon} />
      {shown ? (
        <List variant="plain" aria-label={pick(shown.name)}>
          {shown.items.flatMap((item) => {
            const service = getService(item.serviceId);
            const words = itemWords(item);
            const icon = itemIcon(item);
            const rows = [
              <Row
                key={item.serviceId}
                to={itemRoute(item)}
                leading={<Icon icon={icon.icon} size={22} className={icon.className} />}
                title={service ? pick(words.name === 'noun' ? requestLabelOf(service) : service.label) : item.serviceId}
                subtitle={words.status.map((word) => t(word)).join(DOT)}
              />,
            ];
            if (words.closedLink) {
              rows.push(
                <Row
                  key={`${item.serviceId}-closed`}
                  to={words.closedLink}
                  leading={<Icon icon={CircleX} size={22} className={styles.itemUpcoming} />}
                  title={t('itemClosedLink')}
                />,
              );
            }
            return rows;
          })}
        </List>
      ) : null}
    </Sheet>
  );
}
