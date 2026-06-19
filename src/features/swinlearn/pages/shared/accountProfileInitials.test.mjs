import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const loadTsModule = async (relativePath) => {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })

  return import(`data:text/javascript,${encodeURIComponent(transpiled.outputText)}`)
}

const { accountAvatarInitials } = await loadTsModule('./accountProfileInitials.ts')

test('uses last-name then first-name initials from the full name', () => {
  assert.equal(accountAvatarInitials('Vo Thi Kim Huyen', '104169824@student.swin.edu.au'), 'HV')
})

test('falls back to the first two email characters when the profile name is missing', () => {
  assert.equal(accountAvatarInitials('', '104169824@student.swin.edu.au'), '10')
})
