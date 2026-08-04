import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function envConfigPlugin(): Plugin {
  let env: Record<string, string> = {}
  return {
    name: 'env-config',
    configResolved(config) { env = config.env },
    configureServer(server) {
      server.middlewares.use('/portal/env-config.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.end(`window.__ENV__=${JSON.stringify({ SUPABASE_URL: env.VITE_SUPABASE_URL ?? '', SUPABASE_KEY: env.VITE_SUPABASE_ANON_KEY ?? '' })};`)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'env-config.js',
        source: `window.__ENV__=${JSON.stringify({ SUPABASE_URL: env.VITE_SUPABASE_URL ?? '', SUPABASE_KEY: env.VITE_SUPABASE_ANON_KEY ?? '' })};`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), envConfigPlugin()],
  base: '/portal/',
  build: {
    outDir: '../dist/portal',
    emptyOutDir: true,
  },
});