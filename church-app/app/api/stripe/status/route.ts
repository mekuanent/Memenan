import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2023-10-16' as any,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get('churchId');

    if (!churchId) {
      return NextResponse.json({ active: false });
    }

    const adminDb = getAdminDb();
    const churchDoc = await adminDb.collection('churches').doc(churchId).get();
    const accountId = churchDoc.data()?.stripeAccountId;
    
    if (!accountId) {
      return NextResponse.json({ active: false });
    }
    
    // Explicitly grab the active Connect Account retrieving deep native property flags organically
    const account = await stripe.accounts.retrieve(accountId);
    
    return NextResponse.json({ active: account.details_submitted });
  } catch (error) {
    console.error("Stripe Status Exception:", error);
    return NextResponse.json({ active: false });
  }
}
