import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase-admin';

// Initialize the raw Stripe backend API client targeting the environment variables.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16' as any, // Flexible compatibility formatting
});

export async function POST(req: Request) {
  try {
    const { churchId } = await req.json();

    if (!churchId) {
      return NextResponse.json({ error: 'Missing church routing ID constraint.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    // Retrieve global record for church context without strict DB policies.
    const churchDoc = await adminDb.collection('churches').doc(churchId).get();
    
    if (!churchDoc.exists) {
      return NextResponse.json({ error: 'Church definition lost.' }, { status: 404 });
    }

    const churchData = churchDoc.data();
    let accountId = churchData?.stripeAccountId;

    // Generate an Express Marketplace routing element for uninitialized Churches seamlessly
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'non_profit', // Pre-configuring compliance metrics
        company: { name: churchData?.name || 'Local Community Network' }
      });

      accountId = account.id;

      // Ensure the newly tracked Account maps back seamlessly against Firestore locally
      await adminDb.collection('churches').doc(churchId).update({
        stripeAccountId: accountId
      });
    }

    // Spawn a time-limited onboarding link passing the routing constraint bounds.
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?stripe_success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Stripe initialization interception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
