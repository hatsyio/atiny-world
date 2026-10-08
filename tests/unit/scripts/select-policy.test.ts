import { ESLint } from 'eslint'
import { expect, it } from 'vitest'

const eslint = new ESLint()

it('rejects native dropdowns and direct Select imports in app screens', async () => {
  const [native] = await eslint.lintText('export const Screen = () => <select />', { filePath: 'src/components/screen.tsx' })
  expect(native.messages.some(message => message.ruleId === 'no-restricted-syntax')).toBe(true)
  const [direct] = await eslint.lintText('import {Select as Dropdown} from "react-aria-components"; export const Screen = () => <Dropdown />', { filePath: 'src/components/screen.tsx' })
  expect(direct.messages.some(message => message.ruleId === 'no-restricted-imports')).toBe(true)
})

it('allows the shared selector and its React Aria implementation', async () => {
  const [shared] = await eslint.lintText('import {AppSelect} from "@/components/ui/app-select"; export const Screen = () => <AppSelect />', { filePath: 'src/components/screen.tsx' })
  expect(shared.messages.some(message => message.ruleId?.startsWith('no-restricted'))).toBe(false)
  const [implementation] = await eslint.lintText('import {Select} from "react-aria-components"; export const AppSelect = () => <Select />', { filePath: 'src/components/ui/app-select.tsx' })
  expect(implementation.messages.some(message => message.ruleId?.startsWith('no-restricted'))).toBe(false)
})
