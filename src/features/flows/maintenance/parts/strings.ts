/** Strings shared by the three in-zone flows (maintenance, gate pass, emergency). */
export const partsStrings = {
  reference: { ar: 'الرقم المرجعي', en: 'Reference' },
  stepOf: { ar: 'الخطوة {n} من {m}', en: 'Step {n} of {m}' },
  back: { ar: 'الخطوة السابقة', en: 'Previous step' },
  close: { ar: 'إغلاق', en: 'Close' },
  edit: { ar: 'تعديل', en: 'Edit' },
  loading: { ar: 'جارٍ التحميل', en: 'Loading' },
  failedTitle: { ar: 'تعذّر فتح الخدمة', en: 'The service could not be opened' },
  failedBody: { ar: 'تحقّق من الاتصال وحاول مرة أخرى.', en: 'Check the connection and try again.' },
  retry: { ar: 'حاول مرة أخرى', en: 'Try again' },
  indicative: { ar: 'استرشادي', en: 'Indicative' },
  plotIn: { ar: '{plot} · {zone}', en: '{plot} · {zone}' },
} as const;
