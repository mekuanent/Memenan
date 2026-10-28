"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function DashboardEvents() {
  const { user, profile, loading: authLoading } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);
  
  const [events, setEvents] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) window.location.href = '/login';
  }, [user, authLoading]);

  useEffect(() => {
    const fetchContext = async () => {
      const adminRole = profile?.churches?.find((c: any) => c.role === 'Church Admin' || c.role === 'Admin');
      if (!adminRole) {
        setLoading(false);
        return;
      }
      setChurchId(adminRole.churchId);
      await loadEvents(adminRole.churchId);
    };
    if (profile) fetchContext();
  }, [profile]);

  const loadEvents = async (cid: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'events'),
        where('churchId', '==', cid)
      );
      const snapshot = await getDocs(q);
      const rawRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      // Sort natively keeping closest upcoming events explicitly mapped accurately
      rawRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setEvents(rawRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchId || !title.trim() || !date) return;
    
    setSubmitting(true);
    try {
      // Create comprehensive strictly standard ISO parsing logic spanning Time formats cleanly
      const eventTimestamp = new Date(`${date}T${time || '12:00'}`).toISOString();

      await addDoc(collection(db, 'events'), {
        churchId,
        authorId: user?.uid,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: eventTimestamp,
        rsvps: [], // Initiates RSVP counter array cleanly securely tracking Users natively 
        createdAt: new Date().toISOString()
      });
      setTitle('');
      setDescription('');
      setLocation('');
      setDate('');
      setTime('');
      await loadEvents(churchId);
    } catch (err: any) {
      console.error(err);
      alert('We had trouble creating the event calendar slot. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, titleStr: string) => {
    if (!confirm(`Are you absolutely sure you want to permanently cancel and delete '${titleStr}'?`)) return;
    try {
      await deleteDoc(doc(db, 'events', id));
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to safely delete the event routing framework.");
    }
  };

  if (loading || authLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading your calendar tools...</div>;
  if (!churchId) return <div style={{ padding: '4rem', textAlign: 'center' }}>Access restricted. Only church staff can schedule events.</div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Manage Church Calendar</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {/* Post Creation Hub */}
          <div className="glass-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Schedule a New Event
            </h2>
            <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Event Name (e.g. Wednesday Night Youth Group)" style={{ fontSize: '1.1rem', fontWeight: 500 }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>Event Date</label>
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>Start Time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input-field" />
                </div>
              </div>
              <div className="input-group">
                 <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input-field" placeholder="Location Details (e.g. Main Sanctuary, or Zoom Link)" />
              </div>
              <div className="input-group">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Add extra event details and context here..." style={{ minHeight: '120px', resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.8rem 2.5rem' }}>
                  {submitting ? 'Creating Event...' : 'Add to Calendar'}
                </button>
              </div>
            </form>
          </div>

          {/* Published Feed View */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Upcoming Calendar Events</h2>
            {events.length === 0 ? (
              <div style={{ padding: '3rem', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                You haven't scheduled any upcoming events formally.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {events.map((evt) => (
                  <div key={evt.id} className="glass-card animate-fade-in-up" style={{ padding: '1.5rem', position: 'relative', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    
                    <div style={{ background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)', padding: '1rem', borderRadius: '12px', minWidth: '80px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                            {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                            {new Date(evt.date).toLocaleDateString('en-US', { day: 'numeric' })}
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{evt.title}</h3>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {new Date(evt.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            {evt.location && (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                    {evt.location}
                                </span>
                            )}
                        </div>
                        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ padding: '0.25rem 0.75rem', background: '#F1F5F9', color: 'var(--text-primary)', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                                {evt.rsvps?.length || 0} Confirmations
                            </span>
                        </div>
                    </div>

                    <button onClick={() => handleDelete(evt.id, evt.title)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', alignSelf: 'flex-start' }}>
                        Cancel Event
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
