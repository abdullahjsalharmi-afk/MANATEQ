import type { ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import styles from './Footer.module.css';

export interface FooterColumn {
  title: string;
  links: { label: string; to: string }[];
}

export interface FooterProps {
  /** Names the footer's navigation for screen readers. */
  label: string;
  /** The link columns: the app's sections, then privacy, accessibility and how the prototype works. */
  columns: FooterColumn[];
  /** The fine print: the prototype notice. */
  note: ReactNode;
  /** The edition of the data the app is built from. */
  edition?: ReactNode;
  /** Show it at every width instead of only from 834 px (documentation only). */
  inline?: boolean;
}

/**
 * The footer of wide screens (from 834 px), at the end of every tabbed screen: parchment, link columns,
 * a hairline, then one line of fine print. It is what makes the app read as an official website on a desktop.
 */
export function Footer({ label, columns, note, edition, inline = false }: FooterProps) {
  return (
    <footer className={cx(styles.footer, inline && styles.inline)}>
      <div className={styles.inner}>
        <nav aria-label={label} className={styles.columns}>
          {columns.map((column) => (
            <div key={column.title} className={styles.column}>
              <h2 className={styles.heading}>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className={styles.link}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className={styles.fine}>
          <p>{note}</p>
          {edition ? <p>{edition}</p> : null}
        </div>
      </div>
    </footer>
  );
}
