const config = {
  paths: ["tests/acceptance/features/**/*.feature"],
  requireModule: ["tsx/cjs"],
  require: ["tests/acceptance/steps/**/*.ts"],
  format: ["progress"],
  publish: false,
}

export default config
