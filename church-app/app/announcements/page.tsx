"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function ChurchNetworkFeed() {
  const { user, profile, loading: authLoading } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'Feed' | 'Events'>('Feed');
  
  // Local state purely for tying temporary comment inputs strings per specific Post ID natively
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchBroadcastsAndEvents = async () => {
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

        // 1. Fetch Newsfeed Announcements
        const qAnnounce = query(collection(db, 'announcements'), where('churchId', 'in', churchIds.slice(0, 10)));
        const snapAnnounce = await getDocs(qAnnounce);
        
        const rawAnnouncements = snapAnnounce.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return { id: docSnap.id, churchName: churchMap[data.churchId] || 'Network Church', ...data };
        });
        rawAnnouncements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setAnnouncements(rawAnnouncements);

        // 2. Fetch Global Network Events
        const qEvents = query(collection(db, 'events'), where('churchId', 'in', churchIds.slice(0, 10)));
        const snapEvents = await getDocs(qEvents);

        const rawEvents = snapEvents.docs.map(docSnap => {
          const data = docSnap.data() as any;
          return { id: docSnap.id, churchName: churchMap[data.churchId] || 'Network Church', ...data };
        });
        rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Filter out deeply expired events (keeping today's and future) natively
        const activeEvents = rawEvents.filter(e => new Date(e.date).getTime() >= Date.now() - 86400000);
        setEvents(activeEvents);

      } catch (err) {
        console.error('Data retrieval failed:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchBroadcastsAndEvents();
  }, [profile, authLoading]);

  const handleDisplayComment = (postId: string, text: string) => {
    setCommentInputs(prev => ({ ...prev, [postId]: text }));
  };

  const handlePostComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || !user) return; // Ignore blank comments completely
    
    try {
        const newComment = {
            authorId: user.uid,
            authorName: user.displayName || profile?.name || 'Member',
            text: text,
            createdAt: new Date().toISOString()
        };

        await updateDoc(doc(db, 'announcements', postId), {
            comments: arrayUnion(newComment)
        });

        setAnnouncements(prev => prev.map(p => {
            if(p.id === postId) {
                return { ...p, comments: [...(p.comments || []), newComment] };
            }
            return p;
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
        console.error(err);
        alert("Couldn't post your comment right now.");
    }
  };

  const toggleRSVP = async (eventId: string, isGoing: boolean) => {
     if(!user) return;
     try {
         const rsvpPayload = { userId: user.uid, name: user.displayName || profile?.name || 'Member' };
         
         if (isGoing) {
             // Cancel RSVP safely removing the identical explicit record match cleanly natively
             await updateDoc(doc(db, 'events', eventId), { rsvps: arrayRemove(rsvpPayload) });
             setEvents(prev => prev.map(e => {
                 if (e.id === eventId) return { ...e, rsvps: e.rsvps.filter((r: any) => r.userId !== user.uid) };
                 return e;
             }));
         } else {
             // Confirm RSVP
             await updateDoc(doc(db, 'events', eventId), { rsvps: arrayUnion(rsvpPayload) });
             setEvents(prev => prev.map(e => {
                 if (e.id === eventId) return { ...e, rsvps: [...(e.rsvps || []), rsvpPayload] };
                 return e;
             }));
         }
     } catch (err) {
         console.error("Failed executing RSVP arrays", err);
     }
  };

  if (authLoading || loading) return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Gathering your church network...</div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '0 2rem 4rem 2rem', flex: 1, maxWidth: '650px', margin: '0 auto', width: '100%' }}>
        <div style={{ padding: '3rem 0 2rem 0', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-1px' }}>Church Network</h1>
            
            {/* Elegant Tab System integrating Events intuitively with the News Feed explicitly */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', background: 'var(--card-bg)', padding: '0.35rem', borderRadius: '100px', border: '1px solid var(--border)', maxWidth: 'max-content', margin: '1.5rem auto 0 auto' }}>
               <button 
                  onClick={() => setActiveTab('Feed')} 
                  style={{ background: activeTab === 'Feed' ? 'var(--primary)' : 'transparent', color: activeTab === 'Feed' ? 'white' : 'var(--text-secondary)', padding: '0.6rem 2.5rem', borderRadius: '100px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}
               >
                  News Feed
               </button>
               <button 
                  onClick={() => setActiveTab('Events')} 
                  style={{ background: activeTab === 'Events' ? 'var(--primary)' : 'transparent', color: activeTab === 'Events' ? 'white' : 'var(--text-secondary)', padding: '0.6rem 2.5rem', borderRadius: '100px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: '0.2s' }}
               >
                  Upcoming Events
               </button>
            </div>
        </div>

        {(!profile?.churches || profile.churches.length === 0) ? (
          <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
             <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '1.5rem' }}>You aren't connected to a church yet.</p>
             <Link href="/churches" className="btn-primary" style={{ padding: '0.8rem 1.5rem' }}>Explore Churches</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '3rem' }}>
            
            {/* ======================= */}
            {/* TAB: NEWS FEED RENDER */}
            {/* ======================= */}
            {activeTab === 'Feed' && (
                announcements.length === 0 ? (
                  <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
                     <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>It's quiet here. There are no recent updates from your church.</p>
                  </div>
                ) : (
                    announcements.map((post, i) => (
                      <div key={post.id} className={`glass-card animate-fade-in-up delay-${(i % 3) * 100}`} style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {post.authorName?.[0] || 'C'}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{post.title || 'Church Update'}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', overflowX: 'auto' }}>
                                    <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>{post.churchName}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{post.authorName || 'Church Admin'}</span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>• {new Date(post.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {post.content && (
                            <div style={{ padding: '1.5rem' }}>
                                <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                    {post.content}
                                </p>
                            </div>
                        )}

                        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {post.comments?.filter((c: any) => !c.hidden).map((comment: any, idx: number) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.authorName}</span>
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{comment.text}</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', gap: '1rem' }}>
                            <input 
                                type="text" 
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => handleDisplayComment(post.id, e.target.value)}
                                placeholder="Add a comment..."
                                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.95rem' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handlePostComment(post.id);
                                }}
                            />
                            <button 
                                onClick={() => handlePostComment(post.id)}
                                disabled={!commentInputs[post.id]?.trim()}
                                style={{ background: 'transparent', border: 'none', color: commentInputs[post.id]?.trim() ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: commentInputs[post.id]?.trim() ? 'pointer' : 'default' }}
                            >
                                Post
                            </button>
                        </div>
                      </div>
                    ))
                )
            )}

            {/* ======================= */}
            {/* TAB: EVENTS NETWORK RENDER */}
            {/* ======================= */}
            {activeTab === 'Events' && (
                events.length === 0 ? (
                  <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
                     <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Your church doesn't have any formal calendar events coming up right now.</p>
                  </div>
                ) : (
                    events.map((evt, i) => {
                       const hasRSVP = !!evt.rsvps?.find((r: any) => r.userId === user?.uid);
                       
                       return (
                          <div key={evt.id} className={`glass-card animate-fade-in-up delay-${(i % 3) * 100}`} style={{ padding: '2rem' }}>
                              
                              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                                  <div style={{ background: 'var(--primary)', padding: '1.25rem', borderRadius: '16px', minWidth: '90px', textAlign: 'center', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', opacity: 0.9 }}>
                                          {new Date(evt.date).toLocaleDateString('en-US', { month: 'short' })}
                                      </div>
                                      <div style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1.1, marginTop: '0.2rem' }}>
                                          {new Date(evt.date).toLocaleDateString('en-US', { day: 'numeric' })}
                                      </div>
                                  </div>
                                  
                                  <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                          <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{evt.title}</h3>
                                          <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                                              {evt.churchName}
                                          </span>
                                      </div>

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                              {new Date(evt.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                          </span>
                                          {evt.location && (
                                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                  {evt.location}
                                              </span>
                                          )}
                                      </div>
                                  </div>
                              </div>
                              
                              {evt.description && (
                                  <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                                      <p style={{ color: 'var(--text-primary)', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{evt.description}</p>
                                  </div>
                              )}
                              
                              <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                  <button onClick={() => toggleRSVP(evt.id, hasRSVP)} className={hasRSVP ? 'btn-secondary' : 'btn-primary'} style={{ flex: 1, padding: '1rem', fontWeight: 700, borderRadius: '12px', fontSize: '1.05rem', transition: '0.2s', border: hasRSVP ? '1px solid var(--border)' : 'none' }}>
                                      {hasRSVP ? '✓ You are Going! (Click to Cancel)' : 'RSVP to Event'}
                                  </button>
                                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{evt.rsvps?.length || 0}</div>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Attending</div>
                                  </div>
                              </div>
                              
                          </div>
                       )
                    })
                )
            )}

          </div>
        )}
      </main>
    </div>
  );
}
