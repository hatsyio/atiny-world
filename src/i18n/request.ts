import { getRequestConfig } from 'next-intl/server'
import { getRequestLanguage } from './preference'
import { loadMessages } from './messages'

export default getRequestConfig(async () => {
  const { locale } = await getRequestLanguage()
  return { locale, messages: await loadMessages(locale), timeZone: 'UTC' }
})
