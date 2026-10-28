import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16' as any,
});

export async function POST(req: Request) {
  try {
    const { churchId, amount, churchStripeAccountId, memberId, churchName } = await req.json();

    if (!churchId || !amount || !churchStripeAccountId) {
      return NextResponse.json({ error: 'Missing required dynamic checkout metadata.' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Tithe / Donation to ${churchName || 'Church Network'}`,
            },
            unit_amount: Math.round(amount * 100), // strictly map to Stripe cents internally
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_intent_data: {
        application_fee_amount: 0, // Keeping it completely 0% platform fee for true zero-cost structure
        transfer_data: {
          destination: churchStripeAccountId, // Route payment to the explicitly verified connect account
        },
      },
      metadata: {
        churchId,
        memberId: memberId || 'anonymous'
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/give?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/give?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
