import type { PluralForms } from '@/app/i18n';

export const strings = {
  title: { ar: 'المدفوعات', en: 'Payments' },
  subtitle: { ar: 'الفواتير والإيصالات وكشف الحساب.', en: 'Invoices, receipts and your statement.' },
  loading: { ar: 'جارٍ تحميل المدفوعات', en: 'Loading payments' },

  // Summary
  totalDue: { ar: 'المستحق عليك', en: 'Total due' },
  nextDue: { ar: 'أقرب استحقاق {date}', en: 'Next due {date}' },
  overdueCount: { ar: 'منها متأخر', en: 'Overdue' },
  allClear: { ar: 'لا مستحقات', en: 'Nothing due' },
  allClearBody: { ar: 'سُدّدت كل فواتيرك. تصلك الفاتورة التالية هنا قبل موعدها.', en: 'Every invoice is paid. The next one arrives here before it is due.' },

  // Sections
  due: { ar: 'مستحقة', en: 'Due' },
  statement: { ar: 'كشف الحساب', en: 'Statement' },
  statementHint: { ar: 'الفواتير المدفوعة وإيصالاتها.', en: 'Paid invoices and their receipts.' },
  issue: { ar: 'أصدِر كشفًا أو شهادة', en: 'Get a statement or certificate' },
  noHistory: { ar: 'لا مدفوعات بعد', en: 'No payments yet' },
  noHistoryBody: { ar: 'يظهر هنا كل ما تدفعه مع إيصاله.', en: 'Everything you pay appears here with its receipt.' },
  monthTotal: { ar: 'المجموع {amount}', en: 'Total {amount}' },
  nothing: { ar: 'لا فواتير', en: 'No invoices' },
  nothingBody: { ar: 'تظهر فواتير الإيجار والخدمات هنا عند إصدارها.', en: 'Rent and service invoices appear here when they are issued.' },
  explore: { ar: 'اعرض الحلول والأسعار', en: 'See solutions and prices' },

  // Due lines
  paidOn: { ar: 'دُفع في {date}', en: 'Paid on {date}' },
  dueToday: { ar: 'يستحق اليوم', en: 'Due today' },
  dueOn: { ar: 'يستحق في {date}', en: 'Due on {date}' },

  // Actions
  pay: { ar: 'ادفع', en: 'Pay' },
  payAmount: { ar: 'ادفع {amount}', en: 'Pay {amount}' },
  payLabel: { ar: 'ادفع {title}', en: 'Pay {title}' },
  sheetTitle: { ar: 'ادفع الفاتورة', en: 'Pay the invoice' },
  paidToast: { ar: 'تم الدفع. حُفظ الإيصال في وثائقك.', en: 'Paid. The receipt is in your documents.' },
  viewReceipt: { ar: 'عرض الإيصال', en: 'View receipt' },

  // Invoice page
  invoice: { ar: 'فاتورة', en: 'Invoice' },
  reference: { ar: 'رقم الفاتورة', en: 'Invoice number' },
  lease: { ar: 'عقد الإيجار', en: 'Lease' },
  plot: { ar: 'القطعة', en: 'Plot' },
  request: { ar: 'الطلب', en: 'Request' },
  issued: { ar: 'تاريخ الإصدار', en: 'Issued' },
  dueDate: { ar: 'تاريخ الاستحقاق', en: 'Due date' },
  paidDate: { ar: 'تاريخ الدفع', en: 'Paid on' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  status: { ar: 'الحالة', en: 'Status' },
  stDue: { ar: 'مستحقة', en: 'Due' },
  stOverdue: { ar: 'متأخرة', en: 'Overdue' },
  stPaid: { ar: 'مدفوعة', en: 'Paid' },
  receipt: { ar: 'الإيصال', en: 'Receipt' },
  details: { ar: 'التفاصيل', en: 'Details' },
  issuer: { ar: 'مناطق', en: 'Manateq' },
  simNote: { ar: 'الدفع في هذا النموذج محاكاة: لا تُطلب بيانات بطاقة ولا يُخصم أي مبلغ.', en: 'Payment in this prototype is a simulation: no card details are asked for and nothing is charged.' },
  notFound: { ar: 'لم نجد هذه الفاتورة', en: 'We could not find this invoice' },
  notFoundBody: { ar: 'ربما أُعيد ضبط النموذج أو أن الرابط غير مكتمل.', en: 'The prototype may have been reset, or the link is incomplete.' },
  toPayments: { ar: 'افتح المدفوعات', en: 'Open payments' },
} as const;

export const plurals = {
  dueIn: {
    ar: { one: 'يستحق غدًا', two: 'يستحق خلال يومين', few: 'يستحق خلال {n} أيام', many: 'يستحق خلال {n} يومًا', other: 'يستحق خلال {n} يوم' },
    en: { one: 'Due tomorrow', other: 'Due in {n} days' },
  },
  overdue: {
    ar: { one: 'متأخر منذ يوم', two: 'متأخر منذ يومين', few: 'متأخر منذ {n} أيام', many: 'متأخر منذ {n} يومًا', other: 'متأخر منذ {n} يوم' },
    en: { one: 'Overdue by 1 day', other: 'Overdue by {n} days' },
  },
  invoices: {
    ar: { one: 'فاتورة واحدة', two: 'فاتورتان', few: '{n} فواتير', many: '{n} فاتورة', other: '{n} فاتورة' },
    en: { one: '1 invoice', other: '{n} invoices' },
  },
} satisfies Record<string, PluralForms>;
