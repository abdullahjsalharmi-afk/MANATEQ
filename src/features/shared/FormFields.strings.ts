/** Words of the shared form renderer (`FormFields`): validation messages, picker hints and empty values. */
export const formStrings = {
  // Required, by kind of control. {label} is the field's own label.
  chooseLabel: { ar: 'اختر {label}', en: 'Choose the {label}' },
  enterLabel: { ar: 'أدخل {label}', en: 'Enter the {label}' },
  attachLabel: { ar: 'أرفق {label}', en: 'Attach the {label}' },
  addPhoto: { ar: 'أضف {label}', en: 'Add the {label}' },
  // When the label is itself a question.
  chooseAnswer: { ar: 'اختر إجابة', en: 'Choose an answer' },
  writeAnswer: { ar: 'اكتب إجابتك', en: 'Write your answer' },
  confirmToContinue: { ar: 'أكّد هذا البند للمتابعة', en: 'Confirm this to continue' },
  enterName: { ar: 'أدخل الاسم', en: 'Enter a name' },

  // Sanity checks.
  positive: { ar: 'أدخل رقمًا أكبر من صفر', en: 'Enter a number above zero' },
  wholeNumber: { ar: 'أدخل عددًا صحيحًا', en: 'Enter a whole number' },
  tooLarge: { ar: 'هذا الرقم أكبر من المعتاد، راجعه', en: 'This number is larger than expected. Check it' },
  validDate: { ar: 'اختر تاريخًا صحيحًا', en: 'Choose a valid date' },
  dateTooFar: { ar: 'اختر تاريخًا خلال السنوات الخمس القادمة', en: 'Choose a date within the next five years' },
  validPhone: { ar: 'أدخل رقم هاتف من 8 أرقام على الأقل', en: 'Enter a phone number of at least 8 digits' },
  tooShort: { ar: 'أضف تفاصيل أكثر قليلًا', en: 'Add a little more detail' },

  // Pickers.
  noPlots: { ar: 'لا توجد قطع مسجّلة باسم شركتك بعد', en: 'No plots are registered to your company yet' },
  landZone: { ar: 'أرض · {type}', en: 'Land · {type}' },
  warehousingPark: { ar: 'مجمّع مستودعات', en: 'Warehousing park' },
  activityHint: { ar: 'ابحث بالاسم أو بالقطاع', en: 'Search by name or sector' },
  activityFree: { ar: 'اكتب النشاط كما في سجلك التجاري', en: 'Write the activity as it appears in your commercial registration' },

  // The person control.
  personName: { ar: 'الاسم', en: 'Name' },
  personId: { ar: 'الرقم الشخصي', en: 'QID number' },
  personPhone: { ar: 'رقم الهاتف', en: 'Phone number' },
  optional: { ar: 'اختياري', en: 'Optional' },

  // Values on the review page.
  yes: { ar: 'نعم', en: 'Yes' },
  no: { ar: 'لا', en: 'No' },
  notGiven: { ar: 'لم تُضف', en: 'Not added' },
  photoAdded: { ar: 'صورة مرفقة', en: 'Photo attached' },
} as const;
