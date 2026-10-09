import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, it } from 'vitest'

it.each([
  ['success', 0, 1], ['transient', 0, 2], ['permanent', 1, 1], ['exhausted', 1, 3],
] as const)('handles %s without hiding failures or exceeding the retry limit', (mode, exitCode, attempts) => {
  const directory = mkdtempSync(join(tmpdir(), 'atiny-network-retry-'))
  try {
    const counter = join(directory, 'attempts')
    const command = join(directory, 'command')
    writeFileSync(command, `#!/bin/sh
count=0
if [ -f "$RETRY_TEST_COUNTER" ]; then count=$(cat "$RETRY_TEST_COUNTER"); fi
count=$((count + 1))
echo "$count" > "$RETRY_TEST_COUNTER"
if [ "$RETRY_TEST_MODE" = success ] || { [ "$RETRY_TEST_MODE" = transient ] && [ "$count" -gt 1 ]; }; then exit 0; fi
if [ "$RETRY_TEST_MODE" = permanent ]; then echo 'Dockerfile parse error: unknown instruction' >&2; else echo '504 Gateway Timeout' >&2; fi
exit 1
`)
    chmodSync(command, 0o755)
    const sleep = join(directory, 'sleep')
    writeFileSync(sleep, '#!/bin/sh\nexit 0\n')
    chmodSync(sleep, 0o755)
    const result = spawnSync('bash', [resolve('scripts/retry-network-command.sh'), command], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, RETRY_TEST_COUNTER: counter, RETRY_TEST_MODE: mode },
    })
    expect(result.status, result.stdout + result.stderr).toBe(exitCode)
    expect(Number(readFileSync(counter, 'utf8'))).toBe(attempts)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
