import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import unusedImports from 'eslint-plugin-unused-imports'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Unused vars — handled by unused-imports plugin
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      // any is used intentionally for external API data (TMDB, etc.)
      '@typescript-eslint/no-explicit-any': 'off',
      // Empty catch blocks are used intentionally as noop guards
      'no-empty': 'off',
      // Namespace used in legacy declaration files
      '@typescript-eslint/no-namespace': 'off',
      // Empty interfaces used as type stubs
      '@typescript-eslint/no-empty-object-type': 'off',
      // Useless escape — auto-fixable, keep as warn
      'no-useless-escape': 'warn',
      // Unused expressions — some patterns are intentional
      '@typescript-eslint/no-unused-expressions': 'off',
      // Missing useEffect deps — managed manually to avoid infinite loops
      'react-hooks/exhaustive-deps': 'warn',
      // Duplicate else-if — keep as error
      'no-dupe-else-if': 'error',
      // hasOwnProperty — keep as warn
      'no-prototype-builtins': 'warn',
    },
  },
)
