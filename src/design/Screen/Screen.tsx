import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import { back, getLocation } from '@/app/router';
import { IconButton } from '../Button/Button';
import { cx } from '../cx';
import { designStrings } from '../strings';
import styles from './Screen.module.css';

export interface ScreenProps {
  /** The screen's name: shown large at the top of tab screens, or in the bar of inner screens. */
  title: string;
  /** Show the title large in the content; it collapses into the bar on scroll. Use on tab roots. */
  large?: boolean;
  /** One line under the large title. */
  subtitle?: ReactNode;
  /** `back` for inner screens, `close` for flows, `none` for tab roots. */
  nav?: 'none' | 'back' | 'close';
  /** Where "back" goes when there is no previous screen (deep link). Default: home. */
  backTo?: string;
  /** Replace the default back/close behaviour (e.g. to confirm before discarding a form). */
  onNav?: () => void;
  /** Override the label of the back/close button. */
  navLabel?: string;
  /** Icon buttons at the end of the bar. */
  actions?: ReactNode;
  /** A sticky area at the bottom for the screen's primary action. */
  footer?: ReactNode;
  /** Content directly under the bar, above the scrolling content (e.g. a stepper). */
  header?: ReactNode;
  /** Remove the side gutters (maps, full-bleed media). */
  bleed?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * The scaffold of every screen: a translucent top bar, the title, the scrolling content in a centred
 * column, and an optional sticky footer for the primary action. The document itself scrolls.
 */
export function Screen({ title, large = false, subtitle, nav = 'none', backTo = '/', onNav, navLabel, actions, footer, header, bleed = false, children, className }: ScreenProps) {
  const t = useT(designStrings);
  const mainRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(!large);
  const [scrolled, setScrolled] = useState(false);

  // Move focus to the new screen after a navigation, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (getLocation().nav !== 'initial') mainRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!large) {
      setCollapsed(true);
      return;
    }
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!(entry?.isIntersecting ?? true)), { rootMargin: '-56px 0px 0px 0px', threshold: 0 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [large]);

  const handleNav = onNav ?? (() => back(backTo));

  return (
    <div className={cx(styles.screen, className)}>
      <header className={cx(styles.bar, (scrolled || Boolean(header)) && styles.barLine)}>
        <div className={styles.barInner}>
          <div className={styles.barStart}>
            {nav === 'back' ? <IconButton icon={ChevronLeft} flip label={navLabel ?? t('back')} onClick={handleNav} /> : null}
            {nav === 'close' ? <IconButton icon={X} label={navLabel ?? t('close')} onClick={handleNav} /> : null}
          </div>
          <div className={styles.barCentre}>
            <div className={cx(styles.barTitle, collapsed && styles.barTitleOn)} aria-hidden="true">
              {title}
            </div>
            {/* Always visible, on every screen: this is a prototype, not the official service. */}
            <div className={cx(styles.proto, collapsed && styles.protoSmall)}>{t('prototype')}</div>
          </div>
          <div className={styles.barEnd}>{actions}</div>
        </div>
        {header ? <div className={styles.barExtra}>{header}</div> : null}
      </header>

      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        <div className={cx(styles.content, bleed && styles.bleed)}>
          {large ? (
            <div ref={heroRef} className={styles.hero}>
              <h1 className={styles.title}>{title}</h1>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
          ) : (
            <h1 className="visually-hidden">{title}</h1>
          )}
          {children}
        </div>
      </main>

      {footer ? (
        <div className={styles.footer}>
          <div className={styles.footerInner}>{footer}</div>
        </div>
      ) : null}
    </div>
  );
}
