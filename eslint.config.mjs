import nx from '@nx/eslint-plugin';
import importPlugin from 'eslint-plugin-import';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.js', '**/*.jsx'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      'require-await': 'warn',
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': 'off', // Covered by tsconfig 'noUnusedLocals' flag
      '@typescript-eslint/no-require-imports': 'off', // This is a modern code base, if you're using `require` you likely have no choice
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'never',
        },
      ],
      'import/order': [
        'warn',
        {
          groups: [
            'external',
            'builtin',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [
            {
              pattern: '@universe/**',
              group: 'internal',
            },
            {
              pattern: '@/**',
              group: 'parent',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['internal'],
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:server',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:server'],
            },
            {
              sourceTag: 'scope:client',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:client'],
            },
            {
              sourceTag: 'scope:hybrid',
              onlyDependOnLibsWithTags: [
                'scope:shared',
                'scope:client',
                'scope:server',
              ],
            },
          ],
        },
      ],
    },
  },
];
