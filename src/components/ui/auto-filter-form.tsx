'use client'

import { createContext, useContext, useEffect, useRef, useState, useTransition, type InputHTMLAttributes, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type Values = Record<string, string>
type FilterContext = { values: Values; change: (name: string, value: string, delay?: boolean) => void }
const Context = createContext<FilterContext | null>(null)
export const useAutoFilterField = () => useContext(Context)
const keyOf = (values: Values) => JSON.stringify(Object.keys(values).sort().map(name => [name, values[name].trim()]))

export function AutoFilterForm({ action, values, defaults = {}, resetValues = {}, className, clearLabel, loadingLabel, children }: {
  action: string; values: Values; defaults?: Values; resetValues?: Values; className: string
  clearLabel?: string; loadingLabel: string; children: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const incoming = keyOf(values)
  const [state, setState] = useState({ observed: incoming, values, written: [] as string[], external: 0 })
  if (incoming !== state.observed) {
    const ownResponse = state.written.includes(incoming)
    setState({ ...state, observed: incoming, values: ownResponse ? state.values : values, external: state.external + (ownResponse ? 0 : 1) })
  }
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(timer.current)
    return () => clearTimeout(timer.current)
  }, [state.external])
  useEffect(() => {
    const restore = () => {
      clearTimeout(timer.current)
      const params = new URLSearchParams(window.location.search)
      const restored = Object.fromEntries(Object.keys(values).map(name => [name, params.get(name) ?? defaults[name] ?? '']))
      setState(current => ({ ...current, values: restored, written: [], external: current.external + 1 }))
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [values, defaults])

  const apply = (next: Values) => {
    clearTimeout(timer.current)
    const params = new URLSearchParams()
    for (const [name, value] of Object.entries(next)) if (value.trim()) params.set(name, value.trim())
    setState(current => ({ ...current, written: [...current.written.slice(-99), keyOf(next)] }))
    startTransition(() => router.replace(`${action}${params.size ? `?${params}` : ''}`, { scroll: false }))
  }
  const change: FilterContext['change'] = (name, value, delay = false) => {
    const next = { ...state.values, [name]: value }
    clearTimeout(timer.current)
    setState(current => ({ ...current, values: next }))
    if (delay) timer.current = setTimeout(() => apply(next), 350)
    else apply(next)
  }
  const cleared = Object.fromEntries(Object.keys(values).map(name => [name, resetValues[name] ?? '']))
  return <Context value={{ values: state.values, change }}>
    <form action={action} method="get" className={className} aria-busy={pending} onSubmit={event => { event.preventDefault(); apply(state.values) }}>
      {children}
      <div className={`filter-form__actions${clearLabel ? '' : ' filter-form__actions--status'}`}>
        {clearLabel ? <button className="filter-form__clear" type="button" disabled={keyOf(state.values) === keyOf(cleared)} onClick={() => {
          setState(current => ({ ...current, values: cleared }))
          apply(cleared)
        }}>{clearLabel}</button> : null}
        <span role={pending ? 'status' : undefined} aria-live="polite" className="filter-form__status">{pending ? loadingLabel : ''}</span>
      </div>
    </form>
  </Context>
}

export function AutoFilterInput({ name, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> & { name: string }) {
  const filters = useAutoFilterField()
  if (!filters) throw new Error('AutoFilterInput requires AutoFilterForm')
  return <input {...props} name={name} value={filters.values[name] ?? ''} onChange={event => filters.change(name, event.target.value, true)} />
}
