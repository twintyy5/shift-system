const config = window.APP_CONFIG;

const clinicKeys = ["boulevard", "science", "marina", "promenade", "courts", "other"];
const sessionKey = "assignment-app-session-v4";
const sessionSnapshotKey = `${sessionKey}-snapshot`;
const apiRequestCache = new Map();
const pendingApiRequests = new Map();
const apiCacheTtls = {
  restoreSession: 5 * 60 * 1000,
  adminListUsers: 3 * 60 * 1000
};
const entryColorPresets = [
  { key: "", start: "#475569", end: "#334155", text: "#f8fafc", ring: "rgba(148, 163, 184, 0.42)" },
  { key: "red", start: "#fb7185", end: "#dc2626", text: "#fff1f2", ring: "rgba(251, 113, 133, 0.48)" },
  { key: "blue", start: "#60a5fa", end: "#2563eb", text: "#eff6ff", ring: "rgba(96, 165, 250, 0.48)" },
  { key: "yellow", start: "#fde047", end: "#f59e0b", text: "#1f2937", ring: "rgba(253, 224, 71, 0.5)" },
  { key: "green", start: "#34d399", end: "#059669", text: "#ecfdf5", ring: "rgba(52, 211, 153, 0.48)" },
  { key: "purple", start: "#c084fc", end: "#7c3aed", text: "#faf5ff", ring: "rgba(192, 132, 252, 0.48)" }
];

const translations = {
  ar: {
    appTagline: "إدارة الشفتات والتكاليف",
    loading: "جاري تحميل الجلسة...",
    login: "تسجيل الدخول",
    register: "إنشاء حساب جديد",
    username: "اسم المستخدم",
    password: "كلمة السر",
    employeeId: "رقم م.ط.ط",
    shift: "الشفت",
    shiftA: "شفت A",
    shiftB: "شفت B",
    shiftC: "شفت C",
    shiftM: "شفت M",
    forgotPassword: "نسيت كلمة السر؟",
    settings: "الإعدادات",
    logout: "تسجيل الخروج",
    addAssignment: "إضافة تكليف",
    addGuard: "إضافة خفارة",
    deleteAssignment: "حذف عنصر",
    deleteAssignmentMenu: "حذف تكليف",
    calendar: "التقويم",
    totalAssignments: "مجموع أيام التكاليف",
    totalGuards: "مجموع الخفارات",
    totalAmount: "المبلغ المستحق",
    dinar: "د.ك",
    support: "الدعم الفني",
    changeLanguage: "تغيير اللغة",
    changeShift: "تغيير الشفت",
    changePassword: "تغيير كلمة السر",
    changeUsername: "تغيير اسم المستخدم",
    clearData: "مسح جميع البيانات",
    save: "حفظ",
    cancel: "إلغاء",
    date: "التاريخ",
    assignmentName: "اسم التكليف",
    assignmentTime: "وقت التكليف",
    notes: "ملاحظات",
    reminder: "التذكير",
    exportReminder: "تصدير تذكير",
    night: "ليلي (N)",
    morning: "صباحي (A)",
    other: "أخرى",
    clinicBoulevard: "عيادة البوليفارد",
    clinicScience: "عيادة المركز العلمي",
    clinicMarina: "عيادة المارينا",
    clinicPromenade: "عيادة البروميناد",
    clinicCourts: "عيادة مجمع المحاكم",
    confirm: "تأكيد",
    delete: "حذف",
    edit: "تعديل",
    editAssignmentMenu: "تعديل تكليف",
    dutyDay: "يوم دوام",
    dayOff: "يوم راحة",
    assignmentDay: "يوم تكليف",
    guardDay: "يوم خفارة",
    mixedDay: "تكليف + خفارة",
    selectDate: "اختر التاريخ",
    usernameExists: "اسم المستخدم موجود بالفعل",
    employeeIdExists: "رقم م.ط.ط موجود بالفعل",
    invalidCredentials: "اسم المستخدم أو كلمة السر غير صحيحة",
    fieldsRequired: "جميع الحقول مطلوبة",
    onlyEnglish: "يجب استخدام الأحرف الإنجليزية فقط",
    noWeekendAssignments: "لا يمكن إضافة تكاليف أو خفارات يومي الجمعة والسبت",
    noDutyAssignments: "لا يمكن إضافة تكليف في يوم دوام",
    assignmentUpdated: "تم تعديل العنصر بنجاح",
    assignmentDeleted: "تم حذف العنصر",
    passwordUpdated: "تم تغيير كلمة السر بنجاح",
    accountCreated: "تم إنشاء الحساب بنجاح",
    assignmentAdded: "تمت إضافة العنصر بنجاح",
    dataCleared: "تم مسح البيانات",
    noAssignments: "لا توجد عناصر مسجلة",
    saveFailed: "تعذر حفظ التغييرات، حاول مرة أخرى",
    customNameRequired: "اكتب اسم العنصر",
    customTimeRequired: "حدد وقت العنصر",
    duplicateAssignment: "يوجد عنصر مسجل لنفس اليوم والنوع",
    reconnect: "أعد تسجيل الدخول ثم حاول مرة أخرى",
    sessionExpired: "انتهت الجلسة، سجل الدخول من جديد",
    adminDisabled: "وضع الإدارة متاح الآن من خلال حساب admin",
    dayDetails: "تفاصيل اليوم",
    noItemsForDay: "لا توجد تكاليف أو خفارات لهذا اليوم",
    guard: "خفارة",
    assignment: "تكليف",
    scheduleItems: "عناصر اليوم",
    type: "النوع",
    typeAssignment: "تكليف",
    typeGuard: "خفارة",
    reminderNone: "بدون تذكير",
    reminder1h: "قبل ساعة",
    reminder12h: "قبل 12 ساعة",
    reminder24h: "قبل يوم",
    reminderReady: "تم تجهيز ملف التذكير",
    reminderUnsupported: "الرجاء تحديد وقت صالح لإخراج ملف التذكير",
    search: "البحث",
    userSearch: "بحث المستخدم",
    searchDate: "بحث بتاريخ محدد",
    availableDutyDays: "الأيام الفاضية هذا الشهر",
    freeDay: "فاضي",
    occupiedDay: "مشغول",
    searchResult: "نتيجة البحث",
    noFreeDays: "لا توجد أيام فاضية في هذا الشهر",
    openDay: "فتح اليوم",
    entryColor: "لون اليوم",
    defaultTone: "افتراضي",
    quickActions: "الإجراءات السريعة",
    adminPanel: "لوحة الإدارة",
    adminLogin: "دخول الإدارة",
    adminPassword: "كلمة سر الإدارة",
    adminSearch: "ابحث بالاسم أو رقم الموظف",
    adminUsers: "المستخدمون",
    adminResults: "نتائج البحث",
    adminOpen: "عرض التفاصيل",
    adminNoResults: "لا توجد نتائج مطابقة",
    manageItems: "إدارة العناصر",
    currentShift: "حالة الشفت",
    weekendOff: "عطلة أسبوعية",
    dutyAvailable: "دوام متاح",
    guardOnlyM: "الخفارة متاحة فقط لمستخدمي شفت M",
    financialValue: "القيمة المالية",
    zeroValue: "0 د.ك",
    amountValue: "20 د.ك",
    dayStatus: "حالة اليوم",
    adminSummary: "ملخص المستخدم",
    adminAssignmentCount: "عدد التكاليف",
    adminGuardCount: "عدد الخفارات",
    back: "رجوع",
    noNotes: "بدون ملاحظات",
    guardInfo: "الخفارة لا تحتسب ماليًا",
    allUsers: "جميع المستخدمين",
    refresh: "تحديث",
    addFromDay: "إضافة من اليوم",
    adminSession: "جلسة إدارة",
    userPanel: "لوحة المستخدم",
    statusOff: "راحة",
    statusDuty: "دوام",
    statusAssignment: "فيه تكليف",
    statusGuard: "فيه خفارة",
    statusMixed: "فيه تكليف وخفارة",
    showPassword: "إظهار كلمة السر",
    hidePassword: "إخفاء كلمة السر",
    smartSearchTitle: "البحث الذكي",
    smartSearchPlaceholder: "مثال: ورني الأيام الفاضية أو شنو شفتي اليوم",
    smartSearchExamples: "الأيام الفاضية · تكاليف هذا الشهر · شنو شفتي اليوم · متى عندي خفارة",
    smartSearchRun: "نفذ البحث",
    smartSearchReset: "مسح النتائج",
    smartSearchEmpty: "اكتب سؤالك بشكل طبيعي، والنظام يبحث داخل جدولك فقط.",
    smartSearchNoResults: "ما لقيت نتائج مطابقة داخل بياناتك الحالية.",
    smartSearchResultTitle: "نتيجة البحث الذكي",
    bulkAddTitle: "إضافة متعددة",
    bulkAddHint: "اكتب أكثر من تاريخ، واختر اسم التكليف والوقت مرة واحدة، ثم حضر المعاينة واحفظها دفعة واحدة.",
    bulkDates: "التواريخ",
    bulkDatesPlaceholder: "مثال: 20, 22, 24 أو\n2026-04-20\n2026-04-22",
    bulkPrepare: "تحضير المعاينة",
    bulkNoPreview: "لا توجد معاينة بعد. اكتب التواريخ واضغط تحضير المعاينة.",
    bulkPreviewTitle: "معاينة الإضافة المتعددة",
    bulkSave: "حفظ الكل",
    bulkClear: "مسح",
    bulkNoDates: "اكتب تاريخًا واحدًا على الأقل",
    bulkInvalidDates: "بعض التواريخ غير صالحة أو لا تقبل التكليف",
    bulkReady: "المعاينة جاهزة قبل الحفظ",
    bulkSaved: "تم حفظ التكاليف المحددة",
    bulkItemsCount: "عدد التكاليف",
    bulkInvalidDatesLabel: "تواريخ تم تجاهلها",
    bulkDateUpdatedHint: "إذا كان اليوم فيه تكليف سابق فسيتم تحديثه",
    importScheduleTitle: "استيراد جدول الإدارة",
    importScheduleHint: "ارفع صورة أو ملف نصي/CSV للجدول، واكتب اسم الموظف أو جزءًا منه، ثم استخرج الأيام الخاصة فيه قبل الحفظ.",
    importScheduleFile: "ملف الجدول",
    importEmployeeName: "اسم الموظف",
    importEmployeePlaceholder: "مثال: عبدالله جاسم محمد",
    importExtract: "استخراج",
    importSave: "حفظ في التقويم",
    importClear: "مسح",
    importPreviewTitle: "معاينة الأيام المستخرجة",
    importNoPreview: "لا توجد معاينة بعد. ارفع الجدول واضغط استخراج.",
    importNoFile: "ارفع ملف الجدول أولاً",
    importNameMissing: "اكتب اسم الموظف أولاً",
    importEmployeeNotFound: "الاسم غير موجود في الجدول",
    importUnsupportedFile: "نوع الملف الحالي غير مدعوم. استخدم صورة أو CSV أو TXT أو JSON",
    importBusy: "جاري قراءة الجدول واستخراج البيانات...",
    importReady: "المعاينة جاهزة قبل الحفظ",
    importSaved: "تم حفظ الجدول في التقويم",
    importSource: "جدول الإدارة",
    importNoRows: "ما قدرت أستخرج أيام صالحة من الملف الحالي",
    importRawText: "النص المستخرج",
    importRawTextHint: "إذا كانت الصورة صعبة، تقدر تعدل النص المستخرج ثم تعيد الاستخراج.",
    importImageNote: "OCR للصور يعمل بشكل تجريبي. ملفات CSV/TXT تكون أدق.",
    importDetectedLocation: "الموقع المستخرج",
    importItemsCount: "عدد الأيام المستخرجة",
    importTypeAssignment: "تكليف مستورد",
    importTodayShift: "شفتي اليوم",
    importTomorrowShift: "شفتي باجر",
    importThisWeek: "هذا الأسبوع",
    importThisMonth: "هذا الشهر"
  },
  en: {
    appTagline: "Shift and assignment management",
    loading: "Restoring session...",
    login: "Login",
    register: "Create New Account",
    username: "Username",
    password: "Password",
    employeeId: "Employee ID",
    shift: "Shift",
    shiftA: "Shift A",
    shiftB: "Shift B",
    shiftC: "Shift C",
    shiftM: "Shift M",
    forgotPassword: "Forgot Password?",
    settings: "Settings",
    logout: "Logout",
    addAssignment: "Add Assignment",
    addGuard: "Add Guard",
    deleteAssignment: "Delete Item",
    deleteAssignmentMenu: "Delete Assignment",
    calendar: "Calendar",
    totalAssignments: "Assignment Days",
    totalGuards: "Guard Days",
    totalAmount: "Total Amount",
    dinar: "KD",
    support: "Technical Support",
    changeLanguage: "Change Language",
    changeShift: "Change Shift",
    changePassword: "Change Password",
    changeUsername: "Change Username",
    clearData: "Clear All Data",
    save: "Save",
    cancel: "Cancel",
    date: "Date",
    assignmentName: "Item Name",
    assignmentTime: "Item Time",
    notes: "Notes",
    reminder: "Reminder",
    exportReminder: "Export Reminder",
    night: "Night (N)",
    morning: "Morning (A)",
    other: "Other",
    clinicBoulevard: "Boulevard Clinic",
    clinicScience: "Science Center Clinic",
    clinicMarina: "Marina Clinic",
    clinicPromenade: "Promenade Clinic",
    clinicCourts: "Courts Complex Clinic",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    editAssignmentMenu: "Edit Assignment",
    dutyDay: "Duty Day",
    dayOff: "Day Off",
    assignmentDay: "Assignment Day",
    guardDay: "Guard Day",
    mixedDay: "Assignment + Guard",
    selectDate: "Select Date",
    usernameExists: "Username already exists",
    employeeIdExists: "Employee ID already exists",
    invalidCredentials: "Invalid username or password",
    fieldsRequired: "All fields are required",
    onlyEnglish: "Only English characters allowed",
    noWeekendAssignments: "Assignments and guards are not allowed on Friday and Saturday",
    noDutyAssignments: "Assignments cannot be added on duty days",
    assignmentUpdated: "Item updated successfully",
    assignmentDeleted: "Item deleted successfully",
    passwordUpdated: "Password updated successfully",
    accountCreated: "Account created successfully",
    assignmentAdded: "Item added successfully",
    dataCleared: "All data cleared",
    noAssignments: "No items found",
    saveFailed: "We couldn't save your changes. Please try again.",
    customNameRequired: "Please enter the item name",
    customTimeRequired: "Please choose the item time",
    duplicateAssignment: "An item of the same type already exists for this date",
    reconnect: "Please log in again and retry",
    sessionExpired: "Session expired. Please log in again.",
    adminDisabled: "Admin mode is available through the admin account",
    dayDetails: "Day Details",
    noItemsForDay: "No assignments or guards for this day",
    guard: "Guard",
    assignment: "Assignment",
    scheduleItems: "Day Items",
    type: "Type",
    typeAssignment: "Assignment",
    typeGuard: "Guard",
    reminderNone: "No reminder",
    reminder1h: "1 hour before",
    reminder12h: "12 hours before",
    reminder24h: "1 day before",
    reminderReady: "Reminder file is ready",
    reminderUnsupported: "Please choose a valid time to export an ICS reminder",
    search: "Search",
    userSearch: "User Search",
    searchDate: "Search by date",
    availableDutyDays: "Available days this month",
    freeDay: "Free",
    occupiedDay: "Busy",
    searchResult: "Search Result",
    noFreeDays: "No free days this month",
    openDay: "Open Day",
    entryColor: "Day Color",
    defaultTone: "Default",
    quickActions: "Quick Actions",
    adminPanel: "Admin Panel",
    adminLogin: "Admin Login",
    adminPassword: "Admin Password",
    adminSearch: "Search by username or employee ID",
    adminUsers: "Users",
    adminResults: "Search Results",
    adminOpen: "Open Details",
    adminNoResults: "No matching results",
    manageItems: "Manage Items",
    currentShift: "Shift Status",
    weekendOff: "Weekend Off",
    dutyAvailable: "Duty Available",
    guardOnlyM: "Guards are available only for M shift users",
    financialValue: "Financial Value",
    zeroValue: "KD 0",
    amountValue: "KD 20",
    dayStatus: "Day Status",
    adminSummary: "User Summary",
    adminAssignmentCount: "Assignments",
    adminGuardCount: "Guards",
    back: "Back",
    noNotes: "No notes",
    guardInfo: "Guards are not counted financially",
    allUsers: "All Users",
    refresh: "Refresh",
    addFromDay: "Add from this day",
    adminSession: "Admin Session",
    userPanel: "User Panel",
    statusOff: "Off",
    statusDuty: "Duty",
    statusAssignment: "Has assignment",
    statusGuard: "Has guard",
    statusMixed: "Has assignment and guard",
    showPassword: "Show password",
    hidePassword: "Hide password",
    smartSearchTitle: "Smart Search",
    smartSearchPlaceholder: "Example: show my free days or what is my shift today",
    smartSearchExamples: "Free days · This month assignments · What is my shift today · When do I have a guard",
    smartSearchRun: "Run Search",
    smartSearchReset: "Clear Results",
    smartSearchEmpty: "Ask naturally and the system will search your own data only.",
    smartSearchNoResults: "No matching results were found in your current data.",
    smartSearchResultTitle: "Smart Search Result",
    bulkAddTitle: "Bulk Add",
    bulkAddHint: "Enter multiple dates, choose the assignment name and time once, then preview and save them in one action.",
    bulkDates: "Dates",
    bulkDatesPlaceholder: "Example: 20, 22, 24 or\n2026-04-20\n2026-04-22",
    bulkPrepare: "Prepare Preview",
    bulkNoPreview: "No preview yet. Enter dates and prepare the preview first.",
    bulkPreviewTitle: "Bulk Add Preview",
    bulkSave: "Save All",
    bulkClear: "Clear",
    bulkNoDates: "Enter at least one date",
    bulkInvalidDates: "Some dates are invalid or cannot accept assignments",
    bulkReady: "Preview is ready before saving",
    bulkSaved: "Selected assignments were saved",
    bulkItemsCount: "Assignments count",
    bulkInvalidDatesLabel: "Skipped dates",
    bulkDateUpdatedHint: "If a day already has an assignment, it will be updated",
    importScheduleTitle: "Schedule Import",
    importScheduleHint: "Upload an image or CSV/TXT schedule, enter the employee name or part of it, then extract and preview before saving.",
    importScheduleFile: "Schedule File",
    importEmployeeName: "Employee Name",
    importEmployeePlaceholder: "Example: Abdullah Jassim Mohammad",
    importExtract: "Extract",
    importSave: "Save to Calendar",
    importClear: "Clear",
    importPreviewTitle: "Imported Preview",
    importNoPreview: "No preview yet. Upload a schedule and extract first.",
    importNoFile: "Please upload a schedule file first",
    importNameMissing: "Please enter the employee name first",
    importEmployeeNotFound: "Employee name was not found in the schedule",
    importUnsupportedFile: "This file type is not supported yet. Use image, CSV, TXT, or JSON",
    importBusy: "Reading the schedule and extracting data...",
    importReady: "Preview is ready before saving",
    importSaved: "Schedule saved to the calendar",
    importSource: "Management schedule",
    importNoRows: "Could not extract valid days from this file",
    importRawText: "Extracted Text",
    importRawTextHint: "If the image is hard to read, you can refine the extracted text and try again.",
    importImageNote: "Image OCR is experimental. CSV/TXT files are more accurate.",
    importDetectedLocation: "Detected location",
    importItemsCount: "Extracted days",
    importTypeAssignment: "Imported assignment",
    importTodayShift: "Today's shift",
    importTomorrowShift: "Tomorrow's shift",
    importThisWeek: "This week",
    importThisMonth: "This month"
  }
};

const monthNames = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

const dayNames = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
};

const state = {
  currentUser: null,
  sessionToken: null,
  sessionKind: "user",
  currentLanguage: "ar",
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  loading: true,
  modal: null,
  toasts: [],
  actionMenuOpen: false,
  smartSearchOpen: false,
  importPanelOpen: false,
  smartSearchQuery: "",
  smartSearchResult: null,
  importBusy: false,
  importForm: createBulkAddFormState(),
  importPreview: null,
  adminUsers: [],
  adminQuery: ""
};

function createBulkAddFormState() {
  return {
    datesText: "",
    namePreset: "other",
    nameCustom: "",
    timePreset: "A",
    timeCustom: "",
    notes: "",
    color: "",
    reminderOffsetMinutes: 0
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableSerialize(item));
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableSerialize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function getApiCacheKey(action, payload = {}) {
  return `${action}:${JSON.stringify(stableSerialize(payload))}`;
}

function isCacheableAction(action) {
  return Object.hasOwn(apiCacheTtls, action);
}

function getCachedApiResponse(action, payload = {}) {
  if (!isCacheableAction(action)) return null;
  const key = getApiCacheKey(action, payload);
  const cached = apiRequestCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    apiRequestCache.delete(key);
    return null;
  }
  return cloneValue(cached.data);
}

function setCachedApiResponse(action, payload = {}, data) {
  if (!isCacheableAction(action)) return;
  const ttl = apiCacheTtls[action];
  if (!ttl) return;
  const key = getApiCacheKey(action, payload);
  apiRequestCache.set(key, {
    expiresAt: Date.now() + ttl,
    data: cloneValue(data)
  });
}

function clearApiCache() {
  apiRequestCache.clear();
}

function persistSessionSnapshot() {
  if (!state.sessionToken) {
    sessionStorage.removeItem(sessionSnapshotKey);
    return;
  }

  sessionStorage.setItem(
    sessionSnapshotKey,
    JSON.stringify({
      token: state.sessionToken,
      kind: state.sessionKind,
      currentUser: state.currentUser,
      adminUsers: state.adminUsers,
      adminQuery: state.adminQuery,
      currentLanguage: state.currentLanguage,
      cachedAt: Date.now()
    })
  );
}

function readSessionSnapshot() {
  const rawSession = sessionStorage.getItem(sessionKey);
  const rawSnapshot = sessionStorage.getItem(sessionSnapshotKey);
  if (!rawSession || !rawSnapshot) return null;

  try {
    const session = JSON.parse(rawSession);
    const snapshot = JSON.parse(rawSnapshot);
    if (!session?.token || snapshot?.token !== session.token) {
      sessionStorage.removeItem(sessionSnapshotKey);
      return null;
    }

    return { session, snapshot };
  } catch (error) {
    console.error(error);
    sessionStorage.removeItem(sessionSnapshotKey);
    return null;
  }
}

function hydrateSessionSnapshot() {
  const payload = readSessionSnapshot();
  if (!payload) return { hydrated: false, fresh: false };

  const { session, snapshot } = payload;
  const fresh = Date.now() - Number(snapshot.cachedAt || 0) <= apiCacheTtls.restoreSession;

  try {
    state.sessionToken = session.token;
    state.sessionKind = session.kind || "user";
    state.currentLanguage = snapshot.currentLanguage || state.currentLanguage;

    if (state.sessionKind === "admin") {
      state.currentUser = null;
      state.adminUsers = Array.isArray(snapshot.adminUsers) ? snapshot.adminUsers.map(normalizeUser) : [];
      state.adminQuery = snapshot.adminQuery || "";
    } else {
      state.currentUser = normalizeUser(snapshot.currentUser);
      state.adminUsers = [];
      state.adminQuery = "";
    }

    return { hydrated: Boolean(state.currentUser || state.sessionKind === "admin"), fresh };
  } catch (error) {
    console.error(error);
    sessionStorage.removeItem(sessionSnapshotKey);
    return { hydrated: false, fresh: false };
  }
}

function t(key) {
  return translations[state.currentLanguage]?.[key] || key;
}

function getDir() {
  return state.currentLanguage === "ar" ? "rtl" : "ltr";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isEnglishOnly(str) {
  return /^[a-zA-Z0-9\s\-_]+$/.test(str);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(month, year) {
  return `${monthNames[state.currentLanguage][month]} ${year}`;
}

function isWeekend(date) {
  return config.weekendDays.includes(date.getDay());
}

function normalizeReminder(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeEntryColor(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return entryColorPresets.some((preset) => preset.key === normalized) ? normalized : "";
}

function normalizeEntry(entry, index = 0) {
  const kind = entry?.kind === "guard" ? "guard" : "assignment";
  const date = String(entry?.date || "");
  const name = String(entry?.name || "");
  const time = String(entry?.time || "");
  const notes = String(entry?.notes || "");
  const color = normalizeEntryColor(entry?.color);
  const source = String(entry?.source || "");
  const reminderOffsetMinutes = normalizeReminder(entry?.reminderOffsetMinutes);
  const fallbackId = `${kind}|${date}|${name}|${time}|${index}`;

  return {
    id: String(entry?.id || fallbackId),
    kind,
    date,
    name,
    time,
    notes,
    color,
    source,
    reminderOffsetMinutes
  };
}

function normalizeUser(user) {
  if (!user) return null;

  return {
    ...user,
    assignments: Array.isArray(user.assignments)
      ? user.assignments.map((entry, index) => normalizeEntry(entry, index))
      : [],
    settings: user.settings || {}
  };
}

function setCurrentUser(user, token = state.sessionToken) {
  state.currentUser = normalizeUser(user);
  state.sessionToken = token;
  state.sessionKind = "user";
  state.actionMenuOpen = false;
  state.smartSearchOpen = false;
  state.importPanelOpen = false;
  state.smartSearchResult = null;
  state.importBusy = false;
  state.importForm = createBulkAddFormState();
  state.importPreview = null;
  state.adminUsers = [];
  state.adminQuery = "";
  if (state.currentUser?.settings?.language) {
    state.currentLanguage = state.currentUser.settings.language;
  }
  persistSession();
}

function setAdminSession(token) {
  state.currentUser = null;
  state.sessionToken = token;
  state.sessionKind = "admin";
  state.actionMenuOpen = false;
  state.smartSearchOpen = false;
  state.importPanelOpen = false;
  state.importBusy = false;
  state.importForm = createBulkAddFormState();
  state.importPreview = null;
  persistSession();
}

function persistSession() {
  if (!state.sessionToken) {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionSnapshotKey);
    return;
  }

  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({
      token: state.sessionToken,
      kind: state.sessionKind
    })
  );
  persistSessionSnapshot();
}

function clearSession() {
  state.currentUser = null;
  state.sessionToken = null;
  state.sessionKind = "user";
  state.actionMenuOpen = false;
  state.smartSearchOpen = false;
  state.importPanelOpen = false;
  state.smartSearchQuery = "";
  state.smartSearchResult = null;
  state.importBusy = false;
  state.importForm = createBulkAddFormState();
  state.importPreview = null;
  state.adminUsers = [];
  state.adminQuery = "";
  clearApiCache();
  sessionStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionSnapshotKey);
}

function getCurrentEntries() {
  return state.currentUser?.assignments || [];
}

function getEntriesForDate(dateStr) {
  return getCurrentEntries()
    .filter((entry) => entry.date === dateStr)
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

function getEntryColorPreset(colorKey) {
  return entryColorPresets.find((preset) => preset.key === normalizeEntryColor(colorKey)) || entryColorPresets[0];
}

function getEntryColorVars(colorKey) {
  const preset = getEntryColorPreset(colorKey);
  if (!preset.key) return "";
  return `--entry-color-start:${preset.start};--entry-color-end:${preset.end};--entry-color-text:${preset.text};--entry-color-ring:${preset.ring};`;
}

function getEntryAccentEntry(entries) {
  if (!entries.length) return null;
  if (entries.length === 1) return entries[0];
  return (
    entries.find((entry) => entry.kind === "assignment" && entry.color) ||
    entries.find((entry) => entry.kind === "guard" && entry.color) ||
    entries.find((entry) => entry.kind === "assignment") ||
    entries[0]
  );
}

function getShiftForDate(date, shift) {
  if (shift === "M") {
    return isWeekend(date) ? "off" : "duty";
  }

  return getCycleShiftKey(date) === shift ? "duty" : "off";
}

function getCycleShiftKey(date) {
  const anchorDate = new Date(`${config.cycleStartDate}T00:00:00`);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((target - anchorDate) / 86400000);
  const cycleIndex = ((diff % 3) + 3) % 3;
  return ["A", "B", "C"][cycleIndex];
}

function canAssignOnDate(date, shift = state.currentUser?.shift || "A") {
  if (shift === "M") {
    return !isWeekend(date);
  }
  return getShiftForDate(date, shift) === "off";
}

function canGuardOnDate(date, shift = state.currentUser?.shift || "A") {
  return shift === "M" && !isWeekend(date);
}

function getClinicLabel(key) {
  const map = {
    boulevard: t("clinicBoulevard"),
    science: t("clinicScience"),
    marina: t("clinicMarina"),
    promenade: t("clinicPromenade"),
    courts: t("clinicCourts"),
    other: t("other")
  };
  return map[key] || key;
}

function getEntryTypeLabel(kind) {
  return kind === "guard" ? t("typeGuard") : t("typeAssignment");
}

function getDayStatus(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const entries = getEntriesForDate(dateStr);
  const hasAssignment = entries.some((entry) => entry.kind === "assignment");
  const hasGuard = entries.some((entry) => entry.kind === "guard");
  const shiftStatus = getShiftForDate(date, state.currentUser?.shift || "A");

  if (state.currentUser?.shift === "M" && isWeekend(date)) {
    return { key: "off", label: t("weekendOff"), shiftStatus, entries };
  }
  if (hasAssignment && hasGuard) {
    return { key: "mixed", label: t("statusMixed"), shiftStatus, entries };
  }
  if (hasAssignment) {
    return { key: "assignment", label: t("statusAssignment"), shiftStatus, entries };
  }
  if (hasGuard) {
    return { key: "guard", label: t("statusGuard"), shiftStatus, entries };
  }
  if (shiftStatus === "duty") {
    return { key: "free", label: t("statusDuty"), shiftStatus, entries };
  }
  return { key: "off", label: t("statusOff"), shiftStatus, entries };
}

function getMonthEntries(kind = null) {
  return getCurrentEntries().filter((entry) => {
    const date = new Date(`${entry.date}T00:00:00`);
    const sameMonth = date.getMonth() === state.currentMonth && date.getFullYear() === state.currentYear;
    return sameMonth && (!kind || entry.kind === kind);
  });
}

function formatFinancialValue(entry) {
  return entry.kind === "guard" ? t("zeroValue") : `${config.assignmentRate} ${t("dinar")}`;
}

function getReminderOptions() {
  return [
    { value: 0, label: t("reminderNone") },
    { value: 60, label: t("reminder1h") },
    { value: 720, label: t("reminder12h") },
    { value: 1440, label: t("reminder24h") }
  ];
}

function getReminderLabel(minutes) {
  return getReminderOptions().find((option) => option.value === normalizeReminder(minutes))?.label || t("reminderNone");
}

function getPresetTimeLabel(value) {
  if (value === "A") return t("morning");
  if (value === "N") return t("night");
  return value || "-";
}

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ٟ]/g, "")
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalizedText(value) {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function getNameMatchScore(haystack, targetTokens) {
  const haystackText = normalizeSearchText(haystack);
  if (!haystackText || !targetTokens.length) return 0;

  const haystackTokens = tokenizeNormalizedText(haystackText);
  let score = 0;
  let matchedTokens = 0;

  for (const token of targetTokens) {
    if (!token) continue;
    if (haystackTokens.includes(token)) {
      score += 5;
      matchedTokens += 1;
      continue;
    }
    if (haystackTokens.some((cellToken) => cellToken.includes(token) || token.includes(cellToken))) {
      score += 3;
      matchedTokens += 1;
      continue;
    }
    if (token.length >= 3 && haystackText.includes(token)) {
      score += 2;
      matchedTokens += 1;
    }
  }

  const exactPhrase = targetTokens.join(" ");
  if (exactPhrase && haystackText.includes(exactPhrase)) {
    score += 6;
  }

  if (matchedTokens) {
    score += matchedTokens / targetTokens.length;
  }

  return score;
}

function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, offset) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + offset);
  return next;
}

function getWeekRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  const end = addDays(start, 6);
  return { start, end };
}

function isDateWithinRange(dateStr, start, end) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date >= start && date <= end;
}

function getDaysInRange(start, end) {
  const days = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(toDateInputValue(cursor));
  }
  return days;
}

function parseDateFromQuery(query) {
  const raw = String(query || "").trim();
  const isoMatch = raw.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const shortMatch = raw.match(/\b(\d{1,2})[/-](\d{1,2})\b/);
  if (shortMatch) {
    const base = getTodayDate();
    const [, day, month] = shortMatch;
    return `${base.getFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const normalized = normalizeSearchText(raw);
  const dayPhrase = normalized.match(/(?:يوم|تاريخ)?\s*(\d{1,2})\b/);
  if (dayPhrase && !normalized.includes("ساعه") && !normalized.includes("شهر")) {
    const base = new Date(state.currentYear, state.currentMonth, 1);
    const day = Number(dayPhrase[1]);
    if (day >= 1 && day <= 31) {
      return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return "";
}

function getRangeFromQuery(query) {
  const normalized = normalizeSearchText(query);
  const today = getTodayDate();
  if (normalized.includes("اليوم")) {
    return { start: today, end: today, label: t("importTodayShift") };
  }
  if (normalized.includes("باجر") || normalized.includes("غدا")) {
    const tomorrow = addDays(today, 1);
    return { start: tomorrow, end: tomorrow, label: t("importTomorrowShift") };
  }
  if (normalized.includes("هذا الاسبوع") || normalized.includes("هالاسبوع") || normalized.includes("الاسبوع")) {
    const { start, end } = getWeekRange(today);
    return { start, end, label: t("importThisWeek") };
  }
  if (normalized.includes("هذا الشهر") || normalized.includes("هالشهر") || normalized.includes("الشهر")) {
    const start = new Date(state.currentYear, state.currentMonth, 1);
    const end = new Date(state.currentYear, state.currentMonth + 1, 0);
    return { start, end, label: t("importThisMonth") };
  }
  const explicitDate = parseDateFromQuery(query);
  if (explicitDate) {
    const exact = new Date(`${explicitDate}T00:00:00`);
    return { start: exact, end: exact, label: explicitDate };
  }
  const start = new Date(state.currentYear, state.currentMonth, 1);
  const end = new Date(state.currentYear, state.currentMonth + 1, 0);
  return { start, end, label: t("importThisMonth") };
}

function getSmartSearchIntent(query) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return "empty";
  if (normalized.includes("فاضي") || normalized.includes("فارغ") || normalized.includes("متاح")) return "free";
  if (normalized.includes("خفاره")) return "guard";
  if (normalized.includes("تكليف")) return "assignment";
  if (normalized.includes("محكمه حولي") || (normalized.includes("محكمه") && normalized.includes("حولي"))) return "hawalli";
  if (normalized.includes("شفتي") || normalized.includes("دوامي")) return "shift";
  return "summary";
}

function buildSmartSearchResult(query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    return { kind: "empty", title: t("smartSearchTitle"), description: t("smartSearchEmpty"), items: [] };
  }

  const intent = getSmartSearchIntent(trimmed);
  const range = getRangeFromQuery(trimmed);
  const days = getDaysInRange(range.start, range.end);
  const normalized = normalizeSearchText(trimmed);
  const matchingDays = [];

  for (const day of days) {
    const entries = getEntriesForDate(day);
    const status = getDayStatus(day);
    const assignmentEntries = entries.filter((entry) => entry.kind === "assignment");
    const guardEntries = entries.filter((entry) => entry.kind === "guard");
    const matchingAssignments = assignmentEntries.filter((entry) => normalizeSearchText(entry.name).includes("محكمه حولي"));

    let include = false;
    if (intent === "free") include = entries.length === 0 && canAssignOnDate(new Date(`${day}T00:00:00`));
    else if (intent === "guard") include = guardEntries.length > 0;
    else if (intent === "assignment") include = assignmentEntries.length > 0;
    else if (intent === "hawalli") include = matchingAssignments.length > 0;
    else if (intent === "shift") include = true;
    else include = entries.length > 0 || status.key === "free";

    if (parseDateFromQuery(trimmed) && day !== parseDateFromQuery(trimmed)) {
      include = false;
    }

    if (include) {
      matchingDays.push({
        date: day,
        status,
        entries: intent === "hawalli" ? matchingAssignments : entries,
        shift: state.currentUser.shift
      });
    }
  }

  if (parseDateFromQuery(trimmed)) {
    const exactDate = parseDateFromQuery(trimmed);
    const exactStatus = getDayStatus(exactDate);
    return {
      kind: "day",
      title: t("smartSearchResultTitle"),
      description: `${t("date")}: ${exactDate}`,
      item: {
        date: exactDate,
        status: exactStatus,
        entries: getEntriesForDate(exactDate),
        shift: state.currentUser.shift
      }
    };
  }

  if (!matchingDays.length) {
    return { kind: "empty", title: t("smartSearchResultTitle"), description: t("smartSearchNoResults"), items: [] };
  }

  if (matchingDays.length === 1 && (intent === "shift" || range.start.getTime() === range.end.getTime())) {
    return {
      kind: "day",
      title: t("smartSearchResultTitle"),
      description: `${t("date")}: ${matchingDays[0].date}`,
      item: matchingDays[0]
    };
  }

  if (intent === "free" && normalizeSearchText(trimmed).includes("اقرب")) {
    const nearest = matchingDays[0];
    return {
      kind: "day",
      title: t("smartSearchResultTitle"),
      description: `${t("freeDay")} · ${nearest.date}`,
      item: nearest
    };
  }

  return {
    kind: "list",
    title: t("smartSearchResultTitle"),
    description: `${range.label} · ${matchingDays.length} ${t("openDay")}`,
    items: matchingDays
  };
}

function renderSmartSearchResultCard(result) {
  if (!result) {
    return `<div class="empty-panel">${t("smartSearchEmpty")}</div>`;
  }
  if (result.kind === "empty") {
    return `<div class="empty-panel">${escapeHtml(result.description)}</div>`;
  }
  if (result.kind === "day") {
    return `
      <div class="search-result-card">
        <div><strong>${t("date")}:</strong> ${escapeHtml(result.item.date)}</div>
        <div><strong>${t("dayStatus")}:</strong> ${escapeHtml(result.item.status.label)}</div>
        <div><strong>${t("shift")}:</strong> ${escapeHtml(result.item.shift)}</div>
        ${
          result.item.entries.length
            ? `<div class="list search-entry-list">${result.item.entries.map((entry) => renderEntryCard(entry, false)).join("")}</div>`
            : `<div class="tiny">${t("noItemsForDay")}</div>`
        }
      </div>
    `;
  }

  return `
    <div class="list smart-search-list">
      ${result.items
        .map(
          (item) => `
            <button class="list-item smart-search-day" type="button" data-smart-open-day="${escapeHtml(item.date)}">
              <div><strong>${escapeHtml(item.date)}</strong></div>
              <div class="tiny">${escapeHtml(item.status.label)}</div>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function guessScheduleLocation(rawText, fileName = "") {
  const source = normalizeSearchText(`${rawText} ${fileName}`);
  const candidates = [
    { keys: ["marina", "مارينا"], label: "مارينا مول" },
    { keys: ["promenade", "بروميناد"], label: "البروميناد" },
    { keys: ["science", "علمي", "المركز العلمي"], label: "المركز العلمي" },
    { keys: ["boulevard", "بوليفارد"], label: "البوليفارد" },
    { keys: ["courts", "محاكم", "مجمع المحاكم"], label: "محكمة حولي" },
    { keys: ["hawally", "حولي"], label: "محكمة حولي" }
  ];
  const found = candidates.find((candidate) => candidate.keys.some((key) => source.includes(normalizeSearchText(key))));
  return found?.label || t("importTypeAssignment");
}

function parseDelimitedText(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
    if (line.includes(",")) return line.split(",").map((cell) => cell.trim());
    if (line.includes("|")) return line.split("|").map((cell) => cell.trim());
    const wideSplit = line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);
    if (wideSplit.length > 1) return wideSplit;
    return line.split(/\s+/).map((cell) => cell.trim()).filter(Boolean);
  });
}

function parseReferenceDate(text) {
  const isoMatches = [...String(text || "").matchAll(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/g)];
  if (isoMatches.length) {
    const [year, month, day] = isoMatches[isoMatches.length - 1].slice(1).map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(state.currentYear, state.currentMonth + 1, 0);
}

function resolveDaySequence(dayNumbers, referenceDate) {
  const dates = [];
  let year = referenceDate.getFullYear();
  let month = referenceDate.getMonth();
  let previous = null;

  for (const day of dayNumbers) {
    if (previous !== null && day > previous) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    }
    dates.push(new Date(year, month, day));
    previous = day;
  }
  return dates;
}

function findDayHeaderRow(matrix) {
  let bestRow = null;
  let bestCount = 0;
  matrix.forEach((row, index) => {
    const values = row.map((cell) => Number(cell)).filter((value) => Number.isInteger(value) && value >= 1 && value <= 31);
    if (values.length > bestCount) {
      bestCount = values.length;
      bestRow = { index, values, row };
    }
  });
  return bestCount >= 5 ? bestRow : null;
}

function findEmployeeRow(matrix, employeeName) {
  const targetTokens = tokenizeNormalizedText(employeeName);
  if (!targetTokens.length) return null;

  let bestMatch = null;

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    const rowText = row.join(" ");
    const rowScore = getNameMatchScore(rowText, targetTokens);

    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const cell = String(row[columnIndex] || "");
      const cellScore = getNameMatchScore(cell, targetTokens);
      const score = Math.max(rowScore, cellScore + 1);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { rowIndex, columnIndex, row, score, matchedText: cell || rowText };
      }
    }
  }

  if (!bestMatch) return null;
  if (bestMatch.score < Math.max(3.5, targetTokens.length * 1.8)) return null;
  return bestMatch;
}

function normalizeImportSymbol(value) {
  const cell = normalizeSearchText(value).replace(/\s+/g, "").toUpperCase();
  if (cell === "A") return "A";
  if (cell === "N") return "N";
  if (cell === "M" || cell === "م") return "M";
  return "";
}

function normalizeOcrWords(words, meta = {}) {
  const scale = Number(meta.scale || 1);
  const offsetX = Number(meta.offsetX || 0);
  const offsetY = Number(meta.offsetY || 0);
  return (words || [])
    .map((word) => {
      const bbox = word?.bbox || {};
      const x0 = offsetX + Number(bbox.x0 ?? word?.x0 ?? 0) / scale;
      const y0 = offsetY + Number(bbox.y0 ?? word?.y0 ?? 0) / scale;
      const x1 = offsetX + Number(bbox.x1 ?? word?.x1 ?? 0) / scale;
      const y1 = offsetY + Number(bbox.y1 ?? word?.y1 ?? 0) / scale;
      const text = String(word?.text || word?.word || "").trim();
      if (!text) return null;
      return {
        text,
        x0,
        y0,
        x1,
        y1,
        centerX: (x0 + x1) / 2,
        centerY: (y0 + y1) / 2,
        height: Math.max(0, y1 - y0),
        width: Math.max(0, x1 - x0)
      };
    })
    .filter(Boolean);
}

function groupOcrWordsByLine(words, tolerance = 16) {
  const sorted = [...words].sort((left, right) => left.centerY - right.centerY);
  const lines = [];

  for (const word of sorted) {
    const line = lines.find((item) => Math.abs(item.centerY - word.centerY) <= tolerance);
    if (line) {
      line.words.push(word);
      line.centerY = (line.centerY * (line.words.length - 1) + word.centerY) / line.words.length;
      line.minX = Math.min(line.minX, word.x0);
      line.maxX = Math.max(line.maxX, word.x1);
      line.minY = Math.min(line.minY, word.y0);
      line.maxY = Math.max(line.maxY, word.y1);
    } else {
      lines.push({
        centerY: word.centerY,
        minX: word.x0,
        maxX: word.x1,
        minY: word.y0,
        maxY: word.y1,
        words: [word]
      });
    }
  }

  return lines.map((line) => {
    const wordsInReadingOrder = [...line.words].sort((left, right) => left.x0 - right.x0);
    return {
      ...line,
      words: wordsInReadingOrder,
      text: wordsInReadingOrder.map((word) => word.text).join(" ").trim(),
      averageHeight: wordsInReadingOrder.reduce((sum, word) => sum + word.height, 0) / Math.max(1, wordsInReadingOrder.length)
    };
  });
}

function findOcrDayHeader(words) {
  const lines = groupOcrWordsByLine(words);
  let bestLine = null;
  let bestCount = 0;

  for (const line of lines) {
    const numericWords = line.words
      .map((word) => ({ ...word, day: Number(String(word.text).replace(/[^\d]/g, "")) }))
      .filter((word) => Number.isInteger(word.day) && word.day >= 1 && word.day <= 31);
    if (numericWords.length > bestCount) {
      bestCount = numericWords.length;
      bestLine = numericWords;
    }
  }

  return bestCount >= 5 ? bestLine.sort((left, right) => left.centerX - right.centerX) : null;
}

function inferDaySequenceFromText(text) {
  const numbers = [...String(text || "").matchAll(/\b(\d{1,2})\b/g)]
    .map((match) => Number(match[1]))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);

  if (!numbers.length) return [];

  const uniqueDescending = [...new Set(numbers)].sort((left, right) => right - left);
  const maxDay = uniqueDescending[0];
  const minDay = uniqueDescending[uniqueDescending.length - 1];
  if (maxDay - minDay >= 4) {
    const contiguous = [];
    for (let day = maxDay; day >= minDay; day -= 1) {
      contiguous.push(day);
    }
    return contiguous;
  }

  return uniqueDescending;
}

function buildEvenlyDistributedHeader(dayNumbers, crop) {
  if (!dayNumbers.length) return [];
  const width = Number(crop.width || 0);
  const x = Number(crop.x || 0);
  const step = width / dayNumbers.length;
  return dayNumbers.map((day, index) => ({
    index,
    day,
    x: x + step * index + step / 2
  }));
}

function findOcrCycleHeader(words) {
  const lines = groupOcrWordsByLine(words, 12);
  let bestLine = null;
  let bestCount = 0;

  for (const line of lines) {
    const cycleWords = line.words
      .map((word) => {
        const normalized = normalizeSearchText(word.text).replace(/\s+/g, "").toUpperCase();
        if (!["A", "B", "C"].includes(normalized)) return null;
        return { ...word, cycle: normalized };
      })
      .filter(Boolean);

    if (cycleWords.length > bestCount) {
      bestCount = cycleWords.length;
      bestLine = cycleWords;
    }
  }

  return bestCount >= 5 ? bestLine.sort((left, right) => left.centerX - right.centerX) : null;
}

function findEmployeeLineFromOcr(words, employeeName) {
  const targetTokens = tokenizeNormalizedText(employeeName);
  if (!targetTokens.length) return null;

  let bestLine = null;

  for (const line of groupOcrWordsByLine(words)) {
    const score = getNameMatchScore(line.text, targetTokens);
    if (!bestLine || score > bestLine.score) {
      bestLine = { ...line, score };
    }
  }

  if (!bestLine) return null;
  if (bestLine.score < Math.max(4, targetTokens.length * 1.8)) return null;
  return bestLine;
}

function parseOcrImageSchedule(ocrWords, employeeName, fileName = "", rawText = "") {
  const words = normalizeOcrWords(ocrWords);
  const dayHeader = findOcrDayHeader(words);
  const employeeLine = findEmployeeLineFromOcr(words, employeeName);
  if (!dayHeader || !employeeLine) {
    throw new Error(t("importEmployeeNotFound"));
  }

  const referenceDate = parseReferenceDate(rawText);
  const resolvedDates = resolveDaySequence(dayHeader.map((item) => item.day), referenceDate);
  const headerCenters = dayHeader.map((item, index) => ({ index, day: item.day, x: item.centerX }));
  const spacingValues = headerCenters.slice(1).map((item, index) => Math.abs(item.x - headerCenters[index].x)).filter(Boolean);
  const averageSpacing = spacingValues.length ? spacingValues.reduce((sum, value) => sum + value, 0) / spacingValues.length : 34;
  const tolerance = Math.max(employeeLine.averageHeight * 1.2, 18);
  const rowWords = words.filter((word) => Math.abs(word.centerY - employeeLine.centerY) <= tolerance);
  const location = guessScheduleLocation(rawText, fileName);
  const picked = new Map();

  for (const word of rowWords) {
    const symbol = normalizeImportSymbol(word.text);
    if (!symbol) continue;
    const nearest = headerCenters
      .map((header) => ({ ...header, distance: Math.abs(header.x - word.centerX) }))
      .sort((left, right) => left.distance - right.distance)[0];
    if (!nearest || nearest.distance > averageSpacing * 0.65) continue;
    if (!picked.has(nearest.index)) {
      picked.set(nearest.index, symbol);
    }
  }

  const items = [...picked.entries()].map(([index, symbol]) => {
    const date = toDateInputValue(resolvedDates[index]);
    if (symbol === "M") {
      return {
        id: `import|assignment|${date}|محكمة حولي|A`,
        kind: "assignment",
        date,
        name: "محكمة حولي",
        time: "A",
        notes: "",
        color: "",
        source: "imported schedule",
        reminderOffsetMinutes: 0
      };
    }
    return {
      id: `import|assignment|${date}|${location}|${symbol}`,
      kind: "assignment",
      date,
      name: location,
      time: symbol,
      notes: "",
      color: "",
      source: "imported schedule",
      reminderOffsetMinutes: 0
    };
  });

  if (!items.length) {
    throw new Error(t("importNoRows"));
  }

  return {
    employeeName: String(employeeLine.text || employeeName).trim(),
    location,
    items
  };
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function getScheduleImageRegions(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return {
    names: {
      x: Math.floor(width * 0.57),
      y: Math.floor(height * 0.2),
      width: Math.floor(width * 0.4),
      height: Math.floor(height * 0.74)
    },
    header: {
      x: 0,
      y: Math.floor(height * 0.18),
      width: Math.floor(width * 0.52),
      height: Math.floor(height * 0.22)
    },
    dayNumbers: {
      x: 0,
      y: Math.floor(height * 0.285),
      width: Math.floor(width * 0.49),
      height: Math.floor(height * 0.08)
    },
    cycle: {
      x: 0,
      y: Math.floor(height * 0.325),
      width: Math.floor(width * 0.49),
      height: Math.floor(height * 0.065)
    },
    location: {
      x: Math.floor(width * 0.44),
      y: 0,
      width: Math.floor(width * 0.56),
      height: Math.floor(height * 0.18)
    }
  };
}

function createProcessedCropCanvas(image, crop, options = {}) {
  const scale = Number(options.scale || 2);
  const sx = Math.max(0, Math.floor(crop.x));
  const sy = Math.max(0, Math.floor(crop.y));
  const sw = Math.max(1, Math.floor(crop.width));
  const sh = Math.max(1, Math.floor(crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  if (options.grayscale || options.threshold || options.contrast || options.brightness) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const contrast = Number(options.contrast || 1);
    const brightness = Number(options.brightness || 0);
    const threshold = Number(options.threshold || 0);

    for (let index = 0; index < data.length; index += 4) {
      let red = data[index];
      let green = data[index + 1];
      let blue = data[index + 2];
      let luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

      if (options.grayscale || threshold) {
        red = green = blue = luminance;
      }

      if (contrast !== 1 || brightness) {
        red = ((red - 128) * contrast + 128) + brightness;
        green = ((green - 128) * contrast + 128) + brightness;
        blue = ((blue - 128) * contrast + 128) + brightness;
      }

      if (threshold) {
        luminance = (red + green + blue) / 3;
        const value = luminance >= threshold ? 255 : 0;
        red = green = blue = value;
      }

      data[index] = Math.max(0, Math.min(255, red));
      data[index + 1] = Math.max(0, Math.min(255, green));
      data[index + 2] = Math.max(0, Math.min(255, blue));
    }

    context.putImageData(imageData, 0, 0);
  }

  return { canvas, scale, crop: { x: sx, y: sy, width: sw, height: sh } };
}

async function recognizeImageCrop(image, crop, options = {}) {
  const { canvas, scale, crop: normalizedCrop } = createProcessedCropCanvas(image, crop, options);
  const Tesseract = await loadTesseract();
  const result = await Tesseract.recognize(canvas, options.lang || "ara+eng", {
    logger: () => {},
    tessedit_pageseg_mode: options.pageSegMode,
    tessedit_char_whitelist: options.whitelist
  });
  return {
    text: result?.data?.text || "",
    words: normalizeOcrWords(result?.data?.words || [], {
      scale,
      offsetX: normalizedCrop.x,
      offsetY: normalizedCrop.y
    })
  };
}

async function detectCellSymbol(image, crop) {
  const attempts = [
    { lang: "eng+ara", scale: 3, grayscale: true, threshold: 188, contrast: 2.2, brightness: 6, whitelist: "ANMم", pageSegMode: 10 },
    { lang: "eng+ara", scale: 3, grayscale: true, threshold: 160, contrast: 1.7, brightness: 0, whitelist: "ANMم", pageSegMode: 10 },
    { lang: "eng+ara", scale: 2.4, grayscale: true, contrast: 1.35, brightness: 0, whitelist: "ANMم", pageSegMode: 8 }
  ];

  for (const attempt of attempts) {
    const result = await recognizeImageCrop(image, crop, attempt);
    const combined = `${result.text} ${result.words.map((word) => word.text).join(" ")}`;
    const symbol = normalizeImportSymbol(combined);
    if (symbol) return symbol;
  }

  return "";
}

async function parseScheduleImageFile(image, employeeName, fileName = "") {
  const regions = getScheduleImageRegions(image);
  const [namesResult, dayNumbersResult, cycleResult, locationResult, headerResult] = await Promise.all([
    recognizeImageCrop(image, regions.names, { lang: "ara+eng", scale: 2.6, grayscale: true, threshold: 165, contrast: 1.6, brightness: 4, pageSegMode: 11 }),
    recognizeImageCrop(image, regions.dayNumbers, { lang: "eng", scale: 3, grayscale: true, threshold: 180, contrast: 1.9, brightness: 6, whitelist: "0123456789", pageSegMode: 11 }),
    recognizeImageCrop(image, regions.cycle, { lang: "eng", scale: 3, grayscale: true, threshold: 175, contrast: 2, brightness: 5, whitelist: "ABC", pageSegMode: 11 }),
    recognizeImageCrop(image, regions.location, { lang: "ara+eng", scale: 2, grayscale: true, contrast: 1.25, brightness: 2, pageSegMode: 6 })
    ,
    recognizeImageCrop(image, regions.header, { lang: "eng+ara", scale: 2.2, grayscale: true, threshold: 175, contrast: 1.4, brightness: 4, whitelist: "0123456789ABC", pageSegMode: 11 })
  ]);

  const employeeLine = findEmployeeLineFromOcr(namesResult.words, employeeName);
  const dayHeader = findOcrDayHeader(dayNumbersResult.words) || findOcrDayHeader(headerResult.words);
  const cycleHeader = dayHeader ? null : findOcrCycleHeader(cycleResult.words) || findOcrCycleHeader(headerResult.words);

  if (!employeeLine) {
    throw new Error(t("importEmployeeNotFound"));
  }

  const referenceDate = parseReferenceDate(`${headerResult.text}\n${locationResult.text}\n${namesResult.text}`);
  const inferredDayNumbers = dayHeader ? [] : inferDaySequenceFromText(`${dayNumbersResult.text}\n${headerResult.text}`);
  const headerCenters = dayHeader
    ? dayHeader.map((item, index) => ({ index, day: item.day, x: item.centerX }))
    : inferredDayNumbers.length
      ? buildEvenlyDistributedHeader(inferredDayNumbers, regions.dayNumbers)
    : cycleHeader
      ? cycleHeader.map((item, index) => ({ index, day: null, x: item.centerX }))
      : [];
  const resolvedDates = dayHeader
    ? resolveDaySequence(dayHeader.map((item) => item.day), referenceDate)
    : inferredDayNumbers.length
      ? resolveDaySequence(inferredDayNumbers, referenceDate)
    : headerCenters.map((_, index) => addDays(referenceDate, -index));

  if (!headerCenters.length) {
    throw new Error(t("importNoRows"));
  }

  const spacingValues = headerCenters.slice(1).map((item, index) => Math.abs(item.x - headerCenters[index].x)).filter(Boolean);
  const averageSpacing = spacingValues.length ? spacingValues.reduce((sum, value) => sum + value, 0) / spacingValues.length : 34;
  const rowHeight = Math.max(24, employeeLine.averageHeight * 1.6);
  const location = guessScheduleLocation(`${locationResult.text}\n${namesResult.text}`, fileName);
  const items = [];

  for (const header of headerCenters) {
    const symbol = await detectCellSymbol(image, {
      x: header.x - averageSpacing * 0.48,
      y: employeeLine.centerY - rowHeight * 0.52,
      width: averageSpacing * 0.96,
      height: rowHeight * 1.04
    });

    if (!symbol) continue;
    const date = toDateInputValue(resolvedDates[header.index]);

    if (symbol === "M") {
      items.push({
        id: `import|assignment|${date}|محكمة حولي|A`,
        kind: "assignment",
        date,
        name: "محكمة حولي",
        time: "A",
        notes: "",
        color: "",
        source: "imported schedule",
        reminderOffsetMinutes: 0
      });
      continue;
    }

    items.push({
      id: `import|assignment|${date}|${location}|${symbol}`,
      kind: "assignment",
      date,
      name: location,
      time: symbol,
      notes: "",
      color: "",
      source: "imported schedule",
      reminderOffsetMinutes: 0
    });
  }

  if (!items.length) {
    throw new Error(t("importNoRows"));
  }

  return {
    employeeName: String(employeeLine.text || employeeName).trim(),
    location,
    items,
    rawText: [locationResult.text, namesResult.text, headerResult.text].filter(Boolean).join("\n")
  };
}

function parseMatrixSchedule(matrix, employeeName, fileName = "", rawText = "") {
  const employeeRowInfo = findEmployeeRow(matrix, employeeName);
  if (!employeeRowInfo) {
    throw new Error(t("importEmployeeNotFound"));
  }

  const header = findDayHeaderRow(matrix);
  if (!header) {
    throw new Error(t("importNoRows"));
  }

  const referenceDate = parseReferenceDate(rawText);
  const dayColumns = [];
  header.row.forEach((cell, index) => {
    const day = Number(cell);
    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      dayColumns.push({ index, day });
    }
  });
  const resolvedDates = resolveDaySequence(dayColumns.map((item) => item.day), referenceDate);
  const location = guessScheduleLocation(rawText, fileName);
  const items = [];

  dayColumns.forEach((column, index) => {
    const symbol = normalizeImportSymbol(employeeRowInfo.row[column.index]);
    if (!symbol) return;
    const date = toDateInputValue(resolvedDates[index]);
    if (symbol === "M") {
      items.push({
        id: `import|assignment|${date}|محكمة حولي|A`,
        kind: "assignment",
        date,
        name: "محكمة حولي",
        time: "A",
        notes: "",
        color: "",
        source: "imported schedule",
        reminderOffsetMinutes: 0
      });
      return;
    }
    items.push({
      id: `import|assignment|${date}|${location}|${symbol}`,
      kind: "assignment",
      date,
      name: location,
      time: symbol,
      notes: "",
      color: "",
      source: "imported schedule",
      reminderOffsetMinutes: 0
    });
  });

  if (!items.length) {
    throw new Error(t("importNoRows"));
  }

  return {
    employeeName: String(employeeRowInfo.matchedText || employeeName).trim(),
    location,
    items
  };
}

function parseJsonSchedule(text, employeeName, fileName = "") {
  const payload = JSON.parse(text);
  if (Array.isArray(payload)) {
    const items = payload.map((entry, index) => normalizeEntry({ ...entry, source: entry.source || "imported schedule" }, index));
    return { employeeName, location: guessScheduleLocation(text, fileName), items };
  }
  if (Array.isArray(payload.items)) {
    const items = payload.items.map((entry, index) => normalizeEntry({ ...entry, source: entry.source || "imported schedule" }, index));
    return { employeeName, location: payload.location || guessScheduleLocation(text, fileName), items };
  }
  if (payload.matrix && Array.isArray(payload.matrix)) {
    return parseMatrixSchedule(payload.matrix, employeeName, fileName, text);
  }
  throw new Error(t("importUnsupportedFile"));
}

let tesseractLoaderPromise = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoaderPromise) return tesseractLoaderPromise;
  tesseractLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("Unable to load OCR library"));
    document.head.appendChild(script);
  });
  return tesseractLoaderPromise;
}

async function readImportFile(file) {
  const fileName = file?.name || "";
  const fileType = file?.type || "";
  if (!file) throw new Error(t("importNoFile"));

  if (fileType.startsWith("image/")) {
    const imageElement = await loadImageElement(file);
    return { text: "", fileName, image: true, imageElement };
  }

  const text = await file.text();
  return { text, fileName, image: false };
}

async function extractImportPreview({ file, employeeName, rawText = "" }) {
  const payload = file ? await readImportFile(file) : { text: rawText, fileName: "", image: false };
  const normalizedName = String(employeeName || "").trim();
  const text = String(rawText || payload.text || "");
  let parsed;

  if (payload.image && payload.imageElement) {
    try {
      parsed = await parseScheduleImageFile(payload.imageElement, normalizedName, payload.fileName);
    } catch (error) {
      try {
        const Tesseract = await loadTesseract();
        const result = await Tesseract.recognize(payload.imageElement, "ara+eng", { logger: () => {} });
        parsed = parseOcrImageSchedule(result?.data?.words || [], normalizedName, payload.fileName, result?.data?.text || "");
      } catch (fallbackError) {
        throw error?.message ? error : fallbackError;
      }
    }
  } else if (payload.fileName.toLowerCase().endsWith(".json") || /^[\[{]/.test(text.trim())) {
    parsed = parseJsonSchedule(text, normalizedName, payload.fileName);
  } else {
    const matrix = parseDelimitedText(text);
    parsed = parseMatrixSchedule(matrix, normalizedName, payload.fileName, text);
  }

  return {
    ...parsed,
    fileName: payload.fileName,
    rawText: parsed.rawText || text,
    image: payload.image
  };
}

function requestJson(url, options = {}) {
  return fetch(url, { cache: "no-store", ...options }).then(async (response) => {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${text.slice(0, 160)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 160)}`);
    }
  });
}

async function apiRequest(action, payload = {}) {
  if (config.dataMode !== "google-apps-script" || !config.googleAppsScriptUrl) {
    throw new Error("Google Apps Script URL is missing");
  }

  const cacheKey = getApiCacheKey(action, payload);
  const cached = getCachedApiResponse(action, payload);
  if (cached) {
    return cached;
  }

  if (pendingApiRequests.has(cacheKey)) {
    return cloneValue(await pendingApiRequests.get(cacheKey));
  }

  const requestPromise = requestJson(config.googleAppsScriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ action, ...payload })
  });

  pendingApiRequests.set(cacheKey, requestPromise);

  let data;
  try {
    data = await requestPromise;
  } finally {
    pendingApiRequests.delete(cacheKey);
  }

  if (data.ok === false) {
    throw new Error(data.error || t("saveFailed"));
  }

  if (isCacheableAction(action)) {
    setCachedApiResponse(action, payload, data);
  } else {
    clearApiCache();
  }

  return data;
}

function pushToast(message, type = "success") {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  state.toasts = [...state.toasts, { id, message, type }];
  renderToasts();
  window.setTimeout(() => {
    state.toasts = state.toasts.filter((toast) => toast.id !== id);
    renderToasts();
  }, 3200);
}

function setModal(content) {
  state.modal = content;
  renderModal();
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function toggleActionMenu(forceValue = null) {
  state.actionMenuOpen = typeof forceValue === "boolean" ? forceValue : !state.actionMenuOpen;
  render();
}

function closeActionMenu() {
  if (!state.actionMenuOpen) return;
  state.actionMenuOpen = false;
  render();
}

function renderPasswordField({ id, name, value = "", autocomplete = "current-password", placeholder = "" }) {
  return `
    <div class="password-field">
      <input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
      <button class="password-toggle" type="button" data-password-toggle="${id}" aria-label="${escapeHtml(t("showPassword"))}" title="${escapeHtml(t("showPassword"))}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z"></path>
          <circle cx="12" cy="12" r="3.5"></circle>
        </svg>
      </button>
    </div>
  `;
}

function bindPasswordToggles(root = document) {
  root.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.passwordToggle);
      if (!target) return;
      const showing = target.type === "text";
      target.type = showing ? "password" : "text";
      const nextLabel = showing ? t("showPassword") : t("hidePassword");
      button.setAttribute("aria-label", nextLabel);
      button.setAttribute("title", nextLabel);
      button.classList.toggle("is-active", !showing);
    });
  });
}

function setFormBusy(formElement, isBusy) {
  if (!formElement) return;
  formElement.querySelectorAll("button, input, select, textarea").forEach((element) => {
    if (element.tagName === "BUTTON") {
      element.disabled = isBusy;
      return;
    }
    if (element.name) {
      element.disabled = isBusy;
    }
  });
}

function renderLoadingPage() {
  return `
    <div class="auth-layout" dir="${getDir()}">
      <div class="panel auth-card">
        <div class="hero-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83"></path>
          </svg>
        </div>
        <h1 class="title">${escapeHtml(config.appTitle)}</h1>
        <p class="subtitle">${t("loading")}</p>
      </div>
    </div>
  `;
}

function renderAuthPage() {
  return `
    <div class="auth-layout" dir="${getDir()}">
      <div class="panel auth-card">
        <div class="hero-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"></path>
          </svg>
        </div>
        <h1 class="title">${escapeHtml(config.appTitle)}</h1>
        <p class="subtitle">${t("appTagline")}</p>
        <form id="login-form" class="auth-form">
          <div class="field">
            <label for="login-username">${t("username")} / ${t("employeeId")}</label>
            <input id="login-username" name="identifier" autocomplete="username" />
          </div>
          <div class="field">
            <label for="login-password">${t("password")}</label>
            ${renderPasswordField({ id: "login-password", name: "password", autocomplete: "current-password" })}
          </div>
          <div class="button-row">
            <button class="btn btn-primary" type="submit">${t("login")}</button>
          </div>
        </form>
        <div style="margin-top: 12px;">
          <button class="muted-button" id="forgot-password-btn" type="button">${t("forgotPassword")}</button>
        </div>
        <div class="split">${state.currentLanguage === "ar" ? "أو" : "OR"}</div>
        <button class="btn btn-secondary" id="open-register-btn" type="button">${t("register")}</button>
        <div class="support-box">
          <div>${t("support")}: ${escapeHtml(config.supportContact)}</div>
          <a href="tel:${escapeHtml(config.supportPhone)}">${escapeHtml(config.supportPhone)}</a>
        </div>
        <div class="auth-footer-actions">
          <button class="btn btn-ghost" id="toggle-language-btn" type="button">${state.currentLanguage === "ar" ? "English" : "العربية"}</button>
          <button class="admin-entry-button" id="admin-login-btn" type="button" aria-label="${escapeHtml(t("adminLogin"))}" title="${escapeHtml(t("adminLogin"))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M12 3 5 6v5c0 4.5 2.9 8.3 7 9.5 4.1-1.2 7-5 7-9.5V6l-7-3Z"></path>
              <path d="M9.75 12.25 11.2 13.7l3.3-3.4"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderToolbarButton(id, text, variant = "btn-secondary", extraClass = "") {
  const classes = `btn ${variant} ${extraClass}`.trim().replace(/\s+/g, " ");
  return `<button class="${classes}" id="${id}" type="button">${text}</button>`;
}

function renderActionMenuButton(id, text, variant = "btn-secondary") {
  return renderToolbarButton(id, text, variant, "menu-action-btn");
}

function renderDayCell(date, isOtherMonth) {
  const dateStr = toDateInputValue(date);
  const entries = getEntriesForDate(dateStr);
  const status = getDayStatus(dateStr);
  const hasAssignment = entries.some((entry) => entry.kind === "assignment");
  const hasGuard = entries.some((entry) => entry.kind === "guard");
  const accentEntry = !hasAssignment || !hasGuard ? getEntryAccentEntry(entries) : null;
  const classes = ["day-cell"];
  const style = accentEntry?.color ? getEntryColorVars(accentEntry.color) : "";

  if (isOtherMonth) classes.push("day-other-month");
  if (hasAssignment && hasGuard) {
    classes.push("day-mixed");
  } else if (hasAssignment) {
    classes.push("day-assignment");
    if (accentEntry?.color) classes.push("day-colored");
  } else if (hasGuard) {
    classes.push("day-guard");
    if (accentEntry?.color) classes.push("day-colored");
  } else if (status.shiftStatus === "duty") {
    classes.push(`day-shift-${String(state.currentUser.shift).toLowerCase()}`);
  } else {
    classes.push("day-off");
  }

  let badge = "";
  if (hasAssignment && hasGuard) badge = `<span class="badge">${t("mixedDay")}</span>`;
  else if (hasAssignment) badge = `<span class="badge">${t("assignment")}</span>`;
  else if (hasGuard) badge = `<span class="badge">${t("guard")}</span>`;

  return `
    <button class="${classes.join(" ")}" type="button" data-day="${dateStr}" ${style ? `style="${style}"` : ""}>
      ${badge || "<span class='badge badge-empty'></span>"}
      <div class="day-number">${date.getDate()}</div>
      <div class="day-label">${escapeHtml(status.label)}</div>
    </button>
  `;
}

function renderUserActionMenu() {
  return `
    <div class="action-menu-shell">
      <button class="menu-toggle" id="toggle-action-menu-btn" type="button" aria-expanded="${state.actionMenuOpen ? "true" : "false"}" aria-label="${escapeHtml(t("quickActions"))}">
        <span></span><span></span><span></span>
      </button>
      ${
        state.actionMenuOpen
          ? `<div class="panel action-menu-panel">
              <div class="action-menu-title">${t("quickActions")}</div>
              <div class="action-menu-grid">
                ${renderActionMenuButton("search-btn", t("search"))}
                ${renderActionMenuButton("import-schedule-btn", t("bulkAddTitle"))}
                ${renderActionMenuButton("settings-btn", t("settings"))}
                ${renderActionMenuButton("add-assignment-btn", t("addAssignment"), "btn-primary")}
                ${state.currentUser.shift === "M" ? renderActionMenuButton("add-guard-btn", t("addGuard")) : ""}
                ${renderActionMenuButton("edit-assignment-btn", t("editAssignmentMenu"))}
                ${renderActionMenuButton("delete-assignment-btn", t("deleteAssignmentMenu"), "btn-danger")}
                ${renderActionMenuButton("logout-btn", t("logout"), "btn-danger")}
              </div>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderAdminActionMenu() {
  return `
    <div class="action-menu-shell">
      <button class="menu-toggle" id="toggle-action-menu-btn" type="button" aria-expanded="${state.actionMenuOpen ? "true" : "false"}" aria-label="${escapeHtml(t("quickActions"))}">
        <span></span><span></span><span></span>
      </button>
      ${
        state.actionMenuOpen
          ? `<div class="panel action-menu-panel">
              <div class="action-menu-title">${t("quickActions")}</div>
              <div class="action-menu-grid">
                ${renderActionMenuButton("admin-refresh-btn", t("refresh"))}
                ${renderActionMenuButton("logout-btn", t("logout"), "btn-danger")}
              </div>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderStatsCards() {
  const monthAssignments = getMonthEntries("assignment");
  const monthGuards = getMonthEntries("guard");
  const totalAmount = monthAssignments.length * config.assignmentRate;
  const guardCard =
    state.currentUser.shift === "M"
      ? `<article class="panel stat-card">
          <div>
            <div class="stat-label">${t("totalGuards")}</div>
            <div class="stat-value">${monthGuards.length}</div>
          </div>
        </article>`
      : "";

  return `
    <section class="stats-grid">
      <article class="panel stat-card">
        <div>
          <div class="stat-label">${t("totalAssignments")}</div>
          <div class="stat-value">${monthAssignments.length}</div>
        </div>
      </article>
      ${guardCard}
      <article class="panel stat-card">
        <div>
          <div class="stat-label">${t("totalAmount")}</div>
          <div class="stat-value">${totalAmount} ${t("dinar")}</div>
        </div>
      </article>
    </section>
  `;
}

function renderSmartSearchPanel() {
  return `
    <section class="panel utility-panel" id="smart-search-panel">
      <h2 class="section-title">${t("smartSearchTitle")}</h2>
      <p class="tiny utility-hint">${t("smartSearchExamples")}</p>
      <form id="smart-search-form" class="utility-form">
        <div class="field grow">
          <label>${t("smartSearchTitle")}</label>
          <input id="smart-search-input" name="query" value="${escapeHtml(state.smartSearchQuery)}" placeholder="${escapeHtml(t("smartSearchPlaceholder"))}" />
        </div>
        <div class="button-row compact-actions">
          <button class="btn btn-primary" type="submit">${t("smartSearchRun")}</button>
          <button class="btn btn-secondary" id="smart-search-reset-btn" type="button">${t("smartSearchReset")}</button>
        </div>
      </form>
      <div class="search-section">
        <h3 class="subheading">${t("smartSearchResultTitle")}</h3>
        ${renderSmartSearchResultCard(state.smartSearchResult)}
      </div>
    </section>
  `;
}

function renderUtilityLaunchers() {
  return `
    <section class="utility-launchers">
      <button class="panel utility-launcher ${state.smartSearchOpen ? "is-active" : ""}" id="toggle-smart-search-panel-btn" type="button" aria-expanded="${state.smartSearchOpen ? "true" : "false"}" aria-label="${escapeHtml(t("smartSearchTitle"))}">
        <span class="utility-launcher-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 5 5"></path>
          </svg>
        </span>
        <span class="utility-launcher-label">${t("smartSearchTitle")}</span>
      </button>
      <button class="panel utility-launcher ${state.importPanelOpen ? "is-active" : ""}" id="toggle-import-panel-btn" type="button" aria-expanded="${state.importPanelOpen ? "true" : "false"}" aria-label="${escapeHtml(t("bulkAddTitle"))}">
        <span class="utility-launcher-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
          </svg>
        </span>
        <span class="utility-launcher-label">${t("bulkAddTitle")}</span>
      </button>
    </section>
  `;
}

function renderImportPreview() {
  if (!state.importPreview?.items?.length) {
    return `<div class="empty-panel">${t("bulkNoPreview")}</div>`;
  }

  return `
    <div class="day-summary-card">
      <div><strong>${t("bulkItemsCount")}:</strong> ${state.importPreview.items.length}</div>
      <div><strong>${t("assignmentName")}:</strong> ${escapeHtml(state.importPreview.name)}</div>
      <div><strong>${t("assignmentTime")}:</strong> ${escapeHtml(getPresetTimeLabel(state.importPreview.time))}</div>
    </div>
    ${
      state.importPreview.invalidDates?.length
        ? `<div class="notice compact">${t("bulkInvalidDatesLabel")}: ${escapeHtml(state.importPreview.invalidDates.join("، "))}</div>`
        : ""
    }
    <div class="tiny">${t("bulkDateUpdatedHint")}</div>
    <div class="list search-entry-list">
      ${state.importPreview.items.map((entry) => renderEntryCard(entry, false)).join("")}
    </div>
  `;
}

function renderImportPanel() {
  const selectedName = state.importForm.namePreset || "other";
  const selectedTime = state.importForm.timePreset || "A";
  return `
    <section class="panel utility-panel" id="bulk-add-panel">
      <h2 class="section-title">${t("bulkAddTitle")}</h2>
      <p class="tiny utility-hint">${t("bulkAddHint")}</p>
      <form id="bulk-add-form" class="utility-form">
        <div class="field grow">
          <label>${t("bulkDates")}</label>
          <textarea id="bulk-dates-input" name="datesText" rows="5" placeholder="${escapeHtml(t("bulkDatesPlaceholder"))}">${escapeHtml(state.importForm.datesText)}</textarea>
        </div>
        <div class="field grow">
          <label>${t("assignmentName")}</label>
          <select name="namePreset" id="bulk-name-preset">
            ${renderClinicOptions(selectedName)}
          </select>
          <input name="nameCustom" id="bulk-name-custom" placeholder="${t("other")}" value="${selectedName === "other" ? escapeHtml(state.importForm.nameCustom) : ""}" style="display: none;" />
        </div>
        <div class="field grow">
          <label>${t("assignmentTime")}</label>
          <select name="timePreset" id="bulk-time-preset">
            <option value="N" ${selectedTime === "N" ? "selected" : ""}>${t("night")}</option>
            <option value="A" ${selectedTime === "A" ? "selected" : ""}>${t("morning")}</option>
            <option value="other" ${selectedTime === "other" ? "selected" : ""}>${t("other")}</option>
          </select>
          <input name="timeCustom" id="bulk-time-custom" type="time" value="${selectedTime === "other" ? escapeHtml(state.importForm.timeCustom) : ""}" style="display: none;" />
        </div>
        <div class="field grow">
          <label>${t("notes")}</label>
          <textarea name="notes" rows="3" placeholder="${t("notes")}">${escapeHtml(state.importForm.notes)}</textarea>
        </div>
        <div class="field">
          <label>${t("entryColor")}</label>
          ${renderColorOptions(state.importForm.color, "bulk-add")}
        </div>
        <div class="field">
          <label>${t("reminder")}</label>
          <select name="reminderOffsetMinutes">
            ${getReminderOptions()
              .map(
                (option) =>
                  `<option value="${option.value}" ${option.value === normalizeReminder(state.importForm.reminderOffsetMinutes) ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="button-row compact-actions">
          <button class="btn btn-primary" type="submit" ${state.importBusy ? "disabled" : ""}>${state.importBusy ? t("importBusy") : t("bulkPrepare")}</button>
          <button class="btn btn-secondary" id="bulk-add-clear-btn" type="button">${t("bulkClear")}</button>
        </div>
      </form>
      <div class="field">
        <label>${t("bulkPreviewTitle")}</label>
        ${renderImportPreview()}
      </div>
      <div class="button-row compact-actions">
        <button class="btn btn-success" id="save-bulk-preview-btn" type="button" ${state.importPreview?.items?.length ? "" : "disabled"}>${t("bulkSave")}</button>
      </div>
    </section>
  `;
}

function renderCalendarPage() {
  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevMonthDays = new Date(state.currentYear, state.currentMonth, 0).getDate();

  let dayCells = "";
  for (let i = startDay - 1; i >= 0; i -= 1) {
    dayCells += renderDayCell(new Date(state.currentYear, state.currentMonth - 1, prevMonthDays - i), true);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    dayCells += renderDayCell(new Date(state.currentYear, state.currentMonth, day), false);
  }
  const trailing = (7 - ((startDay + daysInMonth) % 7)) % 7;
  for (let i = 1; i <= trailing; i += 1) {
    dayCells += renderDayCell(new Date(state.currentYear, state.currentMonth + 1, i), true);
  }

  return `
    <div class="page-shell" dir="${getDir()}">
      <div class="topbar">
        <div>
          <h1 class="title title-inline">${t("calendar")}</h1>
          <p class="subtitle subtitle-inline">${escapeHtml(config.appTitle)} · ${t("userPanel")}</p>
        </div>
        ${renderUserActionMenu()}
      </div>

      <section class="panel user-strip">
        <div class="profile-pill">
          <div class="avatar">${escapeHtml(state.currentUser.username.slice(0, 2).toUpperCase())}</div>
          <div>
            <div class="user-heading">${escapeHtml(state.currentUser.username)}</div>
            <div class="tiny">${t("employeeId")}: ${escapeHtml(state.currentUser.employee_id || "-")}</div>
            <div class="tiny">${t("shift")}: ${escapeHtml(state.currentUser.shift)}</div>
          </div>
        </div>
      </section>

      <section class="panel calendar-card">
        <div class="calendar-header">
          <div class="inline-actions inline-actions-month">
            ${renderToolbarButton("prev-month-btn", "‹")}
            <button class="btn btn-ghost month-label" id="open-month-picker-btn" type="button">${formatMonthLabel(state.currentMonth, state.currentYear)}</button>
            ${renderToolbarButton("next-month-btn", "›")}
          </div>
        </div>

        <div class="calendar-weekdays">
          ${dayNames[state.currentLanguage].map((day) => `<div class="weekday">${day}</div>`).join("")}
        </div>
        <div class="calendar-grid">${dayCells}</div>
      </section>

      ${renderUtilityLaunchers()}

      ${
        state.smartSearchOpen || state.importPanelOpen
          ? `<section class="utility-grid">
              ${state.smartSearchOpen ? renderSmartSearchPanel() : ""}
              ${state.importPanelOpen ? renderImportPanel() : ""}
            </section>`
          : ""
      }

      ${renderStatsCards()}
    </div>
  `;
}

function renderAdminPage() {
  const users = state.adminUsers || [];

  return `
    <div class="page-shell" dir="${getDir()}">
      <div class="topbar">
        <div>
          <h1 class="title title-inline">${t("adminPanel")}</h1>
          <p class="subtitle subtitle-inline">${t("adminSession")}</p>
        </div>
        ${renderAdminActionMenu()}
      </div>

      <section class="panel admin-search-panel">
        <form id="admin-search-form" class="admin-search-form">
          <div class="field grow">
            <label>${t("adminSearch")}</label>
            <input name="query" value="${escapeHtml(state.adminQuery)}" />
          </div>
          <div class="button-row compact-actions">
            <button class="btn btn-primary" type="submit">${t("search")}</button>
            <button class="btn btn-secondary" id="admin-clear-search-btn" type="button">${t("allUsers")}</button>
          </div>
        </form>
      </section>

      <section class="admin-grid">
        ${users.length
          ? users
              .map((user) => `
                <article class="panel admin-card">
                  <div class="admin-card-head">
                    <div>
                      <div class="user-heading">${escapeHtml(user.username)}</div>
                      <div class="tiny">${t("employeeId")}: ${escapeHtml(user.employee_id)}</div>
                    </div>
                    <span class="shift-chip shift-${String(user.shift).toLowerCase()}">${escapeHtml(user.shift)}</span>
                  </div>
                  <div class="admin-stats">
                    <div>
                      <span class="tiny">${t("adminAssignmentCount")}</span>
                      <strong>${user.assignmentCount ?? 0}</strong>
                    </div>
                    <div>
                      <span class="tiny">${t("adminGuardCount")}</span>
                      <strong>${user.guardCount ?? 0}</strong>
                    </div>
                  </div>
                  <button class="btn btn-secondary" type="button" data-admin-user="${escapeHtml(user.id)}">${t("adminOpen")}</button>
                </article>
              `)
              .join("")
          : `<section class="panel empty-panel">${t("adminNoResults")}</section>`}
      </section>
    </div>
  `;
}

function renderToasts() {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  stack.innerHTML = state.toasts
    .map((toast) => `<div class="toast toast-${toast.type}">${escapeHtml(toast.message)}</div>`)
    .join("");
}

function renderModal() {
  const root = document.getElementById("modal-root");
  if (!state.modal) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="panel modal-card">
        ${state.modal}
      </div>
    </div>
  `;
  const backdrop = document.getElementById("modal-backdrop");
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
  });
}

function render() {
  document.documentElement.lang = state.currentLanguage;
  document.documentElement.dir = getDir();
  document.documentElement.style.setProperty("--primary", config.primaryColor);

  const app = document.getElementById("app");
  if (state.loading) {
    app.innerHTML = renderLoadingPage();
  } else if (state.sessionKind === "admin" && state.sessionToken) {
    app.innerHTML = renderAdminPage();
    bindAdminActions();
  } else if (!state.currentUser) {
    app.innerHTML = renderAuthPage();
    bindAuthActions();
  } else {
    app.innerHTML = renderCalendarPage();
    bindCalendarActions();
  }
  renderModal();
  renderToasts();
}

function bindAuthActions() {
  document.getElementById("login-form")?.addEventListener("submit", handleLogin);
  bindPasswordToggles(document);
  document.getElementById("toggle-language-btn")?.addEventListener("click", () => {
    state.currentLanguage = state.currentLanguage === "ar" ? "en" : "ar";
    render();
  });
  document.getElementById("open-register-btn")?.addEventListener("click", openRegisterModal);
  document.getElementById("forgot-password-btn")?.addEventListener("click", openForgotPasswordModal);
  document.getElementById("admin-login-btn")?.addEventListener("click", openAdminLoginModal);
}

function bindCalendarActions() {
  document.getElementById("toggle-action-menu-btn")?.addEventListener("click", () => toggleActionMenu());
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    closeActionMenu();
    handleLogout();
  });
  document.getElementById("settings-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openSettingsModal();
  });
  document.getElementById("search-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openUtilityPanel("search", "smart-search-input");
  });
  document.getElementById("import-schedule-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openUtilityPanel("import", "bulk-dates-input");
  });
  document.getElementById("toggle-smart-search-panel-btn")?.addEventListener("click", () => toggleUtilityPanel("search", "smart-search-input"));
  document.getElementById("toggle-import-panel-btn")?.addEventListener("click", () => toggleUtilityPanel("import", "bulk-dates-input"));
  document.getElementById("add-assignment-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openScheduleItemModal({ mode: "add", kind: "assignment", dateStr: toDateInputValue(new Date()) });
  });
  document.getElementById("add-guard-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openScheduleItemModal({ mode: "add", kind: "guard", dateStr: toDateInputValue(new Date()) });
  });
  document.getElementById("edit-assignment-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openManageItemsModal("edit");
  });
  document.getElementById("delete-assignment-btn")?.addEventListener("click", () => {
    closeActionMenu();
    openManageItemsModal("delete");
  });
  document.getElementById("prev-month-btn")?.addEventListener("click", () => changeMonth(-1));
  document.getElementById("next-month-btn")?.addEventListener("click", () => changeMonth(1));
  document.getElementById("open-month-picker-btn")?.addEventListener("click", openMonthPickerModal);
  document.querySelectorAll("[data-day]").forEach((button) => {
    button.addEventListener("click", () => {
      closeActionMenu();
      openDayDetailsModal(button.dataset.day);
    });
  });
  document.getElementById("smart-search-form")?.addEventListener("submit", handleSmartSearchSubmit);
  document.getElementById("smart-search-reset-btn")?.addEventListener("click", resetSmartSearch);
  document.querySelectorAll("[data-smart-open-day]").forEach((button) => {
    button.addEventListener("click", () => openDayDetailsModal(button.dataset.smartOpenDay));
  });
  document.getElementById("bulk-add-form")?.addEventListener("submit", handleImportExtract);
  document.getElementById("bulk-add-clear-btn")?.addEventListener("click", resetImportPanel);
  document.getElementById("save-bulk-preview-btn")?.addEventListener("click", saveImportPreview);
  toggleCustomFields("bulk-name-preset", "bulk-name-custom");
  toggleCustomFields("bulk-time-preset", "bulk-time-custom");
  bindColorPicker("bulk-add");
}

function focusUtilityPanel(panelId, inputId = "") {
  const panel = document.getElementById(panelId);
  panel?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (inputId) {
    window.setTimeout(() => document.getElementById(inputId)?.focus(), 180);
  }
}

function openUtilityPanel(panel, inputId = "") {
  state.smartSearchOpen = panel === "search";
  state.importPanelOpen = panel === "import";
  render();
  focusUtilityPanel(panel === "search" ? "smart-search-panel" : "bulk-add-panel", inputId);
}

function toggleUtilityPanel(panel, inputId = "") {
  const isSearch = panel === "search";
  const isCurrentlyOpen = isSearch ? state.smartSearchOpen : state.importPanelOpen;
  if (isCurrentlyOpen) {
    state.smartSearchOpen = false;
    state.importPanelOpen = false;
    render();
    return;
  }
  openUtilityPanel(panel, inputId);
}

function handleSmartSearchSubmit(event) {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("query") || "").trim();
  state.smartSearchQuery = query;
  state.smartSearchResult = buildSmartSearchResult(query);
  state.smartSearchOpen = true;
  render();
  focusUtilityPanel("smart-search-panel");
}

function resetSmartSearch() {
  state.smartSearchQuery = "";
  state.smartSearchResult = null;
  state.smartSearchOpen = true;
  render();
  focusUtilityPanel("smart-search-panel", "smart-search-input");
}

function normalizeBulkDateText(value) {
  const eastern = "٠١٢٣٤٥٦٧٨٩";
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => String(eastern.indexOf(digit)))
    .replace(/[،؛]/g, ",");
}

function parseBulkDateList(text) {
  const normalized = normalizeBulkDateText(text);
  const tokens = normalized
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const dates = [];

  for (const token of tokens) {
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(token)) {
      const [year, month, day] = token.split(/[-/]/).map(Number);
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        dates.push(toDateInputValue(date));
      }
      continue;
    }

    if (/^\d{1,2}\s*-\s*\d{1,2}$/.test(token)) {
      const [startDay, endDay] = token.split("-").map((part) => Number(part.trim()));
      if (!Number.isInteger(startDay) || !Number.isInteger(endDay) || endDay < startDay) continue;
      for (let day = startDay; day <= endDay; day += 1) {
        const date = new Date(state.currentYear, state.currentMonth, day);
        if (date.getMonth() === state.currentMonth && date.getDate() === day) {
          dates.push(toDateInputValue(date));
        }
      }
      continue;
    }

    if (/^\d{1,2}$/.test(token)) {
      const day = Number(token);
      const date = new Date(state.currentYear, state.currentMonth, day);
      if (date.getMonth() === state.currentMonth && date.getDate() === day) {
        dates.push(toDateInputValue(date));
      }
    }
  }

  return [...new Set(dates)].sort();
}

function buildBulkAddPreview(formData) {
  const dates = parseBulkDateList(formData.datesText);
  if (!dates.length) {
    throw new Error(t("bulkNoDates"));
  }

  const namePreset = String(formData.namePreset || "other");
  const timePreset = String(formData.timePreset || "A");
  const finalName = namePreset === "other" ? String(formData.nameCustom || "").trim() : getClinicLabel(namePreset);
  const finalTime = timePreset === "other" ? String(formData.timeCustom || "").trim() : timePreset;
  const notes = String(formData.notes || "").trim();
  const color = normalizeEntryColor(formData.color);
  const reminderOffsetMinutes = normalizeReminder(formData.reminderOffsetMinutes);

  if (namePreset === "other" && !finalName) {
    throw new Error(t("customNameRequired"));
  }
  if (timePreset === "other" && !finalTime) {
    throw new Error(t("customTimeRequired"));
  }

  const invalidDates = [];
  const items = [];

  dates.forEach((dateStr, index) => {
    const date = new Date(`${dateStr}T00:00:00`);
    if (!canAssignOnDate(date, state.currentUser.shift)) {
      invalidDates.push(dateStr);
      return;
    }

    items.push(
      normalizeEntry(
        {
          id: `bulk|assignment|${dateStr}|${finalName}|${finalTime}`,
          kind: "assignment",
          date: dateStr,
          name: finalName,
          time: finalTime,
          notes,
          color,
          source: "",
          reminderOffsetMinutes
        },
        index
      )
    );
  });

  if (!items.length) {
    throw new Error(t("bulkInvalidDates"));
  }

  return {
    employeeName: state.currentUser?.username || "",
    name: finalName,
    time: finalTime,
    invalidDates,
    items
  };
}

async function handleImportExtract(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);

  try {
    state.importBusy = true;
    state.importForm = {
      datesText: String(form.get("datesText") || ""),
      namePreset: String(form.get("namePreset") || "other"),
      nameCustom: String(form.get("nameCustom") || "").trim(),
      timePreset: String(form.get("timePreset") || "A"),
      timeCustom: String(form.get("timeCustom") || "").trim(),
      notes: String(form.get("notes") || "").trim(),
      color: normalizeEntryColor(form.get("color")),
      reminderOffsetMinutes: normalizeReminder(form.get("reminderOffsetMinutes"))
    };
    render();
    const preview = buildBulkAddPreview(state.importForm);
    state.importBusy = false;
    state.importPanelOpen = true;
    state.importPreview = preview;
    render();
    pushToast(preview.invalidDates.length ? t("bulkInvalidDates") : t("bulkReady"), preview.invalidDates.length ? "error" : "success");
    focusUtilityPanel("bulk-add-panel");
  } catch (error) {
    console.error(error);
    state.importBusy = false;
    state.importPreview = null;
    state.importPanelOpen = true;
    render();
    pushToast(error.message || t("saveFailed"), "error");
    focusUtilityPanel("bulk-add-panel");
  } finally {
    setFormBusy(formElement, false);
  }
}

function resetImportPanel() {
  state.importBusy = false;
  state.importForm = createBulkAddFormState();
  state.importPreview = null;
  state.importPanelOpen = true;
  render();
  focusUtilityPanel("bulk-add-panel", "bulk-dates-input");
}

async function saveImportPreview() {
  if (!state.importPreview?.items?.length) {
    pushToast(t("bulkNoPreview"), "error");
    return;
  }
  try {
    const data = await apiRequest("bulkUpsertAssignments", {
      sessionToken: state.sessionToken,
      assignments: state.importPreview.items
    });
    setCurrentUser(data.user);
    state.importBusy = false;
    state.importForm = createBulkAddFormState();
    state.importPreview = null;
    state.importPanelOpen = true;
    pushToast(t("bulkSaved"));
    render();
    focusUtilityPanel("bulk-add-panel");
  } catch (error) {
    console.error(error);
    pushToast(t("saveFailed"), "error");
  }
}

function bindAdminActions() {
  document.getElementById("toggle-action-menu-btn")?.addEventListener("click", () => toggleActionMenu());
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    closeActionMenu();
    handleLogout();
  });
  document.getElementById("admin-refresh-btn")?.addEventListener("click", () => {
    closeActionMenu();
    loadAdminUsers(state.adminQuery, { force: true });
  });
  document.getElementById("admin-search-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("query") || "").trim();
    await loadAdminUsers(query);
  });
  document.getElementById("admin-clear-search-btn")?.addEventListener("click", async () => {
    await loadAdminUsers("");
  });
  document.querySelectorAll("[data-admin-user]").forEach((button) => {
    button.addEventListener("click", () => {
      const user = state.adminUsers.find((item) => item.id === button.dataset.adminUser);
      if (user) openAdminUserModal(user);
    });
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const identifier = String(form.get("identifier") || "").trim();
  const password = String(form.get("password") || "");

  if (!identifier || !password) {
    pushToast(t("fieldsRequired"), "error");
    return;
  }

  if (identifier === "admin") {
    await handleAdminLogin(password, formElement);
    return;
  }

  try {
    setFormBusy(formElement, true);
    const data = await apiRequest("login", { identifier, password });
    setCurrentUser(data.user, data.sessionToken);
    render();
  } catch (error) {
    console.error(error);
    pushToast(error.message.includes("Invalid") ? t("invalidCredentials") : t("saveFailed"), "error");
  } finally {
    setFormBusy(formElement, false);
  }
}

async function handleAdminLogin(password, formElement = null) {
  try {
    if (formElement) setFormBusy(formElement, true);
    const data = await apiRequest("adminLogin", { password });
    setAdminSession(data.sessionToken);
    await loadAdminUsers("");
    render();
  } catch (error) {
    console.error(error);
    pushToast(t("invalidCredentials"), "error");
  } finally {
    if (formElement) setFormBusy(formElement, false);
  }
}

async function handleLogout() {
  try {
    if (state.sessionToken) {
      await apiRequest("logout", { sessionToken: state.sessionToken });
    }
  } catch (error) {
    console.error(error);
  } finally {
    clearSession();
    render();
  }
}

function openRegisterModal() {
  setModal(`
    <h2 class="section-title">${t("register")}</h2>
    <form id="register-form">
      <div class="field">
        <label>${t("username")}</label>
        <input name="username" />
      </div>
      <div class="field">
        <label>${t("password")}</label>
        ${renderPasswordField({ id: "register-password", name: "password", autocomplete: "new-password" })}
      </div>
      <div class="field">
        <label>${t("employeeId")}</label>
        <input name="employeeId" />
      </div>
      <div class="field">
        <label>${t("shift")}</label>
        <select name="shift">
          <option value="A">${t("shiftA")}</option>
          <option value="B">${t("shiftB")}</option>
          <option value="C">${t("shiftC")}</option>
          <option value="M">${t("shiftM")}</option>
        </select>
      </div>
      <div class="button-row">
        <button class="btn btn-success" type="submit">${t("register")}</button>
        <button class="btn btn-secondary" id="close-register-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
  `);
  bindPasswordToggles(document);
  document.getElementById("register-form")?.addEventListener("submit", submitRegistration);
  document.getElementById("close-register-modal")?.addEventListener("click", closeModal);
}

async function submitRegistration(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  const employeeId = String(form.get("employeeId") || "").trim();
  const shift = String(form.get("shift") || "A");

  if (!username || !password || !employeeId) {
    pushToast(t("fieldsRequired"), "error");
    return;
  }
  if (!isEnglishOnly(username) || !isEnglishOnly(employeeId)) {
    pushToast(t("onlyEnglish"), "error");
    return;
  }

  try {
    setFormBusy(formElement, true);
    const data = await apiRequest("register", { username, password, employeeId, shift });
    setCurrentUser(data.user, data.sessionToken);
    closeModal();
    pushToast(t("accountCreated"));
    render();
  } catch (error) {
    console.error(error);
    if (error.message.includes("Username already exists")) {
      pushToast(t("usernameExists"), "error");
    } else if (error.message.includes("Employee ID already exists")) {
      pushToast(t("employeeIdExists"), "error");
    } else {
      pushToast(t("saveFailed"), "error");
    }
  } finally {
    setFormBusy(formElement, false);
  }
}

function openAdminLoginModal() {
  setModal(`
    <h2 class="section-title">${t("adminLogin")}</h2>
    <form id="admin-login-form">
      <div class="field">
        <label>${t("adminPassword")}</label>
        ${renderPasswordField({ id: "admin-password", name: "password", autocomplete: "current-password" })}
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">${t("login")}</button>
        <button class="btn btn-secondary" id="close-admin-login-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
  `);
  bindPasswordToggles(document);
  document.getElementById("admin-login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const password = String(new FormData(formElement).get("password") || "");
    await handleAdminLogin(password, formElement);
    if (state.sessionKind === "admin" && state.sessionToken) {
      closeModal();
    }
  });
  document.getElementById("close-admin-login-modal")?.addEventListener("click", closeModal);
}

function openForgotPasswordModal() {
  setModal(`
    <h2 class="section-title">${t("forgotPassword")}</h2>
    <p class="tiny">${t("support")}: ${escapeHtml(config.supportContact)}</p>
    <div class="button-row" style="margin-top: 16px;">
      <a class="btn btn-primary" href="tel:${escapeHtml(config.supportPhone)}">${escapeHtml(config.supportPhone)}</a>
      <button class="btn btn-secondary" id="close-forgot-modal" type="button">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("close-forgot-modal")?.addEventListener("click", closeModal);
}

function openMonthPickerModal() {
  setModal(`
    <h2 class="section-title">${t("selectDate")}</h2>
    <div class="field">
      <label>${state.currentLanguage === "ar" ? "السنة" : "Year"}</label>
      <input id="month-picker-year" type="number" value="${state.currentYear}" />
    </div>
    <div class="list month-list">
      ${monthNames[state.currentLanguage]
        .map((month, index) => `<button class="btn btn-primary" type="button" data-month="${index}">${month}</button>`)
        .join("")}
    </div>
    <div class="button-row" style="margin-top: 16px;">
      <button class="btn btn-secondary" id="close-month-modal" type="button">${t("cancel")}</button>
    </div>
  `);
  document.querySelectorAll("[data-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const year = Number(document.getElementById("month-picker-year").value) || state.currentYear;
      state.currentMonth = Number(button.dataset.month);
      state.currentYear = year;
      closeModal();
      render();
    });
  });
  document.getElementById("close-month-modal")?.addEventListener("click", closeModal);
}

function renderEntryCard(entry, actions = true) {
  const reminder = entry.kind === "assignment" ? `<div class="tiny">${t("reminder")}: ${escapeHtml(getReminderLabel(entry.reminderOffsetMinutes))}</div>` : "";
  const notes = entry.notes
    ? `<div class="entry-notes">${escapeHtml(entry.notes)}</div>`
    : entry.kind === "assignment"
      ? `<div class="tiny">${t("notes")}: ${t("noNotes")}</div>`
      : "";
  const style = entry.color ? ` style="${getEntryColorVars(entry.color)}"` : "";
  const timeLine = entry.time
    ? `<div><span class="tiny">${t("assignmentTime")}:</span> ${escapeHtml(getPresetTimeLabel(entry.time))}</div>`
    : "";
  const colorLine = entry.color
    ? `<div class="entry-color-line"><span class="entry-color-dot"${style}></span><span class="tiny">${t("entryColor")}</span></div>`
    : "";
  const sourceLine = entry.source ? `<div class="tiny">${t("importSource")}: ${escapeHtml(entry.source)}</div>` : "";

  return `
    <article class="entry-card ${entry.color ? "entry-card-colored" : ""}"${style}>
      <div class="entry-card-head">
        <div>
          <span class="entry-kind entry-kind-${entry.kind}">${t(entry.kind)}</span>
          <strong>${escapeHtml(entry.name || t(entry.kind))}</strong>
        </div>
        <span class="tiny">${escapeHtml(entry.date)}</span>
      </div>
      <div class="entry-meta">
        ${timeLine}
        <div><span class="tiny">${t("financialValue")}:</span> ${escapeHtml(formatFinancialValue(entry))}</div>
        ${colorLine}
      </div>
      ${reminder}
      ${notes}
      ${sourceLine}
      ${
        actions
          ? `<div class="button-row compact-actions">
              <button class="btn btn-secondary" type="button" data-edit-entry="${escapeHtml(entry.id)}">${t("edit")}</button>
              <button class="btn btn-danger" type="button" data-delete-entry="${escapeHtml(entry.id)}">${t("delete")}</button>
              ${
                entry.kind === "assignment"
                  ? `<button class="btn btn-ghost" type="button" data-reminder-entry="${escapeHtml(entry.id)}">${t("exportReminder")}</button>`
                  : ""
              }
            </div>`
          : ""
      }
    </article>
  `;
}

function openDayDetailsModal(dateStr) {
  const date = new Date(`${dateStr}T00:00:00`);
  const status = getDayStatus(dateStr);
  const entries = getEntriesForDate(dateStr);
  const allowAssignment = canAssignOnDate(date);
  const allowGuard = canGuardOnDate(date);

  setModal(`
    <h2 class="section-title">${t("dayDetails")}</h2>
    <div class="day-summary-card">
      <div><strong>${t("date")}:</strong> ${escapeHtml(dateStr)}</div>
      <div><strong>${t("dayStatus")}:</strong> ${escapeHtml(status.label)}</div>
      <div><strong>${t("currentShift")}:</strong> ${escapeHtml(state.currentUser.shift)} · ${escapeHtml(status.shiftStatus === "duty" ? t("dutyDay") : t("dayOff"))}</div>
    </div>
    <h3 class="subheading">${t("scheduleItems")}</h3>
    <div class="list">
      ${entries.length ? entries.map((entry) => renderEntryCard(entry)).join("") : `<div class="empty-panel">${t("noItemsForDay")}</div>`}
    </div>
    <div class="button-row" style="margin-top: 16px;">
      ${allowAssignment ? `<button class="btn btn-primary" id="add-assignment-from-day-btn" type="button">${t("addAssignment")}</button>` : ""}
      ${allowGuard ? `<button class="btn btn-secondary" id="add-guard-from-day-btn" type="button">${t("addGuard")}</button>` : ""}
      <button class="btn btn-secondary" id="close-day-modal-btn" type="button">${t("cancel")}</button>
    </div>
  `);

  document.getElementById("close-day-modal-btn")?.addEventListener("click", closeModal);
  document.getElementById("add-assignment-from-day-btn")?.addEventListener("click", () =>
    openScheduleItemModal({ mode: "add", kind: "assignment", dateStr })
  );
  document.getElementById("add-guard-from-day-btn")?.addEventListener("click", () =>
    openScheduleItemModal({ mode: "add", kind: "guard", dateStr })
  );
  document.querySelectorAll("[data-edit-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = getCurrentEntries().find((item) => item.id === button.dataset.editEntry);
      if (entry) openScheduleItemModal({ mode: "edit", kind: entry.kind, dateStr: entry.date, entry });
    });
  });
  document.querySelectorAll("[data-delete-entry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const entry = getCurrentEntries().find((item) => item.id === button.dataset.deleteEntry);
      if (entry) await deleteEntry(entry);
    });
  });
  document.querySelectorAll("[data-reminder-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const entry = getCurrentEntries().find((item) => item.id === button.dataset.reminderEntry);
      if (entry) exportReminderFile(entry);
    });
  });
}

function renderClinicOptions(selectedKey) {
  return clinicKeys
    .map((key) => `<option value="${key}" ${selectedKey === key ? "selected" : ""}>${escapeHtml(getClinicLabel(key))}</option>`)
    .join("");
}

function renderColorOptions(selectedColor, keyPrefix = "schedule") {
  return `
    <input type="hidden" name="color" id="${keyPrefix}-color-value" value="${escapeHtml(selectedColor)}" />
    <div class="color-picker" id="${keyPrefix}-color-picker">
      ${entryColorPresets
        .map((preset) => {
          const selected = normalizeEntryColor(selectedColor) === preset.key;
          const style = preset.key ? ` style="${getEntryColorVars(preset.key)}"` : "";
          return `
            <button
              class="color-option ${selected ? "is-selected" : ""} ${preset.key ? "color-option-filled" : "color-option-default"}"
              type="button"
              data-color-option="${preset.key}"
              title="${escapeHtml(preset.key ? preset.key : t("defaultTone"))}"
              aria-label="${escapeHtml(preset.key ? preset.key : t("defaultTone"))}"
              ${style}
            ></button>
          `;
        })
        .join("")}
    </div>
  `;
}

function bindColorPicker(keyPrefix = "schedule") {
  const input = document.getElementById(`${keyPrefix}-color-value`);
  const picker = document.getElementById(`${keyPrefix}-color-picker`);
  if (!input || !picker) return;

  picker.querySelectorAll("[data-color-option]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.colorOption || "";
      picker.querySelectorAll("[data-color-option]").forEach((option) => option.classList.remove("is-selected"));
      button.classList.add("is-selected");
    });
  });
}

function getPresetKeyForName(name) {
  const match = clinicKeys.find((key) => key !== "other" && getClinicLabel(key) === name);
  return match || "other";
}

function getPresetKeyForTime(value) {
  if (value === "A" || value === "N") return value;
  return "other";
}

function openScheduleItemModal({ mode, kind, dateStr, entry = null }) {
  const item = entry || normalizeEntry({ kind, date: dateStr, name: "", time: "", notes: "", color: "", reminderOffsetMinutes: 0 }, 0);
  const selectedName = getPresetKeyForName(item.name);
  const selectedTime = getPresetKeyForTime(item.time);
  const title = `${mode === "edit" ? t("edit") : t("confirm")} ${kind === "guard" ? t("guard") : t("assignment")}`;

  setModal(`
    <h2 class="section-title">${title}</h2>
    <form id="schedule-item-form">
      <div class="field">
        <label>${t("date")}</label>
        <input name="date" type="date" value="${escapeHtml(item.date)}" ${mode === "edit" ? "disabled" : ""} />
      </div>
      ${
        kind === "assignment"
          ? `
            <div class="field">
              <label>${t("assignmentName")}</label>
              <select name="namePreset" id="schedule-name-preset">
                ${renderClinicOptions(selectedName)}
              </select>
              <input name="nameCustom" id="schedule-name-custom" placeholder="${t("other")}" value="${selectedName === "other" ? escapeHtml(item.name) : ""}" style="display: none;" />
            </div>
            <div class="field">
              <label>${t("assignmentTime")}</label>
              <select name="timePreset" id="schedule-time-preset">
                <option value="N" ${selectedTime === "N" ? "selected" : ""}>${t("night")}</option>
                <option value="A" ${selectedTime === "A" ? "selected" : ""}>${t("morning")}</option>
                <option value="other" ${selectedTime === "other" ? "selected" : ""}>${t("other")}</option>
              </select>
              <input name="timeCustom" id="schedule-time-custom" type="time" value="${selectedTime === "other" ? escapeHtml(item.time) : ""}" style="display: none;" />
            </div>
            <div class="field">
              <label>${t("notes")}</label>
              <textarea name="notes" rows="3" placeholder="${t("notes")}">${escapeHtml(item.notes)}</textarea>
            </div>
            <div class="field">
              <label>${t("entryColor")}</label>
              ${renderColorOptions(item.color)}
            </div>
            <div class="field">
              <label>${t("reminder")}</label>
              <select name="reminderOffsetMinutes">
                ${getReminderOptions()
                  .map(
                    (option) =>
                      `<option value="${option.value}" ${option.value === item.reminderOffsetMinutes ? "selected" : ""}>${escapeHtml(option.label)}</option>`
                  )
                  .join("")}
              </select>
            </div>`
          : `
            <div class="field">
              <label>${t("entryColor")}</label>
              ${renderColorOptions(item.color)}
            </div>
            <div class="notice compact">${t("guardInfo")}</div>
          `
      }
      <div class="button-row">
        <button class="btn btn-primary" type="submit">${mode === "edit" ? t("save") : t("confirm")}</button>
        <button class="btn btn-secondary" id="close-schedule-item-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
  `);

  if (kind === "assignment") {
    toggleCustomFields("schedule-name-preset", "schedule-name-custom");
    toggleCustomFields("schedule-time-preset", "schedule-time-custom");
  }
  bindColorPicker();

  document.getElementById("schedule-item-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedDate = mode === "edit" ? item.date : String(form.get("date") || "");
    const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
    const color = normalizeEntryColor(form.get("color"));
    const namePreset = kind === "assignment" ? String(form.get("namePreset") || "other") : "other";
    const timePreset = kind === "assignment" ? String(form.get("timePreset") || "other") : "other";
    const finalName =
      kind === "assignment" ? (namePreset === "other" ? String(form.get("nameCustom") || "").trim() : getClinicLabel(namePreset)) : "";
    const finalTime = kind === "assignment" ? (timePreset === "other" ? String(form.get("timeCustom") || "").trim() : timePreset) : "";
    const notes = kind === "assignment" ? String(form.get("notes") || "").trim() : "";
    const reminderOffsetMinutes = kind === "assignment" ? normalizeReminder(form.get("reminderOffsetMinutes")) : 0;

    if (!selectedDate) {
      pushToast(t("fieldsRequired"), "error");
      return;
    }
    if (kind === "assignment" && !canAssignOnDate(selectedDateObject, state.currentUser.shift)) {
      pushToast(state.currentUser.shift === "M" ? t("noWeekendAssignments") : t("noDutyAssignments"), "error");
      return;
    }
    if (kind === "guard" && !canGuardOnDate(selectedDateObject, state.currentUser.shift)) {
      pushToast(t("noWeekendAssignments"), "error");
      return;
    }
    if (kind === "assignment" && namePreset === "other" && !finalName) {
      pushToast(t("customNameRequired"), "error");
      return;
    }
    if (kind === "assignment" && timePreset === "other" && !finalTime) {
      pushToast(t("customTimeRequired"), "error");
      return;
    }
    if (kind === "guard" && state.currentUser.shift !== "M") {
      pushToast(t("guardOnlyM"), "error");
      return;
    }

    const payload = {
      id: item.id,
      kind,
      date: selectedDate,
      name: finalName,
      time: finalTime,
      notes,
      color,
      reminderOffsetMinutes
    };

    try {
      setFormBusy(formElement, true);
      const action = mode === "edit" ? "updateAssignment" : "addAssignment";
      const requestPayload =
        mode === "edit"
          ? { sessionToken: state.sessionToken, entryId: item.id, assignment: payload }
          : { sessionToken: state.sessionToken, assignment: payload };
      const data = await apiRequest(action, requestPayload);
      setCurrentUser(data.user);
      closeModal();
      pushToast(mode === "edit" ? t("assignmentUpdated") : t("assignmentAdded"));
      render();
    } catch (error) {
      console.error(error);
      if (error.message.includes("already exists")) {
        pushToast(t("duplicateAssignment"), "error");
      } else if (error.message.includes("Guards")) {
        pushToast(t("guardOnlyM"), "error");
      } else if (error.message.includes("Session")) {
        clearSession();
        pushToast(t("sessionExpired"), "error");
        render();
      } else {
        pushToast(t("saveFailed"), "error");
      }
    } finally {
      setFormBusy(formElement, false);
    }
  });

  document.getElementById("close-schedule-item-modal")?.addEventListener("click", closeModal);
}

function toggleCustomFields(selectId, fieldId) {
  const select = document.getElementById(selectId);
  const field = document.getElementById(fieldId);
  if (!select || !field) return;
  const apply = () => {
    field.style.display = select.value === "other" ? "block" : "none";
  };
  select.addEventListener("change", apply);
  apply();
}

function openManageItemsModal(mode) {
  const entries = [...getCurrentEntries()].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));
  if (!entries.length) {
    pushToast(t("noAssignments"), "error");
    return;
  }

  setModal(`
    <h2 class="section-title">${t("manageItems")}</h2>
    <div class="list">
      ${entries
        .map(
          (entry) => `
            <button class="list-item entry-list-button" type="button" data-manage-entry="${escapeHtml(entry.id)}">
              <div><strong>${escapeHtml(entry.date)}</strong> · ${escapeHtml(getEntryTypeLabel(entry.kind))}</div>
              <div class="tiny">${escapeHtml(entry.name || t(entry.kind))}${entry.time ? ` · ${escapeHtml(getPresetTimeLabel(entry.time))}` : ""}</div>
            </button>
          `
        )
        .join("")}
    </div>
    <div class="button-row" style="margin-top: 16px;">
      <button class="btn btn-secondary" id="close-manage-modal" type="button">${t("cancel")}</button>
    </div>
  `);

  document.querySelectorAll("[data-manage-entry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const entry = getCurrentEntries().find((item) => item.id === button.dataset.manageEntry);
      if (!entry) return;
      if (mode === "edit") {
        openScheduleItemModal({ mode: "edit", kind: entry.kind, dateStr: entry.date, entry });
      } else {
        await deleteEntry(entry);
      }
    });
  });

  document.getElementById("close-manage-modal")?.addEventListener("click", closeModal);
}

async function deleteEntry(entry) {
  try {
    const data = await apiRequest("deleteAssignment", {
      sessionToken: state.sessionToken,
      entryId: entry.id,
      kind: entry.kind,
      date: entry.date
    });
    setCurrentUser(data.user);
    closeModal();
    pushToast(t("assignmentDeleted"));
    render();
  } catch (error) {
    console.error(error);
    pushToast(error.message.includes("Session") ? t("sessionExpired") : t("saveFailed"), "error");
    if (error.message.includes("Session")) {
      clearSession();
      render();
    }
  }
}

function buildSearchResult(dateStr) {
  const status = getDayStatus(dateStr);
  const entries = getEntriesForDate(dateStr);
  return `
    <div class="search-result-card">
      <div><strong>${t("date")}:</strong> ${escapeHtml(dateStr)}</div>
      <div><strong>${t("dayStatus")}:</strong> ${escapeHtml(status.label)}</div>
      <div><strong>${t("shift")}:</strong> ${escapeHtml(state.currentUser.shift)}</div>
      ${
        entries.length
          ? `<div class="list search-entry-list">${entries.map((entry) => renderEntryCard(entry, false)).join("")}</div>`
          : `<div class="tiny">${t("noItemsForDay")}</div>`
      }
    </div>
  `;
}

function getAvailableDutyDays() {
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const days = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(state.currentYear, state.currentMonth, day);
    const dateStr = toDateInputValue(date);
    const entries = getEntriesForDate(dateStr);
    if (!entries.length && canAssignOnDate(date)) {
      days.push(dateStr);
    }
  }

  return days;
}

function openSearchModal(dateStr = toDateInputValue(new Date())) {
  const freeDays = getAvailableDutyDays();

  setModal(`
    <h2 class="section-title">${t("userSearch")}</h2>
    <form id="search-date-form">
      <div class="field">
        <label>${t("searchDate")}</label>
        <input name="date" type="date" value="${escapeHtml(dateStr)}" />
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">${t("search")}</button>
        <button class="btn btn-secondary" id="close-search-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
    <div class="search-section">
      <h3 class="subheading">${t("searchResult")}</h3>
      ${buildSearchResult(dateStr)}
    </div>
    <div class="search-section">
      <h3 class="subheading">${t("availableDutyDays")}</h3>
      ${
        freeDays.length
          ? `<div class="list">${freeDays
              .map((day) => `<button class="list-item" type="button" data-open-free-day="${day}">${escapeHtml(day)} · ${t("freeDay")}</button>`)
              .join("")}</div>`
          : `<div class="empty-panel">${t("noFreeDays")}</div>`
      }
    </div>
  `);

  document.getElementById("search-date-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedDate = String(new FormData(event.currentTarget).get("date") || "");
    if (!selectedDate) {
      pushToast(t("fieldsRequired"), "error");
      return;
    }
    openSearchModal(selectedDate);
  });
  document.getElementById("close-search-modal")?.addEventListener("click", closeModal);
  document.querySelectorAll("[data-open-free-day]").forEach((button) => {
    button.addEventListener("click", () => openDayDetailsModal(button.dataset.openFreeDay));
  });
}

function openSettingsModal() {
  setModal(`
    <h2 class="section-title">${t("settings")}</h2>
    <div class="list">
      <button class="btn btn-primary" id="toggle-language-setting-btn" type="button">${t("changeLanguage")} (${state.currentLanguage === "ar" ? "English" : "العربية"})</button>
      <button class="btn btn-primary" id="change-shift-btn" type="button">${t("changeShift")}</button>
      <button class="btn btn-primary" id="change-username-btn" type="button">${t("changeUsername")}</button>
      <button class="btn btn-primary" id="change-password-btn" type="button">${t("changePassword")}</button>
      <button class="btn btn-danger" id="clear-data-btn" type="button">${t("clearData")}</button>
      <button class="btn btn-secondary" id="close-settings-modal" type="button">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("toggle-language-setting-btn")?.addEventListener("click", toggleLanguageSetting);
  document.getElementById("change-shift-btn")?.addEventListener("click", openChangeShiftModal);
  document.getElementById("change-username-btn")?.addEventListener("click", openChangeUsernameModal);
  document.getElementById("change-password-btn")?.addEventListener("click", openChangePasswordModal);
  document.getElementById("clear-data-btn")?.addEventListener("click", openClearDataModal);
  document.getElementById("close-settings-modal")?.addEventListener("click", closeModal);
}

async function saveProfileChanges(changes) {
  const data = await apiRequest("updateProfile", {
    sessionToken: state.sessionToken,
    changes
  });
  setCurrentUser(data.user);
}

async function toggleLanguageSetting() {
  const nextLanguage = state.currentLanguage === "ar" ? "en" : "ar";
  try {
    await saveProfileChanges({
      settings: { ...state.currentUser.settings, language: nextLanguage }
    });
    state.currentLanguage = nextLanguage;
    closeModal();
    render();
  } catch (error) {
    console.error(error);
    pushToast(t("saveFailed"), "error");
  }
}

function openChangeShiftModal() {
  setModal(`
    <h2 class="section-title">${t("changeShift")}</h2>
    <form id="change-shift-form">
      <div class="field">
        <label>${t("shift")}</label>
        <select name="shift">
          <option value="A" ${state.currentUser.shift === "A" ? "selected" : ""}>${t("shiftA")}</option>
          <option value="B" ${state.currentUser.shift === "B" ? "selected" : ""}>${t("shiftB")}</option>
          <option value="C" ${state.currentUser.shift === "C" ? "selected" : ""}>${t("shiftC")}</option>
          <option value="M" ${state.currentUser.shift === "M" ? "selected" : ""}>${t("shiftM")}</option>
        </select>
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">${t("save")}</button>
        <button class="btn btn-secondary" id="close-change-shift-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
  `);
  document.getElementById("change-shift-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const shift = String(new FormData(formElement).get("shift") || "A");
    try {
      setFormBusy(formElement, true);
      await saveProfileChanges({ shift });
      closeModal();
      render();
    } catch (error) {
      console.error(error);
      pushToast(t("saveFailed"), "error");
    } finally {
      setFormBusy(formElement, false);
    }
  });
  document.getElementById("close-change-shift-modal")?.addEventListener("click", closeModal);
}

function openChangeUsernameModal() {
  setModal(`
    <h2 class="section-title">${t("changeUsername")}</h2>
    <form id="change-username-form">
      <div class="field">
        <label>${t("username")}</label>
        <input name="username" value="${escapeHtml(state.currentUser.username)}" />
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">${t("save")}</button>
        <button class="btn btn-secondary" id="close-change-username-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
  `);
  document.getElementById("change-username-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const username = String(new FormData(formElement).get("username") || "").trim();
    if (!username) {
      pushToast(t("fieldsRequired"), "error");
      return;
    }
    if (!isEnglishOnly(username)) {
      pushToast(t("onlyEnglish"), "error");
      return;
    }
    try {
      setFormBusy(formElement, true);
      await saveProfileChanges({ username });
      closeModal();
      render();
    } catch (error) {
      console.error(error);
      pushToast(error.message.includes("Username already exists") ? t("usernameExists") : t("saveFailed"), "error");
    } finally {
      setFormBusy(formElement, false);
    }
  });
  document.getElementById("close-change-username-modal")?.addEventListener("click", closeModal);
}

function openChangePasswordModal() {
  setModal(`
    <h2 class="section-title">${t("changePassword")}</h2>
    <form id="change-password-form">
      <div class="field">
        <label>${t("password")}</label>
        ${renderPasswordField({ id: "change-password-input", name: "password", autocomplete: "new-password" })}
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">${t("save")}</button>
        <button class="btn btn-secondary" id="close-change-password-modal" type="button">${t("cancel")}</button>
      </div>
    </form>
  `);
  bindPasswordToggles(document);
  document.getElementById("change-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const password = String(new FormData(formElement).get("password") || "");
    if (!password) {
      pushToast(t("fieldsRequired"), "error");
      return;
    }
    try {
      setFormBusy(formElement, true);
      await saveProfileChanges({ password });
      closeModal();
      pushToast(t("passwordUpdated"));
    } catch (error) {
      console.error(error);
      pushToast(t("saveFailed"), "error");
    } finally {
      setFormBusy(formElement, false);
    }
  });
  document.getElementById("close-change-password-modal")?.addEventListener("click", closeModal);
}

function openClearDataModal() {
  setModal(`
    <h2 class="section-title">${t("clearData")}</h2>
    <p class="notice compact">${state.currentLanguage === "ar" ? "سيتم حذف جميع التكاليف والخفارات للمستخدم الحالي فقط." : "This clears assignments and guards for the current user only."}</p>
    <div class="button-row">
      <button class="btn btn-danger" id="confirm-clear-data-btn" type="button">${t("confirm")}</button>
      <button class="btn btn-secondary" id="close-clear-data-modal" type="button">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("confirm-clear-data-btn")?.addEventListener("click", async () => {
    try {
      const data = await apiRequest("clearAssignments", {
        sessionToken: state.sessionToken
      });
      setCurrentUser(data.user);
      closeModal();
      pushToast(t("dataCleared"));
      render();
    } catch (error) {
      console.error(error);
      pushToast(t("saveFailed"), "error");
    }
  });
  document.getElementById("close-clear-data-modal")?.addEventListener("click", closeModal);
}

async function loadAdminUsers(query = "", options = {}) {
  const force = Boolean(options.force);
  if (!force && state.sessionKind === "admin" && query === state.adminQuery && state.adminUsers.length) {
    return;
  }
  state.adminQuery = query;
  const data = await apiRequest("adminListUsers", {
    sessionToken: state.sessionToken,
    query
  });
  state.adminUsers = Array.isArray(data.users) ? data.users.map(normalizeUser) : [];
  persistSessionSnapshot();
  render();
}

function openAdminUserModal(user) {
  const entries = [...(user.assignments || [])].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind));
  setModal(`
    <h2 class="section-title">${t("adminSummary")}</h2>
    <div class="day-summary-card">
      <div><strong>${t("username")}:</strong> ${escapeHtml(user.username)}</div>
      <div><strong>${t("employeeId")}:</strong> ${escapeHtml(user.employee_id)}</div>
      <div><strong>${t("shift")}:</strong> ${escapeHtml(user.shift)}</div>
      <div><strong>${t("adminAssignmentCount")}:</strong> ${user.assignmentCount ?? 0}</div>
      <div><strong>${t("adminGuardCount")}:</strong> ${user.guardCount ?? 0}</div>
    </div>
    <div class="list">
      ${entries.length ? entries.map((entry) => renderEntryCard(entry, false)).join("") : `<div class="empty-panel">${t("noAssignments")}</div>`}
    </div>
    <div class="button-row" style="margin-top: 16px;">
      <button class="btn btn-secondary" id="close-admin-user-modal" type="button">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("close-admin-user-modal")?.addEventListener("click", closeModal);
}

function changeMonth(delta) {
  state.currentMonth += delta;
  if (state.currentMonth > 11) {
    state.currentMonth = 0;
    state.currentYear += 1;
  } else if (state.currentMonth < 0) {
    state.currentMonth = 11;
    state.currentYear -= 1;
  }
  render();
}

function buildIcsFile(entry) {
  const date = entry.date;
  let startTime = "09:00";
  if (entry.time === "A") startTime = "08:00";
  else if (entry.time === "N") startTime = "20:00";
  else if (/^\d{2}:\d{2}$/.test(entry.time)) startTime = entry.time;
  else return null;

  const [hours, minutes] = startTime.split(":").map((value) => Number(value));
  const startDate = new Date(`${date}T00:00:00`);
  startDate.setHours(hours, minutes, 0, 0);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatIcs = (value) =>
    `${value.getFullYear()}${String(value.getMonth() + 1).padStart(2, "0")}${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}${String(value.getMinutes()).padStart(2, "0")}00`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Codex//Assignments//AR",
    "BEGIN:VEVENT",
    `UID:${escapeHtml(entry.id)}@codex.local`,
    `DTSTAMP:${formatIcs(new Date())}`,
    `DTSTART:${formatIcs(startDate)}`,
    `DTEND:${formatIcs(endDate)}`,
    `SUMMARY:${entry.kind === "guard" ? "خفارة" : "تكليف"} - ${entry.name || t(entry.kind)}`,
    `DESCRIPTION:${(entry.notes || "").replaceAll(/\n/g, "\\n")}`,
    "BEGIN:VALARM",
    `TRIGGER:-PT${Math.max(15, normalizeReminder(entry.reminderOffsetMinutes || 60))}M`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${entry.name || t(entry.kind)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return lines.join("\r\n");
}

function exportReminderFile(entry) {
  const reminderOffset = normalizeReminder(entry.reminderOffsetMinutes);
  const exportEntry = {
    ...entry,
    reminderOffsetMinutes: reminderOffset || 60
  };
  const fileContent = buildIcsFile(exportEntry);
  if (!fileContent) {
    pushToast(t("reminderUnsupported"), "error");
    return;
  }

  const blob = new Blob([fileContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${exportEntry.kind}-${exportEntry.date}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  pushToast(t("reminderReady"));
}

async function restoreSession() {
  const raw = sessionStorage.getItem(sessionKey);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (!saved?.token) {
      sessionStorage.removeItem(sessionKey);
      return;
    }
    state.sessionToken = saved.token;
    state.sessionKind = saved.kind || "user";

    const data = await apiRequest("restoreSession", { sessionToken: saved.token });
    if (data.admin) {
      state.sessionKind = "admin";
      await loadAdminUsers("");
      persistSessionSnapshot();
      return;
    }
    setCurrentUser(data.user, saved.token);
  } catch (error) {
    console.error(error);
    clearApiCache();
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionSnapshotKey);
    state.sessionKind = "user";
    state.sessionToken = null;
  }
}

async function init() {
  const snapshotState = hydrateSessionSnapshot();
  const hasSnapshot = snapshotState.hydrated;
  state.loading = !hasSnapshot;
  render();
  if (!snapshotState.fresh) {
    await restoreSession();
  }
  state.loading = false;
  render();
}

init();
