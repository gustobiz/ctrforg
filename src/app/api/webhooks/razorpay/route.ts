import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// We need the service role key to securely bypass RLS in the webhook
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
      .update(body)
      .digest('hex')

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentEntity = event.payload.payment.entity
      const notes = paymentEntity.notes || {}
      const userId = notes.userId
      const planId = notes.planId

      if (userId && planId) {
        // Upsert subscription in Supabase
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          provider: 'razorpay',
          provider_customer_id: paymentEntity.customer_id,
          provider_subscription_id: paymentEntity.order_id,
          plan_id: planId,
          plan_name: planId, // Could map this to nicer name
          status: 'active',
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Roughly 1 month
        }, { onConflict: 'user_id' })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
