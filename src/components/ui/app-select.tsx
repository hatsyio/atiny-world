'use client'

import { useEffect, useId, useState } from 'react'
import { useLocale } from 'next-intl'
import { Button, FieldError, I18nProvider, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components'
import { useAutoFilterField } from './auto-filter-form'

export type AppSelectOption = { value: string; label: string }
type AppSelectProps = {
  label: string
  name: string
  options: AppSelectOption[]
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  variant?: 'light' | 'header' | 'paper' | 'admin-messages' | 'admin-users'
}

export function AppSelect({ label, name, options, placeholder, value, defaultValue, onChange, required, disabled, variant = 'light' }: AppSelectProps) {
  const locale = useLocale()
  const filters = useAutoFilterField()
  const owner = useId()
  const [portalContainer, setPortalContainer] = useState<HTMLElement | undefined>(undefined)
  useEffect(() => {
    const update = () => setPortalContainer(document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined)
    update()
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  return <I18nProvider locale={locale}>
    <Select className={`app-select app-select--${variant}`} data-overlay-owner={owner} name={name} value={filters?.values[name] ?? value} defaultValue={defaultValue} onChange={key => { if (key !== null) { onChange?.(String(key)); filters?.change(name, String(key)) } }} placeholder={placeholder} isRequired={required} isDisabled={disabled} validationBehavior="native">
      <Label className="app-select-label">{label}</Label>
      <Button className="app-select-trigger">
        <SelectValue className="app-select-value">{({ selectedText, isPlaceholder }) => isPlaceholder ? placeholder : selectedText}</SelectValue>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Button>
      <Popover className={`app-select-popover app-select-popover--${variant}`} data-overlay-owner={owner} UNSTABLE_portalContainer={portalContainer} placement="bottom start" offset={6}>
        <ListBox className="app-select-options" items={options}>
          {option => <ListBoxItem id={option.value} textValue={option.label} className="app-select-option">
            {({ isSelected }) => <><span>{option.label}</span><span className="app-select-check" aria-hidden="true">{isSelected ? '✓' : ''}</span></>}
          </ListBoxItem>}
        </ListBox>
      </Popover>
      <FieldError className="app-select-error" />
    </Select>
  </I18nProvider>
}
