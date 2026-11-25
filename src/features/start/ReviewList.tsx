import { useT } from '@/app/i18n';
import { Button, List, Row } from '@/design/core';
import styles from './Start.module.css';
import { strings } from './strings';

export interface ReviewItem {
  key: string;
  /** The question, as asked. */
  label: string;
  /** The answer as the investor would say it; empty when nothing was given. */
  value: string;
  /** Opens the page that asks it. */
  onEdit?: () => void;
}

export interface ReviewListProps {
  items: ReviewItem[];
  /** Names the list for screen readers. */
  label?: string;
}

/** "Check your answers": each question with its answer and a link back to change it. */
export function ReviewList({ items, label }: ReviewListProps) {
  const t = useT(strings);
  return (
    <List aria-label={label ?? t('yourAnswers')}>
      {items.map((item) => (
        <Row
          key={item.key}
          eyebrow={item.label}
          title={item.value ? <span className={styles.answer}>{item.value}</span> : <span className={styles.missing}>{t('notGiven')}</span>}
          wrap
          trailing={
            item.onEdit ? (
              <Button variant="quiet" size="sm" onClick={item.onEdit} aria-label={t('editLabel', { label: item.label })}>
                {t('edit')}
              </Button>
            ) : undefined
          }
        />
      ))}
    </List>
  );
}
