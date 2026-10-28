export type Language = 'en' | 'am';

export const translations = {
  en: {
    // Navigation
    nav_home: 'Home',
    nav_churches: 'Churches',
    nav_news: 'News Feed',
    nav_sermons: 'Sermons',
    nav_blogs: 'Devotionals',
    nav_schedules: 'Schedules',
    nav_calendar: 'Calendar',
    nav_office_hours: 'Office Hours',
    nav_give: 'Give',
    nav_lyrics: 'Lyrics Bank',
    nav_super_admin: 'Super Admin',
    nav_church_console: 'Church Console',
    nav_my_account: 'My Account',
    nav_sign_out: 'Sign Out',
    nav_login: 'Login',
    nav_sign_up: 'Sign Up',
    
    // Generic
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
  },
  am: {
    // Navigation
    nav_home: 'ዋና ገጽ',
    nav_churches: 'አብያተ ክርስቲያናት',
    nav_news: 'ዜና',
    nav_sermons: 'ስብከቶች',
    nav_blogs: 'ትምህርቶች',
    nav_schedules: 'መርሐግብሮች',
    nav_calendar: 'ቀን መቁጠሪያ',
    nav_office_hours: 'የቢሮ ሰዓት',
    nav_give: 'ስጦታ',
    nav_lyrics: 'መዝሙሮች',
    nav_super_admin: 'ዋና አስተዳዳሪ',
    nav_church_console: 'ቤተክርስቲያን አስተዳደር',
    nav_my_account: 'የእኔ መለያ',
    nav_sign_out: 'ውጣ',
    nav_login: 'ግባ',
    nav_sign_up: 'ተመዝገብ',
    
    // Generic
    loading: 'በመጫን ላይ...',
    save: 'አስቀምጥ',
    cancel: 'ሰርዝ',
  }
};

export function getTranslation(lang: Language, key: keyof typeof translations['en']): string {
  return translations[lang][key] || translations['en'][key] || key;
}
