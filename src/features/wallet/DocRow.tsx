// CONTRACT STUB — the wallet feature replaces the bodies, not the props.
import { Row } from '@/design/core';
import type { Doc, Pass } from '@/domain/types';

/** One document in a list. Links to the document viewer. */
export function DocRow({ doc }: { doc: Doc }) {
  return <Row to={`/account/wallet/${doc.id}`} title={doc.title.ar} subtitle={doc.ref} />;
}

/** One gate pass in a list. Links to the pass viewer. */
export function PassRow({ pass }: { pass: Pass; now: number }) {
  return <Row to={`/account/wallet/${pass.id}`} title={pass.holder} subtitle={pass.code} />;
}
