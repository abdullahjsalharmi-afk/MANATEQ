/** The words of the demo payment sheet. */
export const strings = {
  amountDue: { ar: 'المبلغ المستحق', en: 'Amount due' },
  method: { ar: 'طريقة الدفع', en: 'Payment method' },
  card: { ar: 'بطاقة بنكية', en: 'Bank card' },
  cardHint: { ar: 'بطاقة خصم أو ائتمان', en: 'Debit or credit card' },
  debit: { ar: 'خصم مباشر', en: 'Direct debit' },
  debitHint: { ar: 'من حساب الشركة البنكي', en: 'From the company’s bank account' },
  notice: { ar: 'محاكاة — لن يُخصم أي مبلغ', en: 'Simulation — nothing is charged' },
  pay: { ar: 'ادفع {amount}', en: 'Pay {amount}' },
  processing: { ar: 'جارٍ تنفيذ الدفع…', en: 'Processing the payment…' },
  paid: { ar: 'تم الدفع', en: 'Payment complete' },
  receipt: { ar: 'رقم الإيصال', en: 'Receipt number' },
  paidNote: { ar: 'هذه محاكاة: لم يُخصم أي مبلغ.', en: 'This is a simulation: nothing was charged.' },
  done: { ar: 'تم', en: 'Done' },
  close: { ar: 'إغلاق', en: 'Close' },
} as const;
