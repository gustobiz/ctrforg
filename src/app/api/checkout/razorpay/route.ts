import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
})

const PLANS = {
  pro_monthly: { amount: 2900, currency: 'USD' }, // Amount in cents, but Razorpay works in smallest currency unit. Let's assume INR for India, but if USD is selected: 2900 cents
  pro_yearly: { amount: 29000, currency: 'USD' },
  agency_monthly: { amount: 9900, currency: 'USD' },
  agency_yearly: { amount: 99000, currency: 'USD' },
}

export async function POST(req: Request) {
  try {
    const { planId, userId } = await req.json()
    
    if (!PLANS[planId as keyof typeof PLANS]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    const planDetails = PLANS[planId as keyof typeof PLANS]

    // Create a Razorpay Order
    const options = {
      amount: planDetails.amount, 
      currency: planDetails.currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId,
        userId
      }
    }

    const order = await razorpay.orders.create(options)

    return NextResponse.json({ orderId: order.id, amount: options.amount, currency: options.currency })
  } catch (error) {
    console.error("Razorpay order creation failed:", error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
