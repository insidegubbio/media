import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isSSR = mode.startsWith('ssr');

  return {
    plugins: [react()],
    root: './src/client',
    build: {
      outDir: '../../build/client',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'src/client/index.html'),
          'ssr-view': path.resolve(__dirname, 'src/client/ssr-view/index.html'),
          'ssr-view-url': path.resolve(__dirname, 'src/client/ssr-view-url/index.html'),
        },
        output: {
          format: isSSR ? 'cjs' : 'esm',
          entryFileNames: isSSR ? `${mode}.js` : '[name]-[hash].js',
        },
      },
      target: 'esnext',
    },

    server: {
      host: true,
      middlewareMode: true,
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
