import { NextResponse } from 'next/server'
import { getUserSubscription } from '@/lib/subscription'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    // Return mock for local dev if bypass is active
    return NextResponse.json({ 
      subscription: null, 
      userId: 'mock-user-id',
      email: 'mock@example.com'
    })
  }

  const subscription = await getUserSubscription()
  return NextResponse.json({ 
    subscription, 
    userId: session.user.id,
    email: session.user.email 
  })
}
