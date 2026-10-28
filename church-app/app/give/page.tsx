"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
// Using Suspnese block requirement bypasses or wrapping in newer Next.js version limits. 
// Standard query extraction
import { useSearchParams } from 'next/navigation';

export default function Give() {
  const { user } = useAuth();
  
  const [churches, setChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedChurch, setSelectedChurch] = useState('');
  const [amount, setAmount] = useState<string>('50');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  // Fallback to extract standard params cleanly avoiding Next14 strict layout Suspense requirements locally
  const [success, setSuccess] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success')) setSuccess(true);
      if (urlParams.get('canceled')) setCanceled(true);
    }
  }, []);

  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const q = query(collection(db, 'churches'));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        // Strict boundary checking Stripe connectivity pipeline
        const activeChurches = docs.filter((c: any) => c.stripeAccountId && c.approvalStatus === 'Approved');
        setChurches(activeChurches);
        if (activeChurches.length > 0) {
            setSelectedChurch(activeChurches[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChurches();
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutLoading(true);
    setError('');

    const targetChurch = churches.find(c => c.id === selectedChurch);
    if (!targetChurch) return;

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchId: targetChurch.id,
          churchName: targetChurch.name,
          churchStripeAccountId: targetChurch.stripeAccountId,
          amount: parseFloat(amount),
          memberId: user?.uid
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Redirect seamlessly to secure Stripe managed portal
      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to initialize checkout layer.');
      setCheckoutLoading(false);
    }
  };

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '600px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Give Tithes & Offerings</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Support your specific congregation cleanly through direct routing deposits.</p>
      </div>

      {success && (
        <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16A34A', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.2)', marginBottom: '2rem', textAlign: 'center', fontWeight: 600 }}>
          Thank you so much for your generosity! Your contribution has been securely received and recorded.
        </div>
      )}

      {canceled && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', marginBottom: '2rem', textAlign: 'center', fontWeight: 600 }}>
          Your payment intent was correctly securely dismissed. You have safely not been charged.
        </div>
      )}

      <div className="glass-card" style={{ padding: '3rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading secure channels...</div>
        ) : churches.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ width: '48px', height: '48px', margin: '0 auto 1rem', opacity: 0.5 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            No network churches are currently configured to process tithes.
          </div>
        ) : (
          <form onSubmit={handleCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {error && <div style={{ color: '#DC2626', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '1rem', borderRadius: '12px' }}>{error}</div>}
            
            <div className="input-group">
              <label>Select Your Local Church Recipient</label>
              <select required value={selectedChurch} onChange={e => setSelectedChurch(e.target.value)} className="input-field" style={{ background: 'white', color: 'var(--text-primary)' }}>
                <option value="" disabled>Choose an explicitly authorized network church...</option>
                {churches.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Tithe Amount (USD)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-secondary)' }}>$</span>
                <input required type="number" min="5" step="1" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" style={{ paddingLeft: '2.5rem', fontSize: '1.2rem', fontWeight: 600 }} />
              </div>
            </div>

            <button type="submit" disabled={checkoutLoading || !selectedChurch || parseFloat(amount) < 5} className="btn-primary" style={{ marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}>
              {checkoutLoading ? 'Encrypting & Routing Keys...' : 'Proceed to Tithe Securely'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Standard 100% Secure Encrypted Connection
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
