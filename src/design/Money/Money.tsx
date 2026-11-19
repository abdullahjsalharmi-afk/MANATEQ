import { useLang, useT } from '@/app/i18n';
import { cx } from '../cx';
import styles from './Money.module.css';
import { strings } from './strings';

export interface MoneyProps {
  /** The amount in Qatari riyals. */
  amount: number;
  /** A type size for an amount that stands alone; by default the amount takes the size of the text around it. */
  size?: 'inherit' | 'heading' | 'title' | 'display';
  className?: string;
}

/**
 * An amount of money: the figure in tabular digits with the currency smaller beside it, in the order
 * each language writes it (30,000 ر.ق · QAR 30,000). Screen readers hear the currency's full name.
 */
export function Money({ amount, size = 'inherit', className }: MoneyProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const figure = fmt.num(amount);
  const whole = fmt.money(amount);
  const at = whole.indexOf(figure);
  // The formatter decides on which side of the figure the currency goes.
  const before = at > 0 ? whole.slice(0, at).trim() : '';
  const after = at >= 0 ? whole.slice(at + figure.length).trim() : '';
  const currency = (text: string) => (
    <span className={styles.currency}>
      <span aria-hidden="true">{text}</span>
      <span className="visually-hidden">{t('riyals')}</span>
    </span>
  );
  return (
    <span className={cx(styles.money, size !== 'inherit' && styles[size], className)}>
      {before ? <>{currency(before)} </> : null}
      <span className={styles.figure}>{at >= 0 ? figure : whole}</span>
      {after ? <> {currency(after)}</> : null}
    </span>
  );
}
