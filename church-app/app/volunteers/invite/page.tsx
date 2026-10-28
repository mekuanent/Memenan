"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  
  const teamId = searchParams.get('teamId');
  const churchId = searchParams.get('churchId');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Save intent and redirect to login
      router.push(`/login?redirect=/volunteers/invite?teamId=${teamId}&churchId=${churchId}`);
      return;
    }
    
    handleAcceptInvite();
  }, [user, authLoading, teamId, churchId, router]);

  const handleAcceptInvite = async () => {
    if (!teamId || !churchId) {
      setError('Invalid invite link.');
      setLoading(false);
      return;
    }

    try {
      // Ensure the user is actually a member of the church
      const isMember = profile?.churches?.some((c: any) => c.churchId === churchId);
      if (!isMember) {
        setError('You must join this church before you can become a team leader.');
        setLoading(false);
        return;
      }

      const teamRef = doc(db, 'volunteer_teams', teamId);
      const teamSnap = await getDoc(teamRef);
      
      if (!teamSnap.exists()) {
        setError('Team not found or has been deleted.');
        setLoading(false);
        return;
      }

      await updateDoc(teamRef, {
        leaders: arrayUnion({ userId: user!.uid, name: profile?.name || user!.email })
      });
      
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Failed to accept invite. Please try again.');
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return <div style={{ padding: '6rem', textAlign: 'center' }}>Validating Invite...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '6rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#DC2626', marginBottom: '1rem' }}>Invite Failed</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button onClick={() => router.push('/dashboard')} className="btn-secondary" style={{ marginTop: '2rem' }}>Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up" style={{ padding: '6rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ width: '64px', height: '64px', background: 'rgba(34, 197, 94, 0.1)', color: '#16A34A', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>You're officially a Team Leader!</h2>
      <p style={{ color: 'var(--text-secondary)' }}>You have successfully been added as a leader for this volunteer team.</p>
      
      <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button onClick={() => router.push('/dashboard/volunteers')} className="btn-primary">Go to Volunteer Dashboard</button>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div style={{ padding: '6rem', textAlign: 'center' }}>Loading...</div>}>
      <InviteContent />
    </Suspense>
  );
}
