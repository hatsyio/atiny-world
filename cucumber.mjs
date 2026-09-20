const config = {
  paths: ['tests/bdd/features/**/*.feature'],
  requireModule: ['tsx/cjs'],
  require: [
    'tests/support/test-env.ts',
    'tests/bdd/support/**/*.ts',
    'tests/bdd/step_definitions/**/*.ts',
  ],
  format: ['progress'],
  tags: 'not @pending',
  publish: false,
}

export default config
