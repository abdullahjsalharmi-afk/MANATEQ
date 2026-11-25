import type { RenderName } from './renders';

/** What each render shows, for people who do not see it. */
export const renderAlt: Record<RenderName, { ar: string; en: string }> = {
  plot: { ar: 'مجسّم قطعة أرض مخدومة وجاهزة للبناء', en: 'Model of a serviced land plot, ready to build on' },
  construction: { ar: 'مجسّم مبنى صناعي قيد الإنشاء تعلوه رافعة برجية', en: 'Model of an industrial building under construction with a tower crane' },
  warehouse: { ar: 'مجسّم مستودع لوجستي بأرصفة تحميل وشاحنتين', en: 'Model of a logistics warehouse with loading docks and two trucks' },
  factory: { ar: 'مجسّم مصنع بسقف مسنَّن وصوامع ومبنى إداري', en: 'Model of a factory with a saw-tooth roof, silos and an office block' },
  showroom: { ar: 'مجسّم معرض ومكاتب بواجهة زجاجية ومواقف', en: 'Model of a showroom and offices with a glazed front and parking' },
  yard: { ar: 'مجسّم ساحة تخزين مفتوحة مسوَّرة فيها حاويات', en: 'Model of a fenced open storage yard with containers' },
  units: { ar: 'مجسّم صف من وحدات التخزين الجاهزة', en: 'Model of a row of ready-built warehouse units' },
  gate: { ar: 'مجسّم بوابة المنطقة بمظلتها وحواجزها', en: 'Model of a zone entrance gate with its canopy and barriers' },
  services: { ar: 'مجسّم مركز خدمات الأعمال بواجهة زجاجية', en: 'Model of the Business Services Center building with a glass front' },
  utilities: { ar: 'مجسّم مجمّع المرافق: محطة كهرباء وخزان مياه وبرج اتصالات', en: 'Model of a utilities compound: substation, water tank and mast' },
  zone: { ar: 'مجسّم مخطط منطقة صناعية بشوارعها ومبانيها', en: 'Model of an industrial zone block with its streets and buildings' },
  park: { ar: 'مجسّم مجمّع لوجستي من ثلاثة مستودعات حول ساحة شاحنات', en: 'Model of a logistics park: three warehouses around a truck court' },
  journey: { ar: 'أربعة مجسّمات متتالية: قطعة أرض، ثم إنشاء، ثم مستودع يعمل، ثم بوابة', en: 'Four models in a row: a plot, construction, a working warehouse, then a gate' },
};
