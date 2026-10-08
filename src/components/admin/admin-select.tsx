'use client'

import { useLocale } from 'next-intl'
import { Button, FieldError, I18nProvider, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components'

export type AdminSelectOption = { value: string; label: string }
type AdminSelectProps = {
  label: string
  name: string
  options: AdminSelectOption[]
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  required?: boolean
  disabled?: boolean
  tone?: 'messages' | 'users'
}

export function AdminSelect({ label, name, options, placeholder, value, defaultValue, onChange, required, disabled, tone = 'messages' }: AdminSelectProps) {
  const locale = useLocale()
  return <I18nProvider locale={locale}>
    <Select className="admin-select" name={name} value={value} defaultValue={defaultValue} onChange={key => { if (key !== null) onChange?.(String(key)) }} placeholder={placeholder} isRequired={required} isDisabled={disabled} validationBehavior="native">
      <Label className="admin-select-label">{label}</Label>
      <Button className="admin-select-trigger">
        <SelectValue className="admin-select-value">{({ selectedText, isPlaceholder }) => isPlaceholder ? placeholder : selectedText}</SelectValue>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Button>
      <Popover className={`admin-select-popover admin-select-popover--${tone}`} placement="bottom start" offset={6}>
        <ListBox className="admin-select-options" items={options}>
          {option => <ListBoxItem id={option.value} textValue={option.label} className="admin-select-option">
            {({ isSelected }) => <><span>{option.label}</span><span className="admin-select-check" aria-hidden="true">{isSelected ? '✓' : ''}</span></>}
          </ListBoxItem>}
        </ListBox>
      </Popover>
      <FieldError className="admin-select-error" />
    </Select>
  </I18nProvider>
}
