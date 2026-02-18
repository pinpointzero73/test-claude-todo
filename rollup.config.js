import { readFileSync, copyFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { string } from 'rollup-plugin-string';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const DEBUG_MODE = process.env.DEBUG_MODE ?? 'true';
const BUILD_TARGET = process.env.BUILD_TARGET ?? 'development';

// Copy static assets to dist after build
function copyAssets() {
  return {
    name: 'copy-assets',
    writeBundle() {
      mkdirSync('dist', { recursive: true });
      copyFileSync('src/html/index.html', 'dist/index.html');
      copyFileSync('todo.config.json', 'dist/todo.config.json');
      console.log('Assets copied to dist/');
    }
  };
}

const sharedPlugins = [
  nodeResolve(),
  string({ include: '**/*.css' }),
  replace({
    preventAssignment: true,
    values: {
      '__DEBUG__': DEBUG_MODE,
      '__BUILD_TARGET__': JSON.stringify(BUILD_TARGET),
      '__VERSION__': JSON.stringify(
        JSON.parse(readFileSync('./package.json', 'utf-8')).version
      )
    }
  })
];

export default [
  // IIFE build — for <script> tag usage
  {
    input: 'src/js/index.js',
    output: {
      file: 'dist/todo-list.iife.js',
      format: 'iife',
      name: 'TodoList',
      sourcemap: !isProd
    },
    plugins: [
      ...sharedPlugins,
      isProd && terser(),
      copyAssets()
    ].filter(Boolean)
  },
  // ESM build — for import usage
  {
    input: 'src/js/index.js',
    output: {
      file: 'dist/todo-list.esm.js',
      format: 'esm',
      sourcemap: !isProd
    },
    plugins: [
      ...sharedPlugins,
      isProd && terser()
    ].filter(Boolean)
  }
];
