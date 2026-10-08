// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AnalyticsIdentity } from '@/components/analytics/analytics-identity'

const boundary = vi.hoisted(() => ({
  auth: { isLoaded: false, userId: null as string | null }, identify: vi.fn(), reset: vi.fn(),
}))
vi.mock('@clerk/nextjs', () => ({ useAuth: () => boundary.auth }))
vi.mock('posthog-js', () => ({ default: { identify: boundary.identify, reset: boundary.reset } }))
beforeEach(() => {
  vi.resetAllMocks()
  boundary.auth = { isLoaded: false, userId: null }
})
afterEach(cleanup)

it('identifies once per account and resets before switching or logging out', () => {
  const view = render(<AnalyticsIdentity />)
  expect(boundary.identify).not.toHaveBeenCalled()
  boundary.auth = { isLoaded: true, userId: null }
  view.rerender(<AnalyticsIdentity />)
  expect(boundary.reset).not.toHaveBeenCalled()
  boundary.auth = { isLoaded: true, userId: 'a' }
  view.rerender(<AnalyticsIdentity />)
  view.rerender(<AnalyticsIdentity />)
  expect(boundary.identify).toHaveBeenCalledExactlyOnceWith('a')
  boundary.auth = { isLoaded: true, userId: 'b' }
  view.rerender(<AnalyticsIdentity />)
  expect(boundary.reset).toHaveBeenCalledTimes(1)
  expect(boundary.identify).toHaveBeenLastCalledWith('b')
  expect(boundary.reset.mock.invocationCallOrder[0]).toBeLessThan(boundary.identify.mock.invocationCallOrder[1])
  boundary.auth = { isLoaded: true, userId: null }
  view.rerender(<AnalyticsIdentity />)
  view.rerender(<AnalyticsIdentity />)
  expect(boundary.reset).toHaveBeenCalledTimes(2)
  expect(boundary.identify).toHaveBeenCalledTimes(2)
})
