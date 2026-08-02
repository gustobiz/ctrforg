import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('paddle-signature')
    // In production, you would verify the Paddle webhook signature here
    // using the paddle-node SDK or crypto.
    
    const body = await req.json()
    const { event_type, data } = body

    if (event_type === 'transaction.completed' || event_type === 'subscription.created' || event_type === 'subscription.updated') {
      const customData = data.custom_data || {}
      const userId = customData.userId
      const planId = customData.planId

      if (userId && planId) {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          provider: 'paddle',
          provider_customer_id: data.customer_id,
          provider_subscription_id: data.subscription_id || data.id,
          plan_id: planId,
          plan_name: planId,
          status: data.status || 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { onConflict: 'user_id' })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Paddle webhook processing failed:", error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
