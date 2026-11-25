/**
 * The confirmation of a land application: the shared confirmation of every start flow, with the land
 * application's own headline. What happens now (the current step and who holds it) is read from the request
 * itself, exactly as the request page it links to reads it, never from a fixed text.
 */
import { useT } from '@/app/i18n';
import { SubmittedState } from '@/features/start/SubmittedState';
import { strings } from './strings';

export function Submitted({ requestId }: { requestId: string }) {
  const t = useT(strings);
  return <SubmittedState requestId={requestId} headline={t('received')} tagline={t('receivedTagline')} />;
}
