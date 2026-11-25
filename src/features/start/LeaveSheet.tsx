import { useT } from '@/app/i18n';
import { Button, Sheet } from '@/design/core';
import styles from './Start.module.css';
import { strings } from './strings';

export interface LeaveSheetProps {
  open: boolean;
  /** Stay in the flow. */
  onStay: () => void;
  /** Leave and keep the draft. */
  onLater: () => void;
  /** Leave and throw the draft away. */
  onDiscard: () => void;
}

/** Asked before closing a flow with answers in it: keep the draft for later, or discard it. */
export function LeaveSheet({ open, onStay, onLater, onDiscard }: LeaveSheetProps) {
  const t = useT(strings);
  return (
    <Sheet
      open={open}
      onClose={onStay}
      title={t('leaveTitle')}
      description={t('leaveBody')}
      footer={
        <div className={styles.sheetActions}>
          <Button block onClick={onLater}>
            {t('later')}
          </Button>
          <Button block variant="secondary" tone="danger" onClick={onDiscard}>
            {t('discard')}
          </Button>
        </div>
      }
    >
      {null}
    </Sheet>
  );
}
