import { Camera, CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './PhotoPick.module.css';
import { strings } from './strings';

/** All the app keeps of a photo: its name and an id. The image itself stays on the device. */
export interface PickedPhoto {
  name: string;
  id?: string;
}

/** The id of the generated stand-in that "Use a sample photo" produces. */
export const SAMPLE_PHOTO_ID = 'sample';

export interface PhotoPickProps {
  /** What the photo shows, e.g. "صورة العطل". Pass translated text. */
  label: string;
  hint?: string;
  value: PickedPhoto | null;
  onChange: (value: PickedPhoto | null) => void;
  required?: boolean;
  /** What is missing or wrong. */
  error?: string;
  /** Which camera a phone opens; `false` offers the photo library instead. Default: the rear camera. */
  capture?: 'environment' | 'user' | false;
  id?: string;
  className?: string;
}

interface Preview {
  id: string;
  url: string;
}

function newPhotoId(): string {
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * One photo, taken with the camera or chosen from the device. The thumbnail is an object URL that
 * lives only while this component does; nothing is uploaded. "Use a sample photo" puts a neutral
 * drawing in its place so the prototype can be presented without a camera.
 */
export function PhotoPick({ label, hint, value, onChange, required = false, error, capture = 'environment', id, className }: PhotoPickProps) {
  const t = useT(strings);
  const autoId = useId();
  const baseId = id ?? `${autoId}-photo`;
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<Preview | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const replacePreview = (next: Preview | null) => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
    previewRef.current = next;
    setPreview(next);
  };

  // Release the image when the picker goes away.
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current.url);
      previewRef.current = null;
    },
    [],
  );

  const add = (photo: PickedPhoto, next: Preview | null) => {
    replacePreview(next);
    setAnnouncement(t('added'));
    onChange(photo);
  };

  const onFile = (file: File) => {
    const photoId = newPhotoId();
    let url: string | null = null;
    try {
      url = URL.createObjectURL(file);
    } catch {
      /* No preview here: the picker shows the stand-in drawing instead. */
    }
    add({ name: file.name, id: photoId }, url ? { id: photoId, url } : null);
  };

  const remove = () => {
    replacePreview(null);
    setAnnouncement(t('removed'));
    onChange(null);
    document.getElementById(`${baseId}-choose`)?.focus();
  };

  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;
  const chooseId = `${baseId}-choose`;
  const removeId = `${baseId}-remove`;
  const src = value && preview && preview.id === value.id ? preview.url : null;
  const invalid = Boolean(error) && !value;
  const describedBy = [invalid ? errorId : null, hint && !value ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div role="group" aria-labelledby={labelId} className={cx(styles.pick, invalid && styles.invalid, className)}>
      <span className={cx(styles.thumb, value && styles.thumbFilled)} aria-hidden="true">
        {value ? src ? <img src={src} alt="" className={styles.image} /> : <StandIn /> : <Icon icon={Camera} size={24} />}
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
        {value ? (
          <p className={styles.file}>
            <bdi className={styles.name}>{value.name}</bdi>
          </p>
        ) : hint ? (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
        {invalid ? (
          <p id={errorId} className={styles.error}>
            <Icon icon={CircleAlert} size={16} strokeWidth={2} className={styles.errorIcon} />
            <span>{error}</span>
          </p>
        ) : null}
        <div className={cx(styles.actions, value && styles.actionsFlush)}>
          <Button id={chooseId} size="sm" variant={value ? 'quiet' : 'secondary'} className={styles.action} aria-labelledby={`${chooseId} ${labelId}`} aria-describedby={describedBy} onClick={() => inputRef.current?.click()}>
            {value ? t('replace') : capture ? t('take') : t('choose')}
          </Button>
          {value ? (
            <Button id={removeId} size="sm" variant="quiet" className={styles.action} aria-labelledby={`${removeId} ${labelId}`} onClick={remove}>
              {t('remove')}
            </Button>
          ) : (
            <Button size="sm" variant="quiet" className={styles.action} onClick={() => add({ name: t('sampleName'), id: SAMPLE_PHOTO_ID }, null)}>
              {t('useSample')}
            </Button>
          )}
        </div>
        <span className="visually-hidden" role="status">
          {announcement}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="image/*"
        capture={capture || undefined}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

/** A neutral line drawing that stands in for a photo: a horizon, two hills and a sun. */
function StandIn() {
  return (
    <svg className={styles.standIn} viewBox="0 0 64 64" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <circle cx="45" cy="19" r="5.5" />
      <path d="M-2 49 17 30l12 12 9-8 28 23" />
      <path d="M-2 57h68" opacity="0.5" />
    </svg>
  );
}
