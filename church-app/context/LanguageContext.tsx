"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, getTranslation, translations } from '@/lib/i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedLang = localStorage.getItem('app_language') as Language;
    if (storedLang === 'en' || storedLang === 'am') {
      setLanguageState(storedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: keyof typeof translations['en']): string => {
    return getTranslation(language, key);
  };

  // Avoid hydration mismatch by not rendering until mounted if language might differ,
  // but for SEO and simple UI, we'll just render English initially then swap.
  // A safer hydration approach is to render children but the translation might flash.
  // Flashing is better than a blank screen.
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
