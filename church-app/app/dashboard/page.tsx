"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function ChurchDashboard() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [churchInfo, setChurchInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectLoading, setConnectLoading] = useState(false);
  const [stripeActive, setStripeActive] = useState(false);
  const [stripeChecking, setStripeChecking] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchChurchContext = async () => {
      // Isolate exact target bounds strictly isolating the local authenticated roles array
      const adminRoleTarget = profile?.churches?.find((c: any) => c.role === 'Church Admin' || c.role === 'Admin');

      if (!adminRoleTarget) {
        setLoading(false);
        return;
      }

      try {
        const churchRef = doc(db, 'churches', adminRoleTarget.churchId);
        const churchDoc = await getDoc(churchRef);

        if (churchDoc.exists()) {
          const data = churchDoc.data();
          setChurchInfo({ id: churchDoc.id, ...data });

          if (data?.stripeAccountId) {
            setStripeChecking(true);
            fetch(`/api/stripe/status?churchId=${churchDoc.id}`)
              .then(res => res.json())
              .then(resData => setStripeActive(resData.active))
              .catch(console.error)
              .finally(() => setStripeChecking(false));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && profile) {
      if (profile.churches && profile.churches.length > 0) {
        fetchChurchContext();
      } else {
        setLoading(false);
      }
    }
  }, [profile, authLoading]);

  const handleStripeConnect = async () => {
    setConnectLoading(true);
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId: churchInfo.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      window.location.href = data.url;
    } catch (err: any) {
      alert(err.message || 'Something went wrong. Please try again.');
      setConnectLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Getting things ready...</div>;
  }

  if (!churchInfo) {
    return (
      <div style={{ padding: '6rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>No Church Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>It looks like you're not connected to a church yet. Complete your church registration and once approved, your dashboard will be ready to go.</p>
      </div>
    );
  }

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>{churchInfo.name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Your admin hub — manage giving, content, events, and your team all in one place.</p>
        </div>
        <div style={{ background: '#F1F5F9', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Status: {churchInfo.approvalStatus || 'Pending'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Payments Control Block */}
        <div className="glass-card" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Financial Gateway</h3>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Accept tithes and offerings from your members online. Connect your church to Stripe to start receiving giving securely.
          </p>

          {churchInfo.stripeAccountId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: stripeChecking ? 'rgba(99, 102, 241, 0.08)' : stripeActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)', color: stripeChecking ? '#6366F1' : stripeActive ? '#16A34A' : '#CA8A04', padding: '1rem', borderRadius: '12px', border: `1px solid ${stripeChecking ? 'rgba(99,102,241,0.25)' : stripeActive ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`, textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  {stripeChecking ? <circle cx="12" cy="12" r="3" /> : stripeActive ? <polyline points="22 4 12 14.01 9 11.01" /> : <line x1="12" y1="8" x2="12" y2="16" />}
                </svg>
                {stripeChecking ? 'Verifying your giving setup…' : stripeActive ? 'Online Giving is Active' : 'Giving Setup Incomplete'}
              </div>
              <button
                onClick={handleStripeConnect}
                disabled={connectLoading}
                className="btn-secondary"
                style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {connectLoading ? 'Redirecting...' : stripeActive ? 'Edit Payout Settings' : 'Finish Setup'}
              </button>
            </div>
          ) : (
            <button onClick={handleStripeConnect} disabled={connectLoading} className="btn-primary" style={{ width: '100%', padding: '1.2rem', fontSize: '1rem' }}>
              {connectLoading ? 'Redirecting...' : 'Connect with Stripe'}
            </button>
          )}
        </div>

        <div onClick={() => window.location.href = '/dashboard/announcements'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Church Newsfeed</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Share news, post photos, and send updates instantly to your entire church family.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Create an Update</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/events'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Events Calendar</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Schedule upcoming services, youth groups, or Bible studies, and track RSVPs reliably.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Manage Events</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/sermons'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sermon Archive</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Upload Sunday messages, live streams, and embed YouTube videos directly to your congregation.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Manage Sermons</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/blogs'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Devotionals</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Write and publish long-form content, devotionals, and pastor's letters to your congregation.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Write Devotional</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/volunteers'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Volunteer Scheduling</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Organize service teams, assign leaders, and post open slots for your members to RSVP.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Manage Volunteers</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/calendar'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Church Calendar</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Set your calendar type — Ethiopian Orthodox or Gregorian — and customize your church's holidays and fasting periods.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Manage Calendar</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/office-hours'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Clergy Office Hours</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Assign Church Fathers and Deacons, and manage 1-on-1 counseling appointments and open drop-in office hours.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Manage Office Hours</button>
        </div>

        <div onClick={() => window.location.href = '/dashboard/services'} className="glass-card" style={{ padding: '2.5rem', cursor: 'pointer', transition: '0.2s', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 2L12 22"/><path d="M5 8L19 8"/></svg>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sacraments & Services</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            Specify the services offered by your church (Eucharist, Infant Baptism, Baptism, Confession) and instructions on how to partake.
          </p>
          <button className="btn-secondary" style={{ width: '100%', fontWeight: 600 }}>Manage Services</button>
        </div>
      </div>
    </main>
  );
}
