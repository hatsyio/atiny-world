import Module from 'node:module'

// Cucumber runs server modules in plain Node, outside Next's server compiler.
const moduleLoader = Module as unknown as { _load: (...args: unknown[]) => unknown }
const originalLoad = moduleLoader._load
moduleLoader._load = (request, ...args) => request === 'server-only' ? {} : originalLoad(request, ...args)
