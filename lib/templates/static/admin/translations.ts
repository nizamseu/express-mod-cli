/**
 * Texts of the admin panel that differ from AdminJS's defaults.
 * Anything not listed here falls back to English.
 * Add your own resource and field labels under "resources", e.g.
 *   en: { resources: { Product: { properties: { price: 'Price (BDT)' } } } }
 * title: the panel title (ADMIN_TITLE)
 */
export default (title: string) => ({
  en: {
    components: {
      Login: {
        welcomeHeader: title,
        welcomeMessage: 'Sign in with an admin account to manage your data.',
      },
    },
    actions: {
      export: 'Export',
      import: 'Import',
    },
    labels: {
      navigation: 'Menu',
      User: 'Users',
      users: 'Users',
      AdminLog: 'Admin log',
      admin_logs: 'Admin log',
    },
  },
  bn: {
    actions: {
      new: 'নতুন তৈরি করুন',
      edit: 'সম্পাদনা',
      show: 'বিস্তারিত',
      delete: 'মুছুন',
      bulkDelete: 'সব মুছুন',
      list: 'তালিকা',
      export: 'এক্সপোর্ট',
      import: 'ইমপোর্ট',
    },
    buttons: {
      save: 'সংরক্ষণ করুন',
      filter: 'ফিল্টার',
      applyChanges: 'পরিবর্তন প্রয়োগ করুন',
      resetFilter: 'রিসেট',
      confirmRemovalMany: 'নিশ্চিত করুন',
      logout: 'লগ আউট',
      login: 'লগ ইন',
      createFirstRecord: 'প্রথম রেকর্ড তৈরি করুন',
      cancel: 'বাতিল',
      confirm: 'নিশ্চিত করুন',
    },
    labels: {
      navigation: 'মেনু',
      pages: 'পেজ',
      selectedRecords: 'নির্বাচিত ({{selected}})',
      filters: 'ফিল্টার',
      dashboard: 'ড্যাশবোর্ড',
      User: 'ব্যবহারকারী',
      users: 'ব্যবহারকারী',
      AdminLog: 'অ্যাডমিন লগ',
      admin_logs: 'অ্যাডমিন লগ',
    },
    messages: {
      noRecords: 'কোনো রেকর্ড নেই',
      successfullyBulkDeleted: '{{count}}টি রেকর্ড মুছে ফেলা হয়েছে',
      successfullyDeleted: 'রেকর্ডটি মুছে ফেলা হয়েছে',
      successfullyUpdated: 'রেকর্ডটি আপডেট হয়েছে',
      successfullyCreated: 'নতুন রেকর্ড তৈরি হয়েছে',
      thereWereValidationErrors: 'কিছু ঘর ঠিক করে আবার চেষ্টা করুন',
      confirmDelete: 'আপনি কি সত্যিই এটি মুছতে চান?',
      invalidCredentials: 'ইমেইল বা পাসওয়ার্ড ভুল',
    },
    components: {
      Login: {
        welcomeHeader: title,
        welcomeMessage: 'ডেটা পরিচালনা করতে অ্যাডমিন অ্যাকাউন্ট দিয়ে লগ ইন করুন।',
        properties: { email: 'ইমেইল', password: 'পাসওয়ার্ড' },
        loginButton: 'লগ ইন',
      },
    },
  },
});
