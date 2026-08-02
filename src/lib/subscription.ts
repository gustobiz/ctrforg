import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type SubscriptionPlan = 'free' | 'pro_monthly' | 'pro_yearly' | 'agency_monthly' | 'agency_yearly'

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: SubscriptionPlan
  status: string
  provider: 'razorpay' | 'paddle' | 'none'
  current_period_end: string | null
  usage_video_analyses: number
  usage_outreach_generations: number
}

const FREE_LIMITS = {
  video_analyses: 3,
  outreach_generations: 10,
}

const PRO_LIMITS = {
  video_analyses: 100,
  outreach_generations: 500,
}

const AGENCY_LIMITS = {
  video_analyses: 999999, // practically unlimited
  outreach_generations: 999999,
}

export async function getUserSubscription(): Promise<UserSubscription | null> {
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

  // Get current session
  const { data: { session } } = await supabase.auth.getSession()
  
  // MOCK FOR DEV: if no session, but we bypass auth, let's return null so they see the upgrade prompt
  if (!session) {
    return null
  }

  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .single()

  if (error || !subscription) {
    return null
  }

  return subscription as UserSubscription
}

export function getLimitsForPlan(planId: string) {
  if (planId.startsWith('pro')) return PRO_LIMITS
  if (planId.startsWith('agency')) return AGENCY_LIMITS
  return FREE_LIMITS
}

export async function hasAccess(feature: 'video_analyses' | 'outreach_generations'): Promise<boolean> {
  const sub = await getUserSubscription()
  
  if (!sub) {
    // Check if free usage limit is reached (requires tracking free usage, omitted for brevity, assuming full limits for now)
    return false // For strict gating. Change to true if free tier tracking is implemented elsewhere
  }

  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return false
  }

  const limits = getLimitsForPlan(sub.plan_id)
  const currentUsage = feature === 'video_analyses' ? sub.usage_video_analyses : sub.usage_outreach_generations

  return currentUsage < limits[feature]
}
