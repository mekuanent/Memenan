"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function MemberSermonsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [sermons, setSermons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Live' | 'Past'>('All');

  useEffect(() => {
    const fetchSermons = async () => {
      if (!profile?.churches || profile.churches.length === 0) {
        setLoading(false);
        return;
      }
      
      const churchIds = profile.churches.map((c: any) => c.churchId);

      try {
        // Fetch explicit Church Name structures mapping globally
        const churchDocs = await Promise.all(churchIds.slice(0, 10).map((cid: string) => getDoc(doc(db, 'churches', cid))));
        const churchMap = churchDocs.reduce((acc, c) => {
           if(c.exists()) acc[c.id] = c.data()?.name || 'Local Church';
           return acc;
        }, {} as Record<string, string>);

        const qSermons = query(collection(db, 'sermons'), where('churchId', 'in', churchIds.slice(0, 10)));
        const snapSermons = await getDocs(qSermons);
        
        const rawSermons = snapSermons.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return { id: docSnap.id, churchName: churchMap[data.churchId] || 'Network Church', ...data };
        });
        
        // Sort newest first
        rawSermons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSermons(rawSermons);

      } catch (err) {
        console.error('Data retrieval failed:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchSermons();
  }, [profile, authLoading]);

  if (authLoading || loading) return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading media library...</div>;

  const isCurrentlyLive = (sermon: any) => {
      if (!sermon.isLive) return false;
      if (!sermon.liveExpiryDate) return sermon.isLive;
      return new Date() < new Date(sermon.liveExpiryDate);
  };

  const filteredSermons = sermons.filter(sermon => {
    const liveStatus = isCurrentlyLive(sermon);
    
    // 1. Filter Type
    if (filterType === 'Live' && !liveStatus) return false;
    if (filterType === 'Past' && liveStatus) return false;
    
    // 2. Search Term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchTitle = sermon.title?.toLowerCase().includes(term);
      const matchPreacher = sermon.preacher?.toLowerCase().includes(term);
      const matchDesc = sermon.description?.toLowerCase().includes(term);
      if (!matchTitle && !matchPreacher && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '0 2rem 4rem 2rem', flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ padding: '4rem 0 3rem 0', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.8rem', fontWeight: '800', letterSpacing: '-1px' }}>Sermon Archive</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '1rem', maxWidth: '500px', margin: '1rem auto 0 auto' }}>
              Watch recent messages, live streams, and catch up on series from your church family.
            </p>
        </div>

        {(!profile?.churches || profile.churches.length === 0) ? (
          <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
             <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '1.5rem' }}>You aren't connected to a church yet.</p>
             <Link href="/churches" className="btn-primary" style={{ padding: '0.8rem 1.5rem' }}>Explore Churches</Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.35rem', borderRadius: '100px', border: '1px solid var(--border)' }}>
                <button onClick={() => setFilterType('All')} style={{ background: filterType === 'All' ? 'var(--primary)' : 'transparent', color: filterType === 'All' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1.5rem', borderRadius: '100px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}>All</button>
                <button onClick={() => setFilterType('Live')} style={{ background: filterType === 'Live' ? '#EF4444' : 'transparent', color: filterType === 'Live' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1.5rem', borderRadius: '100px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}>Live Streams</button>
                <button onClick={() => setFilterType('Past')} style={{ background: filterType === 'Past' ? 'var(--primary)' : 'transparent', color: filterType === 'Past' ? 'white' : 'var(--text-secondary)', padding: '0.5rem 1.5rem', borderRadius: '100px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}>Past Sermons</button>
              </div>

              <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
                <svg style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input 
                  type="text" 
                  placeholder="Search by title, speaker, or topic..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem', borderRadius: '99px', border: '1px solid var(--border)', background: 'var(--card-bg)', outline: 'none', fontSize: '0.95rem' }} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '2.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
              {filteredSermons.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No sermons match your current search or filter.</p>
                  </div>
              ) : (
                  filteredSermons.map((sermon, i) => {
                      const liveStatus = isCurrentlyLive(sermon);
                      return (
                      <div key={sermon.id} className={`glass-card animate-fade-in-up delay-${(i % 3) * 100}`} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          {/* Video Player Header */}
                          <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderBottom: liveStatus ? '4px solid #EF4444' : 'none' }}>
                              {liveStatus && (
                                  <div style={{ position: 'absolute', top: '1rem', left: '1rem', background: '#EF4444', color: 'white', padding: '0.35rem 0.85rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 800, zIndex: 10, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 0 15px rgba(239, 68, 68, 0.6)' }}>
                                      <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                                      LIVE STREAM
                                  </div>
                              )}
                              <iframe 
                                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                  src={`https://www.youtube.com/embed/${sermon.youtubeId}?rel=0`} 
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                  allowFullScreen
                                  title={sermon.title}
                              />
                          </div>
                          
                          {/* Content Body */}
                        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{sermon.title}</h2>
                                <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    {sermon.churchName}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                    {new Date(sermon.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    {sermon.preacher}
                                </span>
                            </div>

                            {sermon.description && (
                                <p style={{ marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {sermon.description}
                                </p>
                            )}
                        </div>
                    </div>
                  )
                })
            )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
