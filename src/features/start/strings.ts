/** Words of the "start a service" flow and of the pieces it lends to the bespoke flows. */
export const strings = {
  // The frame.
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
  plotHelp: { ar: 'القطعة التي يخصها هذا الطلب.', en: 'The plot this request is for.' },
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
  reference: { ar: 'الرقم المرجعي', en: 'Reference' },
  copyReference: { ar: 'انسخ الرقم المرجعي {ref}', en: 'Copy reference {ref}' },
  copied: { ar: 'نُسخ الرقم المرجعي', en: 'Reference copied' },
  whatNext: { ar: 'ماذا يحدث الآن', en: 'What happens now' },
  whatNextHint: { ar: 'أول خطوات طلبك ومن يتولاها.', en: 'The first steps of your request and who holds them.' },
  whatDone: { ar: 'ما جرى حتى الآن', en: 'What has happened so far' },
  byItself: { ar: 'يُنجَز طلبك تلقائيًا، ونُعلمك حين يكتمل.', en: 'Your request is completed automatically. We will tell you when it is done.' },
  nextLabel: { ar: 'الخطوات التالية', en: 'Next steps' },
  track: { ar: 'تتبّع الطلب', en: 'Track request' },
  goHome: { ar: 'العودة إلى الرئيسية', en: 'Back to Home' },
  appointmentTitle: { ar: 'موعدك', en: 'Your appointment' },
  appointmentWhen: { ar: '{date}، الساعة {time}', en: '{date}, {time}' },
  appointmentWhere: {
    ar: '{channel}. تجده في «الدعم» ضمن «مواعيدك القادمة»، ويمكنك إلغاؤه من هناك.',
    en: '{channel}. It is listed under Support, in Your upcoming appointments, where you can cancel it.',
  },
  appointmentOpen: { ar: 'اعرض مواعيدك', en: 'View your appointments' },
  channelInPerson: { ar: 'في مركز خدمات الأعمال', en: 'At the Business Services Center' },
  channelVideo: { ar: 'بالفيديو', en: 'By video' },
  channelPhone: { ar: 'بالهاتف', en: 'By phone' },
  simulated: { ar: 'في هذه النسخة التجريبية تتقدم الخطوات تلقائيًا للعرض.', en: 'In this prototype the steps move forward by themselves, for demonstration.' },

  // Leaving.
  leaveTitle: { ar: 'هل تحتفظ بما أدخلته؟', en: 'Keep what you entered?' },
  leaveBody: { ar: 'نحفظ مسودتك لتكمل لاحقًا من حيث توقفت.', en: 'We keep your draft so you can continue later where you left off.' },
  later: { ar: 'متابعة لاحقًا', en: 'Continue later' },
  discard: { ar: 'احذف المسودة', en: 'Delete draft' },

  // States.
  notFoundName: { ar: 'خدمة غير موجودة', en: 'Service not found' },
  notFoundTitle: { ar: 'لم نجد هذه الخدمة', en: 'We could not find this service' },
  notFoundBody: { ar: 'ربما تغيّر الرابط. تصفّح الخدمات وابدأ من هناك.', en: 'The link may have changed. Browse the services and start from there.' },
  browse: { ar: 'تصفّح الخدمات', en: 'Browse services' },
  notStartableTitle: { ar: 'تبدأ هذه الخدمة دون طلب منك', en: 'This service starts without a request' },
  openService: { ar: 'اعرض صفحة الخدمة', en: 'View the service' },

  // A service for a leased plot, opened by a company that holds none.
  needsPlotTitle: { ar: 'تُفتح هذه الخدمة بعد استئجار قطعة', en: 'This service opens once you lease a plot' },
  needsPlotBody: {
    ar: 'تُطلب لقطعة تستأجرها شركتك، ولا قطعة مسجلة لشركتك بعد.',
    en: 'It is requested for a plot your company leases, and no plot is registered to your company yet.',
  },
  needsPlotNoneTitle: { ar: 'لا قطعة تحتاج هذه الخدمة الآن', en: 'None of your plots needs this service now' },
  needsPlotNoneBody: {
    ar: 'تُطلب لقطعة في مرحلة معيّنة من رحلتها، وقطعك تجاوزت هذه المرحلة.',
    en: 'It is requested for a plot at one stage of its journey, and your plots are past that stage.',
  },
  trackLand: { ar: 'تابِع طلب الأرض', en: 'Follow your land application' },
  applyLand: { ar: 'قدّم على أرض', en: 'Apply for land' },
  checkFirst: { ar: 'افحص أهلية نشاطك', en: 'Check your eligibility' },
  viewPlots: { ar: 'اعرض قطعك', en: 'View your plots' },
  failedTitle: { ar: 'تعذّر تحميل الخدمة', en: 'The service could not be loaded' },
  failedBody: { ar: 'تحقق من الاتصال ثم حاول مرة أخرى.', en: 'Check your connection, then try again.' },
  tryAgain: { ar: 'حاول مرة أخرى', en: 'Try again' },
} as const;
