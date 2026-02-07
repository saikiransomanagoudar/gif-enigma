import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import path from 'path';

export default defineConfig({
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: path.join(__dirname, 'src/server/index.ts'),
    outDir: path.join(__dirname, 'dist/server'),
    emptyOutDir: false,
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: [...builtinModules, /^node:/, '@devvit/web'],
      output: {
        format: 'cjs',
        entryFileNames: 'index.cjs',
        inlineDynamicImports: true,
      },
    },
  },
});
