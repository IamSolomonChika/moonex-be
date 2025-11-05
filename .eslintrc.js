/**
 * 🔍 ESLint Configuration for Viem 2.38.5 Migration
 *
 * Comprehensive ESLint rules optimized for Viem development
 * Ensures code quality, consistency, and best practices
 */

module.exports = {
  // Environment and parser configuration
  env: {
    node: true,
    es2022: true,
    jest: true
  },

  // TypeScript parser configuration
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname
  },

  // Plugin configuration
  plugins: [
    '@typescript-eslint',
    'eslint-plugin-import',
    'eslint-plugin-jsdoc',
    'eslint-plugin-promise',
    'eslint-plugin-security',
    'eslint-plugin-sonarjs',
    'eslint-plugin-no-unsanitized',
    'eslint-plugin-viem'
  ],

  // Global settings
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json'
      }
    }
  },

  // Base configuration
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:security/recommended',
    'plugin:sonarjs/recommended',
    'plugin:no-unsanitized/recommended'
  ],

  // Global variables
  globals: {
    process: 'readonly',
    Buffer: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    BigInt: 'readonly',
    console: 'readonly'
  },

  // Rules configuration
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],

    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/prefer-const': 'error',
    '@typescript-eslint/no-inferrable-types': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/prefer-as-const': 'error',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-floating-promises': ['error', {
      ignoreIIFE: true
    }],

    // Viem specific rules
    'viem/no-ethers-imports': 'error',
    'viem/prefer-viem-client': 'error',
    'viem/require-chain-config': 'error',
    'viem/no-deprecated-ethers-patterns': 'error',
    'viem/prefer-bigint-over-bignumber': 'error',
    'viem/require-address-validation': 'error',
    'viem/prefer-transaction-options': 'warn',

    // Import/Export rules
    'import/order': [
      'error',
      {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'type'
        ],
        'newlines-between': 'always',
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true
        }
      }
    ],

    'import/no-unresolved': 'off', // TypeScript handles this
    'import/no-cycle': ['error', { maxDepth: 10 }],
    'import/no-self-import': 'error',
    'import/no-useless-path-segments': 'error',
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',

    // JavaScript general rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-lone-block': 'error',
    'no-loop-func': 'error',
    'no-magic-numbers': ['warn', {
      ignore: [-1, 0, 1, 2, 10, 100, 1000],
      enforceConst: true
    }],
    'no-return-assign': 'error',
    'no-return-await': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'prefer-const': 'error',
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'prefer-template': 'error',
    'radix': 'error',
    'yoda': 'error',

    // Security rules
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error',

    // SonarJS rules
    'sonarjs/cognitive-complexity': ['warn', 15],
    'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
    'sonarjs/no-identical-functions': 'error',
    'sonarjs/no-inverted-boolean-check': 'error',
    'sonarjs/no-magic-numbers': ['warn', {
      ignore: [-1, 0, 1, 2, 10, 100, 1000]
    }],
    'sonarjs/no-small-switch-case': 'error',
    'sonarjs/prefer-immediate-return': 'error',
    'sonarjs/prefer-single-boolean-return': 'error',
    'sonarjs/no-nested-switch': 'error',
    'sonarjs/no-nested-if': 'error',
    'sonarjs/prefer-immediate-return': 'error',

    // JSDoc rules
    'jsdoc/require-jsdoc': ['warn', {
      contexts: [
        'FunctionExpression',
        'ClassDeclaration',
        'MethodDefinition'
      ],
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
        ArrowFunctionExpression: false,
        FunctionExpression: true
      }
    }],
    'jsdoc/require-description': 'warn',
    'jsdoc/require-param': 'warn',
    'jsdoc/require-returns': 'warn',
    'jsdoc/require-example': 'off',

    // Promise rules
    'promise/always-return': 'error',
    'promise/no-return-wrap': 'error',
    'promise/param-names': 'error',
    'promise/catch-or-return': 'error',
    'promise/no-native': 'off',
    'promise/no-nesting': 'warn',
    'promise/no-promise-in-callback': 'warn',
    'promise/no-callback-in-promise': 'warn',

    // Code formatting and style
    'quotes': ['error', 'single', {
      avoidEscape: true,
      allowTemplateLiterals: true
    }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    'eol-last': 'error',
    'no-trailing-spaces': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-before-blocks': 'error',
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }],
    'keyword-spacing': 'error',
    'space-in-parens': ['error', 'never'],
    'space-unary-ops': ['error', {
      words: true,
      nonwords: false
    }],
    'brace-style': ['error', '1tbs', {
      allowSingleLine: true
    }],
    'max-len': ['warn', {
      code: 120,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreComments: true
    }],
    'max-depth': ['warn', 5],
    'max-nested-callbacks': ['warn', 3],
    'max-params': ['warn', 5],
    'max-statements-per-line': ['error', 1],
    'multiline-comment-style': ['error', 'starred-block'],

    // Custom Viem migration rules
    'no-restricted-imports': ['error', {
      patterns: [
        {
          group: ['ethers'],
          message: 'Ethers.js imports are not allowed. Use Viem instead.'
        },
        {
          group: ['@ethersproject'],
          message: 'Ethers.js imports are not allowed. Use Viem instead.'
        }
      ]
    }],

    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    'node/no-callback-literal': 'error',

    // Async/await rules
    'require-await': 'error',
    'no-return-await': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // Type safety
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',

    // Code complexity
    'complexity': ['warn', 15],
    'max-statements': ['warn', 50],
    'max-lines': ['warn', 500],
    'max-lines-per-function': ['warn', 100]
  },

  // Override rules for test files
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.ts'],
      env: {
        jest: true
      },
      rules: {
        'no-magic-numbers': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        'sonarjs/cognitive-complexity': 'off',
        'max-lines-per-function': 'off'
      }
    },

    // Configuration files
    {
      files: ['*.config.js', '*.config.ts', '**/config/**/*'],
      rules: {
        'no-console': 'off',
        'no-magic-numbers': 'off'
      }
    },

    // Scripts and build files
    {
      files: ['scripts/**/*', '**/build/**/*'],
      rules: {
        'no-console': 'off',
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off'
      }
    }
  ]
};