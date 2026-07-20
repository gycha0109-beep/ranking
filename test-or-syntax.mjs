import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manually parse .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log('Testing query with .or() syntax...')
  
  // Syntax Option A: .or('moderation_status.is.null,moderation_status.in.("clean","suggestive")')
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('id, title, moderation_status')
      .eq('status', 'published')
      .or('moderation_status.is.null,moderation_status.in.("clean","suggestive")')
      .limit(3)
      
    if (error) {
      console.error('Option A failed:', error.message)
    } else {
      console.log('Option A succeeded! Data:', data)
    }
  } catch (err) {
    console.error('Option A threw error:', err)
  }

  // Syntax Option B: .or('moderation_status.is.null,moderation_status.in.(clean,suggestive)')
  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('id, title, moderation_status')
      .eq('status', 'published')
      .or('moderation_status.is.null,moderation_status.in.(clean,suggestive)')
      .limit(3)
      
    if (error) {
      console.error('Option B failed:', error.message)
    } else {
      console.log('Option B succeeded! Data:', data)
    }
  } catch (err) {
    console.error('Option B threw error:', err)
  }
}

run()
