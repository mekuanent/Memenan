"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function UserProfile() {
  const { user, profile, loading: authLoading } = useAuth();
  const [churchDetails, setChurchDetails] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/login';
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchChurchDetails = async () => {
      if (profile?.churches) {
        const details = await Promise.all(
          profile.churches.map(async (c: any) => {
            const snap = await getDoc(doc(db, 'churches', c.churchId));
            return { ...c, name: snap.data()?.name || 'Unknown Framework' };
          })
        );
        setChurchDetails(details);
      }
    };
    fetchChurchDetails();
  }, [profile]);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>My Account</h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Manage your personal details and app preferences.</p>
          </div>
          <button onClick={handleSignOut} className="btn-secondary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.95rem' }}>
            Sign Out
          </button>
        </div>
        
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Full Name</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.25rem' }}>{user.displayName || profile?.name || 'Network User'}</p>
            </div>
            
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Email Address</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.25rem' }}>{user.email}</p>
            </div>

            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>Account Capabilities</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ padding: '0.5rem 1rem', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', display: 'inline-block' }}>
                  {profile?.globalRole === 'Super Admin'
                    ? 'Super Admin'
                    : profile?.churches?.some((c: any) => c.role === 'Church Admin' || c.role === 'Admin')
                    ? 'Church Administrator'
                    : profile?.churches?.some((c: any) => c.role === 'Father')
                    ? 'Church Father (ካህን / አባ)'
                    : profile?.churches?.some((c: any) => c.role === 'Deacon')
                    ? 'Deacon (ዲያቆን)'
                    : 'Standard Member'}
                </div>
                {profile?.churches?.some((c: any) => ['Father', 'Deacon', 'Church Admin', 'Admin'].includes(c.role)) && (
                  <Link href="/dashboard/office-hours" className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    🗓️ Manage Office Hours
                  </Link>
                )}
              </div>
            </div>
        </div>

        {churchDetails.length > 0 && (
          <div className="glass-card animate-fade-in-up delay-100" style={{ padding: '2.5rem', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
               <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Tax Exemption Certificates</h2>
               <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Download your IRS-compliant annual contribution statements instantly.</p>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {churchDetails.map((church, idx) => (
                <div key={idx} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{church.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Tax Year: {new Date().getFullYear()}</p>
                  </div>
                  <button 
                    onClick={() => window.open(`/api/tax/certificate?memberId=${user.uid}&churchId=${church.churchId}&year=${new Date().getFullYear()}`, '_blank')}
                    className="btn-primary"
                    style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
                  >
                    Download Official PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
