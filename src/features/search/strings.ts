/** UI strings of global search. */
export const strings = {
  title: { ar: 'البحث', en: 'Search' },
  back: { ar: 'الخدمات', en: 'Services' },
  label: { ar: 'ماذا تريد أن تنجز؟', en: 'What do you want to get done?' },
  tryLabel: { ar: 'جرّب', en: 'Try' },
  recent: { ar: 'شاهدتها مؤخرًا', en: 'Recently viewed' },
  services: { ar: 'خدمات', en: 'Services' },
  zones: { ar: 'مناطق', en: 'Zones' },
  requests: { ar: 'طلباتي', en: 'My requests' },
  plots: { ar: 'قطعي', en: 'My plots' },
  payments: { ar: 'المدفوعات', en: 'Payments' },
  documents: { ar: 'وثائقي', en: 'Documents' },
  plotLine: { ar: '{zone} · {area}', en: '{zone} · {area}' },
  found: { ar: 'نتائج «{q}»: {n}', en: 'Results for “{q}”: {n}' },
  noResults: { ar: 'لا نتائج لـ «{q}»', en: 'No results for “{q}”' },
  noResultsBody: { ar: 'جرّب كلمة أخرى، أو صِف ما تحتاجه لمركز خدمات الأعمال وسنرشدك.', en: 'Try another word, or tell the Business Services Center what you need and we will guide you.' },
  getHelp: { ar: 'اطلب مساعدة', en: 'Get help' },
  browse: { ar: 'تصفّح كل الخدمات', en: 'Browse all services' },
  intentPay: { ar: 'ادفع فاتورة', en: 'Pay an invoice' },
  intentPass: { ar: 'تصريح دخول', en: 'Gate pass' },
  intentMaintenance: { ar: 'أبلغ عن عطل', en: 'Report a fault' },
  intentCertificate: { ar: 'شهادة', en: 'Certificate' },
  intentRenewal: { ar: 'تجديد العقد', en: 'Lease renewal' },
  intentPermit: { ar: 'رخصة البناء', en: 'Building permit' },
} as const;

/**
 * Words an investor types for their own records, in both languages, so «فاتورة» finds the invoice and
 * «تصريح دخول» the passes. Searched, never shown.
 */
export const keywords = {
  plot: { ar: 'قطعة أرض قطعي', en: 'plot land my plots' },
  invoice: { ar: 'فاتورة فواتير مدفوعات', en: 'invoice invoices payments' },
  invoiceDue: { ar: 'ادفع سداد مستحقات مستحقة', en: 'pay payment due' },
  document: { ar: 'وثيقة وثائقي', en: 'document documents' },
  pass: { ar: 'تصريح دخول', en: 'gate pass' },
  visitor: { ar: 'زائر', en: 'visitor' },
  worker: { ar: 'عامل', en: 'worker' },
  vehicle: { ar: 'مركبة', en: 'vehicle' },
} as const;

/** "3 نتائج" / "3 results". */
export const resultsCount = {
  ar: { one: 'نتيجة واحدة', two: 'نتيجتان', few: '{n} نتائج', many: '{n} نتيجة', other: '{n} نتيجة' },
  en: { one: '{n} result', other: '{n} results' },
};
