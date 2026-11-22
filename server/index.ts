import { serve } from '@hono/node-server'
import { createApp } from './app'
import { makeGenerate, makeVerifyUser } from './claude'

// Secrets live in .env.local (git-ignored). Only this server reads ANTHROPIC_API_KEY.
try {
  process.loadEnvFile('.env.local')
} catch {
  // No .env.local: the feed helper still works; study sets report "not set up".
}

const port = Number(process.env.PORT ?? 8787)
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const apiKey = process.env.ANTHROPIC_API_KEY

const studySet = supabaseUrl && supabaseKey
  ? { verifyUser: makeVerifyUser(supabaseUrl, supabaseKey), generate: apiKey ? makeGenerate(apiKey) : null }
  : undefined

serve({ fetch: createApp({ studySet }).fetch, port }, () => {
  console.log(`Praedus feed helper on http://localhost:${port}`)
  console.log(apiKey ? 'AI study sets: on' : 'AI study sets: off (no ANTHROPIC_API_KEY in .env.local)')
})
