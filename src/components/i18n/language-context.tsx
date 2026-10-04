'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { LanguagePreference } from '@/i18n/locale'

export const LanguagePreferenceContext = createContext<LanguagePreference>('auto')
export function useLanguagePreference() { return useContext(LanguagePreferenceContext) }

export function LanguagePreferenceProvider({ preference, children }: { preference: LanguagePreference; children: ReactNode }) {
  return <LanguagePreferenceContext.Provider value={preference}>{children}</LanguagePreferenceContext.Provider>
}
