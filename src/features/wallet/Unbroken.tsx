import { splitCodes, unbroken } from './logic';
import styles from './Wallet.module.css';

/**
 * A title with its codes kept whole: "Rent, Q4 2026 · BA-121" never breaks inside "BA-121", and the
 * separator dot stays with the code. The text reads the same to a screen reader.
 */
export function CodedText({ text }: { text: string }) {
  return (
    <>
      {splitCodes(text).map((part, index) =>
        part.code ? (
          <bdi key={index} className={styles.atom} dir="ltr">
            {part.text}
          </bdi>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** A code or a date that must stay on one line. `code` also sets it left to right. */
export function Atom({ children, code = false }: { children: string; code?: boolean }) {
  return code ? (
    <bdi className={`${styles.atom} num`} dir="ltr">
      {children}
    </bdi>
  ) : (
    <span className={`${styles.atom} num`}>{unbroken(children)}</span>
  );
}
