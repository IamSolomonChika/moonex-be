/**
 * 🎨 Prettier Configuration for Viem 2.38.5 Migration
 *
 * Code formatting rules to ensure consistent code style
 * Optimized for TypeScript and Viem development
 */

module.exports = {
  // Print width - line length that Prettier will try to maintain
  printWidth: 120,

  // Tab width - number of spaces per indentation level
  tabWidth: 2,

  // Use tabs instead of spaces
  useTabs: false,

  // Semicolons at the ends of statements
  semi: true,

  // Use single quotes instead of double quotes
  singleQuote: true,

  // Quote style for object properties
  quoteProps: 'as-needed',

  // Use single quotes in JSX
  jsxSingleQuote: true,

  // Trailing commas where valid in ES5 (objects, arrays, etc.)
  trailingComma: 'all',

  // Spaces between brackets in object literals
  bracketSpacing: true,

  // Include parentheses around a sole arrow function parameter
  arrowParens: 'avoid',

  // Format only files that have a pragma comment at the top
  requirePragma: false,

  // Insert pragma comment at the top of formatted files
  insertPragma: false,

  // How to handle whitespace in prose
  proseWrap: 'preserve',

  // How to handle whitespace in HTML
  htmlWhitespaceSensitivity: 'css',

  // How to handle Vue files
  vueIndentScriptAndStyle: false,

  // Control whether Prettier formats quoted code embedded in the file
  embeddedLanguageFormatting: 'auto',

  // Enforce single attribute per line in HTML, Vue and JSX
  singleAttributePerLine: false,

  // Plugins
  plugins: [],

  // Parser options for different file types
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2,
        trailingComma: 'none'
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always',
        tabWidth: 2
      }
    },
    {
      files: '*.yml',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: '*.yaml',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    },
    {
      files: 'package.json',
      options: {
        printWidth: 100,
        tabWidth: 2,
        trailingComma: 'none'
      }
    },
    {
      files: 'tsconfig.json',
      options: {
        printWidth: 100,
        tabWidth: 2,
        trailingComma: 'none'
      }
    },
    {
      files: '.eslintrc.js',
      options: {
        printWidth: 100,
        tabWidth: 2
      }
    },
    {
      files: '.prettierrc.js',
      options: {
        printWidth: 100,
        tabWidth: 2
      }
    },
    {
      files: 'Dockerfile*',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    },
    {
      files: '*.dockerfile',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    }
  ],

  // Custom parser options
  parser: undefined,

  // Custom require pragma
  requirePragma: false,

  // Custom insert pragma
  insertPragma: false,

  // Custom prose wrap
  proseWrap: 'preserve',

  // Custom HTML whitespace sensitivity
  htmlWhitespaceSensitivity: 'css',

  // Custom Vue indent script and style
  vueIndentScriptAndStyle: false,

  // Custom end-of-line character
  endOfLine: 'lf'
};