/**
 * The building renders: architectural scale models on a transparent background, one consistent series.
 * Files live in src/assets/renders (prepared by scripts/process-renders.py); sizes are the intrinsic pixels.
 */
import construction from '@/assets/renders/construction.webp';
import factory from '@/assets/renders/factory.webp';
import gate from '@/assets/renders/gate.webp';
import journey from '@/assets/renders/journey.webp';
import park from '@/assets/renders/park.webp';
import plot from '@/assets/renders/plot.webp';
import services from '@/assets/renders/services.webp';
import showroom from '@/assets/renders/showroom.webp';
import units from '@/assets/renders/units.webp';
import utilities from '@/assets/renders/utilities.webp';
import warehouse from '@/assets/renders/warehouse.webp';
import yard from '@/assets/renders/yard.webp';
import zone from '@/assets/renders/zone.webp';

export interface RenderAsset {
  src: string;
  width: number;
  height: number;
}

export const RENDERS = {
  /** A serviced land plot, kerbed and ready, nothing built yet. */
  plot: { src: plot, width: 1400, height: 874 },
  /** A steel frame going up under a tower crane. */
  construction: { src: construction, width: 1400, height: 1028 },
  /** A logistics warehouse with loading docks and trucks. */
  warehouse: { src: warehouse, width: 1400, height: 986 },
  /** A factory with a saw-tooth roof, silos and a stack. */
  factory: { src: factory, width: 1400, height: 984 },
  /** A two-storey showroom and office with a glazed front. */
  showroom: { src: showroom, width: 1400, height: 996 },
  /** A fenced open storage yard with containers. */
  yard: { src: yard, width: 1400, height: 1052 },
  /** A row of ready-built warehouse units. */
  units: { src: units, width: 1400, height: 995 },
  /** The entrance gate of a zone: canopy, booth and barriers. */
  gate: { src: gate, width: 1400, height: 773 },
  /** A business services pavilion with a glass front. */
  services: { src: services, width: 1400, height: 943 },
  /** A utilities compound: substation, water tank, mast. */
  utilities: { src: utilities, width: 1400, height: 1056 },
  /** A block of an industrial zone seen from above. */
  zone: { src: zone, width: 1400, height: 1043 },
  /** A logistics park: three warehouses around a truck court. */
  park: { src: park, width: 1400, height: 1011 },
  /** Four models in a row: plot, construction, working warehouse, gate. Wide. */
  journey: { src: journey, width: 2200, height: 579 },
} as const satisfies Record<string, RenderAsset>;

export type RenderName = keyof typeof RENDERS;
export const RENDER_NAMES = Object.keys(RENDERS) as RenderName[];
