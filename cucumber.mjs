const config = {
  paths: ['tests/bdd/features/**/*.feature'],
  requireModule: ['tsx/cjs'],
  require: [
    'tests/bdd/support/**/*.ts',
    'tests/bdd/step_definitions/**/*.ts',
  ],
  format: ['progress'],
  publish: false,
}

export default config
