'use client'
import { createBrowserClient } from '@supabase/ssr'

export function browserClient(url: string, publishableKey: string) {
  return createBrowserClient(url, publishableKey)
}
