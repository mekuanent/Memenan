"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function DashboardSermons() {
  const { user, profile, loading: authLoading } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);
  
  const [sermons, setSermons] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [preacher, setPreacher] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [liveExpiryTime, setLiveExpiryTime] = useState('');
  
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
      await loadSermons(adminRole.churchId);
    };
    if (profile) fetchContext();
  }, [profile]);

  const loadSermons = async (cid: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'sermons'),
        where('churchId', '==', cid)
      );
      const snapshot = await getDocs(q);
      const rawRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      // Sort natively keeping newest sermons at the top
      rawRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSermons(rawRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const extractYouTubeId = (urlStr: string) => {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlStr.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchId || !title.trim() || !url.trim() || !date) return;
    
    const youtubeId = extractYouTubeId(url);
    if (!youtubeId) {
      alert("Please provide a valid YouTube URL.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'sermons'), {
        churchId,
        authorId: user?.uid,
        title: title.trim(),
        youtubeId,
        preacher: preacher.trim() || 'Guest Speaker',
        description: description.trim(),
        isLive,
        liveExpiryDate: isLive ? new Date(liveExpiryTime).toISOString() : null,
        date: new Date(date).toISOString(),
        createdAt: new Date().toISOString()
      });
      
      setTitle('');
      setUrl('');
      setPreacher('');
      setDescription('');
      setDate('');
      setIsLive(false);
      setLiveExpiryTime('');
      
      await loadSermons(churchId);
    } catch (err: any) {
      console.error(err);
      alert('We had trouble uploading the sermon slot. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, titleStr: string) => {
    if (!confirm(`Are you sure you want to permanently delete '${titleStr}'?`)) return;
    try {
      await deleteDoc(doc(db, 'sermons', id));
      setSermons(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to safely delete the sermon.");
    }
  };

  if (loading || authLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading your media hub...</div>;
  if (!churchId) return <div style={{ padding: '4rem', textAlign: 'center' }}>Access restricted. Only church staff can manage sermons.</div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Sermon Archive</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          {/* Post Creation Hub */}
          <div className="glass-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              Upload a New Sermon
            </h2>
            <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Sermon Title (e.g. The Power of Grace)" style={{ fontSize: '1.1rem', fontWeight: 500 }} />
              </div>
              <div className="input-group">
                <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="input-field" placeholder="YouTube Link (e.g. https://youtube.com/watch?v=...)" />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>Date Preached</label>
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>Speaker / Preacher</label>
                  <input type="text" value={preacher} onChange={(e) => setPreacher(e.target.value)} className="input-field" placeholder="Pastor John Doe" />
                </div>
              </div>
              <div className="input-group">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="Briefly describe the message..." style={{ minHeight: '120px', resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              
              <div className="input-group" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#EF4444' }} />
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>This is an active Live Stream</span>
                </label>
                
                {isLive && (
                  <div className="animate-fade-in-up" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(239, 68, 68, 0.1)' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block', fontWeight: 600 }}>Stream Expiry Time (When does the service end?)</label>
                    <input required type="datetime-local" value={liveExpiryTime} onChange={(e) => setLiveExpiryTime(e.target.value)} className="input-field" style={{ background: 'white' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.8rem 2.5rem' }}>
                  {submitting ? 'Publishing...' : 'Publish Sermon'}
                </button>
              </div>
            </form>
          </div>

          {/* Published Feed View */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Published Media</h2>
            {sermons.length === 0 ? (
              <div style={{ padding: '3rem', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                You haven't published any sermons yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {sermons.map((sermon) => (
                  <div key={sermon.id} className="glass-card animate-fade-in-up" style={{ padding: '1.5rem', position: 'relative', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    
                    <div style={{ width: '120px', height: '80px', background: 'var(--border)', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`https://img.youtube.com/vi/${sermon.youtubeId}/mqdefault.jpg`} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sermon.title}</h3>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                {new Date(sermon.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                {sermon.preacher}
                            </span>
                        </div>
                    </div>

                    <button onClick={() => handleDelete(sermon.id, sermon.title)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', alignSelf: 'flex-start' }}>
                        Delete
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
