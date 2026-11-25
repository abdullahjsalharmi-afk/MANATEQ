import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Container.module.css';

/** `form` 692 px (forms and single-column flows) · `content` 980 px (reading, lists) · `grid` 1440 px (card grids). */
export type ContainerWidth = 'form' | 'content' | 'grid';

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** The widest the content may grow. Default `content`. */
  width?: ContainerWidth;
  /** `section` adds the vertical air of a page section between tiles; `none` only sets the width and the gutters. */
  pad?: 'section' | 'none';
  as?: 'div' | 'section' | 'header' | 'footer';
}

/**
 * A centred column with the page gutters: the contained part of a screen, on the parchment page.
 * Use it directly inside a `<Screen bleed>`, between tiles, and put Sections, Cards, Lists and Grids in it.
 */
export function Container({ children, width = 'content', pad = 'section', as: Tag = 'div', className, ...rest }: ContainerProps) {
  return (
    <Tag className={cx(styles.container, styles[width], pad === 'section' && styles.section, className)} data-container={width} {...rest}>
      {children}
    </Tag>
  );
}
