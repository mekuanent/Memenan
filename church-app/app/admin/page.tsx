"use client";

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [churches, setChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingChurches = async () => {
    try {
      const q = query(collection(db, 'churches'), where('approvalStatus', '==', 'Pending'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChurches(data);
    } catch (error) {
      console.error(error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        window.location.href = '/login';
      } else if (profile?.globalRole !== 'Super Admin') { 
        window.location.href = '/dashboard';
      } else {
        fetchPendingChurches();
      }
    }
  }, [user, profile, authLoading]);

  const handleApprove = async (churchId: string) => {
    try {
      const churchRef = doc(db, 'churches', churchId);
      await updateDoc(churchRef, { approvalStatus: 'Approved' });
      setChurches(churches.filter(c => c.id !== churchId));
      alert("Church approved successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to approve church.");
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Verifying Super Admin Authorization...</p>
      </div>
    );
  }

  // Double fail-safe based on Firestore Role profile
  if (!user || profile?.globalRole !== 'Super Admin') return null;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Super Admin Portal</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Review and manage pending network applications globally.</p>
          </div>
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', borderRadius: '999px', fontWeight: 600, fontSize: '0.875rem' }}>
            {churches.length} Pending
          </div>
        </div>
        
        <section>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '1rem' }}>Loading pending churches...</p>
            </div>
          ) : churches.length === 0 ? (
            <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', borderStyle: 'dashed' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 1rem', color: 'var(--text-secondary)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>All Caught Up!</h3>
              <p style={{ color: 'var(--text-secondary)' }}>There are no pending churches to review right now.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {churches.map((church, i) => (
                <div key={church.id} className={`glass-card animate-fade-in-up delay-${(i % 3 + 1) * 100}`} style={{ 
                  padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderLeft: '4px solid var(--cta)'
                }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>{church.name}</h3>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Tax ID: <span style={{ color: 'var(--text-primary)' }}>{church.taxId}</span>
                      </p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Submitted: <span style={{ color: 'var(--text-primary)' }}>{new Date(church.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleApprove(church.id)} className="btn-cta" style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}>
                    Approve
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
