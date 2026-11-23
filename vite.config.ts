import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'AntigravityStudyEditor',
      formats: ['iife'],
      fileName: () => 'study-editor.min.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'study-editor.min.css';
          }
          return '[name].[ext]';
        },
      },
    },
  },
});
