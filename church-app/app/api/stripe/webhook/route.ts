import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase-admin';

// Reinitialize securely over webhook payload interceptor without hitting database logic instantly
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification mapping failed:`, err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const churchId = session.metadata?.churchId;
      const memberId = session.metadata?.memberId;
      const amount = session.amount_total;

      // Unpack exactly to a secure transaction node skipping client vulnerability entirely
      if (churchId && amount) {
        const adminDb = getAdminDb();
        await adminDb.collection('transactions').add({
          amount: amount / 100, // Strip float values securely storing base unit USD
          date: new Date().toISOString(),
          stripeSessionId: session.id,
          memberId: memberId || 'anonymous',
          churchId: churchId,
          status: 'completed'
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Internal Server Webhook block logic error:', error);
    return NextResponse.json({ error: 'Internal Webhook Logic Error' }, { status: 500 });
  }
}
