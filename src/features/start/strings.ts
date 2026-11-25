/** Words of the "start a service" flow and of the pieces it lends to the bespoke flows. */
export const strings = {
  // The frame.
  stepOf: { ar: 'الخطوة {n} من {m}', en: 'Step {n} of {m}' },
  closeFlow: { ar: 'إغلاق الطلب', en: 'Close the request' },
  continue: { ar: 'متابعة', en: 'Continue' },
  backToReview: { ar: 'العودة إلى المراجعة', en: 'Back to review' },
  draftSaved: { ar: 'حُفظت مسودتك', en: 'Draft saved' },
  loading: { ar: 'جارٍ تحميل الخدمة', en: 'Loading the service' },

  // Page 1: what we already know.
  knownTitle: { ar: 'نعرفك مسبقًا', en: 'We already know you' },
  knownLead: { ar: 'لن نطلب منك هذه البيانات. نجلبها من مصادرها الموثّقة.', en: 'We will not ask you for this information. We fetch it from its verified sources.' },
  verified: { ar: 'موثّق', en: 'Verified' },
  cr: { ar: 'السجل التجاري', en: 'Commercial registration' },
  signatory: { ar: 'المفوّض بالتوقيع', en: 'Authorised signatory' },
  activity: { ar: 'النشاط', en: 'Activity' },
  plot: { ar: 'القطعة', en: 'Plot' },
  zone: { ar: 'المنطقة', en: 'Zone' },
  fetchedTitle: { ar: 'نجلبها عنك', en: 'We fetch for you' },
  companyLabel: { ar: 'شركتك', en: 'Your company' },

  // Pages 2…n.
  detailsTitle: { ar: 'التفاصيل', en: 'The details' },
  detailsLead: { ar: 'أسئلة قليلة عن طلبك.', en: 'A few questions about your request.' },
  documentsTitle: { ar: 'الوثائق', en: 'Documents' },
  documentsLead: { ar: 'أرفق كل وثيقة، ونتحقق منها فور رفعها.', en: 'Attach each document. We check it as soon as it is added.' },
  fixErrors: { ar: 'راجع الحقول المحددة قبل المتابعة.', en: 'Check the marked fields before you continue.' },

  // Review.
  reviewTitle: { ar: 'راجِع وأرسِل', en: 'Check and send' },
  reviewLead: { ar: 'تأكد من إجاباتك، ثم أرسل الطلب.', en: 'Check your answers, then send the request.' },
  yourAnswers: { ar: 'إجاباتك', en: 'Your answers' },
  noAnswers: { ar: 'لا نحتاج منك أي تفاصيل أخرى لهذا الطلب.', en: 'We need nothing else from you for this request.' },
  edit: { ar: 'تعديل', en: 'Change' },
  editLabel: { ar: 'تعديل {label}', en: 'Change {label}' },
  notGiven: { ar: 'لم تُضف', en: 'Not added' },
  receives: { ar: 'ما تحصل عليه', en: 'What you will receive' },
  standard: { ar: 'معيار الخدمة', en: 'Service standard' },
  indicative: { ar: 'استرشادي', en: 'Indicative' },
  consent: {
    ar: 'أؤكد أن المعلومات صحيحة، وأوافق على مشاركتها مع الجهات المعنية بهذه الخدمة.',
    en: 'I confirm the information is correct and agree to share it with the entities involved in this service.',
  },
  consentError: { ar: 'أكّد صحة المعلومات لإرسال الطلب', en: 'Confirm the information to send the request' },
  submit: { ar: 'أرسِل الطلب', en: 'Send request' },

  // Submitted.
  submittedName: { ar: 'تم الاستلام', en: 'Received' },
  submittedHeadline: { ar: 'تم استلام طلبك', en: 'Request received' },
  reference: { ar: 'رقم الطلب', en: 'Request number' },
  copyReference: { ar: 'انسخ رقم الطلب {ref}', en: 'Copy request number {ref}' },
  copied: { ar: 'نُسخ رقم الطلب', en: 'Request number copied' },
  whatNext: { ar: 'ماذا يحدث الآن', en: 'What happens now' },
  whatNextHint: { ar: 'أول خطوات طلبك ومن يتولاها.', en: 'The first steps of your request and who holds them.' },
  nextLabel: { ar: 'الخطوات التالية', en: 'Next steps' },
  track: { ar: 'تتبّع الطلب', en: 'Track request' },
  goHome: { ar: 'العودة إلى الرئيسية', en: 'Back to Home' },
  simulated: { ar: 'في هذه النسخة التجريبية تتقدم الخطوات تلقائيًا للعرض.', en: 'In this prototype the steps move forward by themselves, for demonstration.' },

  // Leaving.
  leaveTitle: { ar: 'هل تحتفظ بما أدخلته؟', en: 'Keep what you entered?' },
  leaveBody: { ar: 'نحفظ مسودتك لتكمل لاحقًا من حيث توقفت.', en: 'We keep your draft so you can continue later where you left off.' },
  later: { ar: 'متابعة لاحقًا', en: 'Continue later' },
  discard: { ar: 'تجاهل', en: 'Discard' },

  // States.
  notFoundTitle: { ar: 'لم نجد هذه الخدمة', en: 'We could not find this service' },
  notFoundBody: { ar: 'ربما تغيّر الرابط. تصفّح الخدمات وابدأ من هناك.', en: 'The link may have changed. Browse the services and start from there.' },
  browse: { ar: 'تصفّح الخدمات', en: 'Browse services' },
  notStartableTitle: { ar: 'تبدأ هذه الخدمة دون طلب منك', en: 'This service starts without a request' },
  openService: { ar: 'اعرض صفحة الخدمة', en: 'View the service' },
  failedTitle: { ar: 'تعذّر تحميل الخدمة', en: 'The service could not be loaded' },
  failedBody: { ar: 'تحقق من الاتصال ثم حاول مرة أخرى.', en: 'Check your connection, then try again.' },
  tryAgain: { ar: 'حاول مرة أخرى', en: 'Try again' },
} as const;
