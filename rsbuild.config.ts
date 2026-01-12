import path from 'node:path';
import { defineConfig } from '@rsbuild/core';
import fs from 'fs-extra';

const defines: any = {
  'process.env.ENTRY': JSON.stringify(process.env.ENTRY),
};

if (process.env.ENTRY === 'esa') {
  [
    'URL_PREFIX',
    'MAX_BATCH_PUSH_COUNT',
    'DB_NAME',
    'ALLOW_NEW_DEVICE',
    'ALLOW_QUERY_NUMS',
    'BASIC_AUTH',
    'APNS_URL',
  ].forEach((key) => {
    defines[`process.env.${key}`] = process.env[key]
      ? JSON.stringify(process.env[key])
      : 'undefined';
  });
}

// Docs: https://rsbuild.rs/config/
export default defineConfig({
  output: {
    target: process.env.ENTRY === 'node' ? 'node' : 'web',
    module: true,
    distPath: {
      root: 'dist',
      js: '.',
    },
    filename: {
      js: '[name].js',
    },
    cleanDistPath: true,
    polyfill: 'off',
    sourceMap: false,
    minify: false,
    externals: ['node:process'],
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  source: {
    entry: {
      handler: {
        import: `./src/entry/${process.env.ENTRY}.ts`,
        html: false,
      },
    },
    define: defines,
  },
  tools: {
    rspack: {
      target: process.env.ENTRY === 'node' ? 'node' : 'es2020',
      output: {
        asyncChunks: false,
        library: {
          type: 'module',
        },
      },
      experiments: {
        outputModule: true,
      },
    },
  },
  plugins: [
    {
      name: 'after',
      setup(api) {
        api.onAfterBuild(async () => {
          if (process.env.ENTRY === 'edgeone') {
            const cwd = process.cwd();
            const dist = path.join(__dirname, 'dist');
            let functions = path.join(cwd, 'edge-functions');
            if (process.env.URL_PREFIX) {
              console.log(`Detected URL_PREFIX: ${process.env.URL_PREFIX}`);
              functions = path.join(functions, process.env.URL_PREFIX);
            }
            await fs.ensureDir(functions);
            const target = path.join(functions, '[[default]].js');
            if (await fs.pathExists(target)) {
              await fs.remove(target);
            }
            console.log(`Move handler.js to ${target}`);
            await fs.move(path.join(dist, 'handler.js'), target);
          }
        });
      },
    },
  ],
});
