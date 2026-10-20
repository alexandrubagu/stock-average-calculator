import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.ts', '*.js', 'scripts/**/*.mjs', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
)
