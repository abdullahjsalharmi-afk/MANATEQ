/**
 * Bilingual words the domain writes into what screens show (the next-step card). Screens read them
 * with `pick()` like any other data text.
 */
export const nextStepText = {
  payInvoice: { ar: 'ادفع فاتورة الإيجار', en: 'Pay your rent invoice' },
  payOverdue: { ar: 'ادفع الفاتورة المتأخرة', en: 'Pay the overdue invoice' },
  /** The one word for paying, everywhere a single invoice is paid. */
  pay: { ar: 'ادفع', en: 'Pay' },
  openRequest: { ar: 'افتح الطلب', en: 'Open request' },
  start: { ar: 'ابدأ', en: 'Start' },
  continueDraft: { ar: 'أكمل طلبك', en: 'Continue your request' },
  continue: { ar: 'تابع', en: 'Continue' },
  draftSaved: { ar: 'حفظنا ما أدخلته', en: 'We saved what you entered' },
} as const;
