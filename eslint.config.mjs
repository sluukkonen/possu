// @ts-check

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-plugin-prettier/recommended'
import promise from 'eslint-plugin-promise'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  jest.configs['flat/recommended'],
  promise.configs['flat/recommended'],
  prettier,
  { ignores: ['node_modules', 'dist'] },
)
