import { defineConfig } from 'vite'

export default defineConfig({
  base: '/loanapp/',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://qatcmxwezenulqxnqdhq.supabase.co'),
    'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhdGNteHdlemVudWxxeG5xZGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDgxNTgsImV4cCI6MjA4OTg4NDE1OH0.87MVoH1Ix-iTr-upZPYttm9J0GGHKXSm7el4EJI8p4M'),
  },
  publicDir: 'public',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild'
  }
})
