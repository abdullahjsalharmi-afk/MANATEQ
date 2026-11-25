/** The pass types of the D2 data, as the app's pass kinds, with their glyphs. */
import { HardHat, Truck, UserRound, type LucideIcon } from 'lucide-react';
import type { Option, ServiceDetail } from '@/data/types';
import type { PassKind } from '@/domain/types';

export const KIND_ICON: Record<PassKind, LucideIcon> = { worker: HardHat, vehicle: Truck, visitor: UserRound };

const isKind = (value: string): value is PassKind => value === 'worker' || value === 'vehicle' || value === 'visitor';

/** Exactly the options of the D2 `passType` field that the wallet knows, in the data's order. */
export function passKinds(service: Pick<ServiceDetail, 'fields'>): { kind: PassKind; option: Option }[] {
  const options = service.fields.find((field) => field.key === 'passType')?.options ?? [];
  return options.flatMap((option) => (isKind(option.value) ? [{ kind: option.value, option }] : []));
}
