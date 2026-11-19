import { useEffect, useState } from 'react';
import { getService, loadServiceDetail, peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail, ServiceId, ServiceSummary } from '@/data/types';

export interface ServiceState {
  /** The light record: available at once (undefined when the id is unknown). */
  summary: ServiceSummary | undefined;
  /** The full record: undefined while its domain file is loading. */
  detail: ServiceDetail | undefined;
  loading: boolean;
  failed: boolean;
}

/** Reads a service: the summary immediately, the full record as soon as its domain is loaded. */
export function useService(id: ServiceId | undefined): ServiceState {
  const summary = id ? getService(id) : undefined;
  const [detail, setDetail] = useState<ServiceDetail | undefined>(() => (id ? peekServiceDetail(id) : undefined));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!id || !getService(id)) {
      setDetail(undefined);
      return;
    }
    const cached = peekServiceDetail(id);
    setDetail(cached);
    if (!cached) {
      loadServiceDetail(id)
        .then((loaded) => {
          if (!cancelled) setDetail(loaded);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { summary, detail, loading: Boolean(summary) && !detail && !failed, failed };
}
