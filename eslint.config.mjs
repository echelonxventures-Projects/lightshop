import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/storybook-static/**', '**/next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Zero vendor lock-in: vendor SDKs may only be imported from adapter packages.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['stripe', 'razorpay', '@adyen/*', 'aws-sdk', '@aws-sdk/*', '@google-cloud/*', 'auth0'], message: 'Vendor SDKs belong in libs/adapters implementations only.' }
          ]
        }
      ]
    }
  },
  {
    // GraphQL response assertions in tests are intentionally loosely typed.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['libs/adapters/**'],
    rules: { 'no-restricted-imports': 'off' }
  }
);
