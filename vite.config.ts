import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function envConfigPlugin(): Plugin {
  let env: Record<string, string> = {}
  return {
    name: 'env-config',
    configResolved(config) { env = config.env },
    configureServer(server) {
      server.middlewares.use('/env-config.js', (_req, res) => {
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), envConfigPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
