import { CircleAlert, CircleCheck, FileText } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './FilePick.module.css';
import { strings } from './strings';

/** All the app keeps of a chosen file. Its content is never read or stored. */
export interface PickedFile {
  name: string;
  /** Size in bytes. Always set for a newly chosen file; a saved value may come back without it. */
  size?: number;
}

export type FilePickState = 'empty' | 'checking' | 'verified';

/** How long the simulated check of a document takes. */
export const FILE_CHECK_MS = 1100;

const SAMPLE_BYTES = 248_000;
const DEFAULT_ACCEPT = 'application/pdf,image/*';

export interface FilePickProps {
  /** The document's name, e.g. "خطة العمل". Pass translated text. */
  label: string;
  /** What is accepted, e.g. "PDF أو صورة · حتى 10 ميغابايت". */
  hint?: string;
  /** The checked document, or null. */
  value: PickedFile | null;
  /** Called once a chosen document has passed its check, and with null when it is removed. */
  onChange: (value: PickedFile | null) => void;
  required?: boolean;
  /** What is missing or wrong. */
  error?: string;
  /** File types the system chooser offers. Default: PDF and images. */
  accept?: string;
  id?: string;
  className?: string;
}

/**
 * One document to upload. Choosing a file starts a short check and then shows it as verified, with
 * its name and size. The check is simulated: the file is not read, sent or kept. "Use a sample file"
 * lets someone presenting the prototype on a phone continue without a real document.
 */
export function FilePick({ label, hint, value, onChange, required = false, error, accept = DEFAULT_ACCEPT, id, className }: FilePickProps) {
  const t = useT(strings);
  const autoId = useId();
  const baseId = id ?? `${autoId}-file`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PickedFile | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The check ends about a second after the choice; by then the parent may have rendered again.
  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const check = (file: PickedFile) => {
    clearTimeout(timer.current);
    setPending(file);
    setAnnouncement(t('checking'));
    // Replace and Remove are hidden while the document is checked: keep the keyboard on this document.
    document.getElementById(`${baseId}-group`)?.focus();
    timer.current = setTimeout(() => {
      setPending(null);
      setAnnouncement(t('verified'));
      latestOnChange.current(file);
    }, FILE_CHECK_MS);
  };

  /** The choose button is there whenever no document is being checked. */
  const focusChoose = () => document.getElementById(`${baseId}-choose`)?.focus();

  const remove = () => {
    clearTimeout(timer.current);
    setPending(null);
    setAnnouncement(t('removed'));
    onChange(null);
    // The "remove" button is about to go: keep the keyboard on this document.
    focusChoose();
  };

  return (
    <>
      <FilePickView
        id={baseId}
        label={label}
        hint={hint}
        required={required}
        error={error}
        state={pending ? 'checking' : value ? 'verified' : 'empty'}
        file={pending ?? value}
        announcement={announcement}
        onChoose={() => inputRef.current?.click()}
        onSample={() => {
          check({ name: t('sampleName', { label }), size: SAMPLE_BYTES });
        }}
        onRemove={remove}
        className={className}
      />
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Only the name and the size are kept; clearing the input lets the same file be chosen again.
          event.target.value = '';
          if (file) check({ name: file.name, size: file.size });
        }}
      />
    </>
  );
}

export interface FilePickViewProps {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  state: FilePickState;
  file: PickedFile | null;
  /** The latest change of state, read out by screen readers. */
  announcement?: string;
  onChoose?: () => void;
  onSample?: () => void;
  onRemove?: () => void;
  className?: string;
}

/** What the document picker looks like in each state. `FilePick` adds the behaviour. */
export function FilePickView({ id, label, hint, required = false, error, state, file, announcement = '', onChoose, onSample, onRemove, className }: FilePickViewProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const chooseId = `${id}-choose`;
  const removeId = `${id}-remove`;
  const checking = state === 'checking';
  const describedBy = [error ? errorId : null, hint && !file ? hintId : null].filter(Boolean).join(' ') || undefined;
  const bytes = file?.size;
  const size = bytes === undefined ? '' : bytes >= 1_048_576 ? t('mb', { n: fmt.num(bytes / 1_048_576, 1) }) : t('kb', { n: fmt.num(Math.max(1, Math.round(bytes / 1024))) });

  return (
    <div id={`${id}-group`} tabIndex={-1} role="group" aria-labelledby={labelId} className={cx(styles.pick, error && state === 'empty' && styles.invalid, className)} data-state={state}>
      <span className={cx(styles.tile, state === 'verified' && styles.tileOk)} aria-hidden="true">
        {checking ? <span className={styles.spinner} /> : <Icon icon={state === 'verified' ? CircleCheck : FileText} size={22} />}
      </span>
      <div className={styles.body}>
        <p id={labelId} className={styles.label}>
          {label}
          {required ? (
            <>
              <span className={styles.required} aria-hidden="true">
                *
              </span>
              <span className="visually-hidden"> ({t('required')})</span>
            </>
          ) : null}
        </p>
        {file ? (
          <p className={styles.file}>
            <bdi className={styles.name}>{file.name}</bdi>
            {size ? (
              <span className={styles.size} data-num="">
                {size}
              </span>
            ) : null}
          </p>
        ) : hint ? (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
        {state !== 'empty' ? (
          <p className={cx(styles.status, state === 'verified' && styles.statusOk)}>
            <span>{checking ? t('checking') : t('verified')}</span>
          </p>
        ) : null}
        {error && state === 'empty' ? (
          <p id={errorId} className={styles.error}>
            <Icon icon={CircleAlert} size={16} strokeWidth={2} className={styles.statusIcon} />
            <span>{error}</span>
          </p>
        ) : null}
        {/* While the document is checked there is nothing to do: Replace and Remove appear once the check is done. */}
        {checking ? null : (
          <div className={cx(styles.actions, state !== 'empty' && styles.actionsFlush)}>
            <Button
              id={chooseId}
              size="sm"
              variant={state === 'empty' ? 'secondary' : 'quiet'}
              className={styles.action}
              aria-labelledby={`${chooseId} ${labelId}`}
              aria-describedby={describedBy}
              onClick={onChoose}
            >
              {state === 'empty' ? t('choose') : t('replace')}
            </Button>
            {state === 'empty' ? (
              <Button key="sample" size="sm" variant="quiet" className={styles.action} onClick={onSample}>
                {t('useSample')}
              </Button>
            ) : (
              <Button key="remove" id={removeId} size="sm" variant="quiet" className={styles.action} aria-labelledby={`${removeId} ${labelId}`} onClick={onRemove}>
                {t('remove')}
              </Button>
            )}
          </div>
        )}
        <span className="visually-hidden" role="status">
          {announcement}
        </span>
      </div>
    </div>
  );
}
