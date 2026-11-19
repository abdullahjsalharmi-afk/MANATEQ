import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

// Two builds from one codebase:
//   npm run build         → dist/     multi-file PWA for any static host
//   npm run build:single  → preview/  one self-contained HTML file (opens from a phone, an email or a file share)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [])],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    publicDir: single ? false : 'public',
    build: single
      ? { outDir: 'preview', emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 10_000 }
      : { outDir: 'dist', emptyOutDir: true },
    define: { __SINGLE_FILE__: JSON.stringify(single) },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    },
  };
});
