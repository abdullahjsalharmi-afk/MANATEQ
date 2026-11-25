import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useT } from '@/app/i18n';
import { back, getLocation } from '@/app/router';
import { setChromeColor } from '@/app/theme';
import { IconButton } from '../Button/Button';
import type { ContainerWidth } from '../Container/Container';
import { cx } from '../cx';
import { designStrings } from '../strings';
import styles from './Screen.module.css';

export interface ScreenProps {
  /** The screen's name: shown large at the top of tab roots, or in the bar of every other screen. */
  title: string;
  /** Show the title large (34 px) in the content; it moves into the bar on scroll. Use on tab roots. */
  large?: boolean;
  /** One line under the large title. */
  subtitle?: ReactNode;
  /** `back` for inner screens (a chevron), `close` for flows (a circle), `none` for tab roots. */
  nav?: 'none' | 'back' | 'close';
  /** Where "back" goes when there is no previous screen (deep link). Default: home. */
  backTo?: string;
  /** Replace the default back/close behaviour (e.g. to confirm before discarding a form). */
  onNav?: () => void;
  /** Override the label of the back/close button. */
  navLabel?: string;
  /** The inline end of the bar: icon buttons, 14 px quiet links and, when the screen has one, its small primary pill. */
  actions?: ReactNode;
  /** The sticky action bar at the bottom: the screen's one pill (make it `block`). */
  footer?: ReactNode;
  /** One line of running context at the inline start of the action bar: the amount, the step, the selection. */
  footerContext?: ReactNode;
  /** A strip pinned under the bar, edge to edge (the 2 px progress line of a flow). It replaces the bar's hairline. */
  header?: ReactNode;
  /**
   * Full-bleed layout: the children span the whole width. Compose the page from `Tile` (full-bleed moments)
   * and `Container` (contained card sections). Without it the children sit in one contained column.
   */
  bleed?: boolean;
  /** The width of the column, the bar and the action bar: `form` 692 px, `content` 980 px (default), `grid` 1440 px. */
  width?: ContainerWidth;
  /** `dark` makes the whole screen a near-black surface with a dark frosted bar (the welcome). Default `page`. */
  tone?: 'page' | 'dark';
  children: ReactNode;
  className?: string;
}

/**
 * The scaffold of every screen: the frosted bar, the title, the scrolling content and, when the screen
 * has one action, the sticky action bar. The document itself scrolls.
 */
export function Screen({
  title,
  large = false,
  subtitle,
  nav = 'none',
  backTo = '/',
  onNav,
  navLabel,
  actions,
  footer,
  footerContext,
  header,
  bleed = false,
  width = 'content',
  tone = 'page',
  children,
  className,
}: ScreenProps) {
  const mainRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(!large);
  const [scrolled, setScrolled] = useState(false);
  const dark = tone === 'dark';

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

  // The large title hands over to the bar title once it has scrolled under the bar.
  useEffect(() => {
    if (!large) {
      setCollapsed(true);
      return;
    }
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const barBottom = Math.max(0, Math.round(barRef.current?.getBoundingClientRect().bottom ?? 52));
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!(entry?.isIntersecting ?? true)), { rootMargin: `-${barBottom}px 0px 0px 0px`, threshold: 0 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [large]);

  // A dark screen colours the browser chrome to match while it is open.
  useEffect(() => {
    if (!dark) return;
    setChromeColor(getComputedStyle(document.documentElement).getPropertyValue('--tile-1').trim() || null);
    return () => setChromeColor(null);
  }, [dark]);

  const hero = large ? (
    <div ref={heroRef} className={styles.hero}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
    </div>
  ) : (
    <h1 className="visually-hidden">{title}</h1>
  );
  const column = cx(styles.column, styles[`w-${width}`]);

  return (
    <div className={cx(styles.screen, dark && styles.dark, footer ? styles.hasFooter : null, className)} data-tone={dark ? 'dark' : undefined}>
      <ScreenBar
        ref={barRef}
        title={title}
        showTitle={collapsed}
        nav={nav}
        navLabel={navLabel}
        onNav={onNav ?? (() => back(backTo))}
        actions={actions}
        header={header}
        line={scrolled}
        width={width}
      />

      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        {bleed ? (
          <>
            {large ? <div className={cx(column, styles.heroRow)}>{hero}</div> : hero}
            {children}
          </>
        ) : (
          <div className={cx(column, styles.content, large && styles.contentLarge)}>
            {hero}
            {children}
          </div>
        )}
      </main>

      {footer ? (
        <ActionBar context={footerContext} width={width}>
          {footer}
        </ActionBar>
      ) : null}
    </div>
  );
}

export interface ScreenBarProps {
  title: string;
  /** Whether the title shows in the bar (always, except while a large title is still in view). */
  showTitle?: boolean;
  nav?: 'none' | 'back' | 'close';
  navLabel?: string;
  onNav?: () => void;
  actions?: ReactNode;
  header?: ReactNode;
  /** Draw the hairline under the bar (once content scrolls beneath it). */
  line?: boolean;
  width?: ContainerWidth;
  /** Draw the bar in the flow of the page instead of pinning it (documentation only). */
  inline?: boolean;
  ref?: Ref<HTMLElement>;
}

/**
 * The frosted bar of a screen, 52 px: the back chevron or close circle and the page name at the inline
 * start; the prototype capsule and the screen's actions at the inline end. `Screen` renders it.
 */
export function ScreenBar({ title, showTitle = true, nav = 'none', navLabel, onNav, actions, header, line = false, width = 'content', inline = false, ref }: ScreenBarProps) {
  const t = useT(designStrings);
  return (
    <header ref={ref} className={cx(styles.bar, 'mq-frost', line && !header && styles.barLine, inline && styles.barInline)}>
      <div className={cx(styles.column, styles[`w-${width}`], styles.barInner)}>
        <div className={styles.barStart}>
          {nav === 'back' ? <IconButton icon={ChevronLeft} flip label={navLabel ?? t('back')} onClick={onNav} /> : null}
          {nav === 'close' ? <IconButton icon={X} variant="soft" size="sm" label={navLabel ?? t('close')} onClick={onNav} /> : null}
          <div className={cx(styles.barTitle, showTitle && styles.barTitleOn)} aria-hidden="true">
            {title}
          </div>
        </div>
        <div className={styles.barEnd}>
          {/* Always visible: this is a prototype, not the official service. On wide tabbed screens the global bar carries it. */}
          <span className={styles.proto}>{t('prototype')}</span>
          {actions}
        </div>
      </div>
      {header ? <div className={styles.barExtra}>{header}</div> : null}
    </header>
  );
}

export interface ActionBarProps {
  /** The pill (make it `block`). */
  children: ReactNode;
  /** One line of running context: the amount, the step, the selection. */
  context?: ReactNode;
  width?: ContainerWidth;
  /** Draw the bar in the flow of the page instead of pinning it (documentation only). */
  inline?: boolean;
}

/**
 * The sticky action bar: frosted, a hairline on top, the running context at the inline start and the
 * pill at the inline end. On phones the pill is block-width above the home indicator, with the context
 * as a line over it. `Screen` renders it for its `footer`.
 */
export function ActionBar({ children, context, width = 'content', inline = false }: ActionBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Tell whatever floats above the bottom edge (a toast) how tall the bar is.
  useEffect(() => {
    const bar = ref.current;
    if (inline || !bar) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--actionbar-h', `${Math.round(bar.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--actionbar-h');
    };
  }, [inline]);

  return (
    <div ref={ref} className={cx(styles.actionBar, 'mq-frost', inline && styles.actionInline)} data-action-bar="">
      <div className={cx(styles.column, styles[`w-${width}`], styles.actionInner)}>
        {context ? <div className={styles.actionContext}>{context}</div> : null}
        <div className={styles.actionButtons}>{children}</div>
      </div>
    </div>
  );
}
