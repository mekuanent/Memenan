"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function DashboardAnnouncements() {
  const { user, profile, loading: authLoading } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);
  
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<{ [id: string]: boolean }>({});

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
      await loadAnnouncements(adminRole.churchId);
    };
    if (profile) fetchContext();
  }, [profile]);

  const loadAnnouncements = async (cid: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'announcements'),
        where('churchId', '==', cid)
      );
      const snapshot = await getDocs(q);
      const rawRecords = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      rawRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAnnouncements(rawRecords);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchId || (!title.trim() && !content.trim())) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        churchId,
        authorId: user?.uid,
        authorName: user?.displayName || profile?.name || 'Church Staff',
        title: title.trim(),
        content: content.trim(),
        comments: [],
        createdAt: new Date().toISOString()
      });
      setTitle('');
      setContent('');
      await loadAnnouncements(churchId);
    } catch (err: any) {
      console.error(err);
      alert('Oops! We had trouble posting that update. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      alert('Looks like we had trouble deleting that post.');
    }
  };

  // Replace a comment in-place using arrayRemove + arrayUnion
  const replaceComment = async (postId: string, original: any, updated: any) => {
    await updateDoc(doc(db, 'announcements', postId), { comments: arrayRemove(original) });
    await updateDoc(doc(db, 'announcements', postId), { comments: arrayUnion(updated) });
    setAnnouncements(prev => prev.map(p => {
      if (p.id !== postId) return p;
      return { ...p, comments: p.comments.map((c: any) => c === original ? updated : c) };
    }));
  };

  const handleToggleHideComment = async (postId: string, comment: any) => {
    try {
      await replaceComment(postId, comment, { ...comment, hidden: !comment.hidden });
    } catch (err) {
      console.error(err);
      alert('Could not update that comment. Please try again.');
    }
  };

  const handleToggleFlagAccount = async (postId: string, comment: any) => {
    try {
      await replaceComment(postId, comment, { ...comment, flagged: !comment.flagged });
    } catch (err) {
      console.error(err);
      alert('Could not flag that account. Please try again.');
    }
  };

  if (loading || authLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading your dashboard...</div>;
  if (!churchId) return <div style={{ padding: '4rem', textAlign: 'center' }}>Access restricted. Only church staff can post updates.</div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             Back to Dashboard
          </Link>
          <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Manage Newsfeed</h1>
        </div>

        <div style={{ display: 'grid', gap: '3rem' }}>
          {/* Post Creation */}
          <div className="glass-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Share an Update
            </h2>
            <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Give your post a title (optional)..." style={{ fontSize: '1.1rem', fontWeight: 500 }} />
              </div>
              <div className="input-group">
                <textarea required value={content} onChange={(e) => setContent(e.target.value)} className="input-field" placeholder="Write your message here. What's going on this week?..." style={{ minHeight: '150px', resize: 'vertical', lineHeight: 1.6 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '0.8rem 2.5rem' }}>
                  {submitting ? 'Sharing to feed...' : 'Post Update'}
                </button>
              </div>
            </form>
          </div>

          {/* Published Posts */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Your Recent Posts</h2>
            {announcements.length === 0 ? (
              <div style={{ padding: '3rem', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                You haven't posted anything yet. Share something above so your church can see it!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {announcements.map((msg) => {
                  const comments = msg.comments || [];
                  const flaggedCount = comments.filter((c: any) => c.flagged).length;
                  const isExpanded = expandedComments[msg.id];
                  return (
                    <div key={msg.id} className="glass-card animate-fade-in-up" style={{ padding: '1.5rem' }}>
                      {/* Post Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{msg.title || 'Church Update'}</h3>
                            <button onClick={() => handleDelete(msg.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px' }}>
                              Delete
                            </button>
                          </div>
                          <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 500, marginTop: '0.2rem' }}>
                            Posted {new Date(msg.createdAt).toLocaleDateString()} by {msg.authorName}
                          </p>
                        </div>
                      </div>

                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</p>

                      {/* Comment Moderation */}
                      {comments.length > 0 && (
                        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                          {/* Toggle button */}
                          <button
                            onClick={() => setExpandedComments(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: isExpanded ? '1rem' : 0, padding: 0 }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            {comments.length} comment{comments.length !== 1 ? 's' : ''}
                            {flaggedCount > 0 && (
                              <span style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '99px' }}>
                                {flaggedCount} flagged
                              </span>
                            )}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>

                          {/* Comment list */}
                          {isExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {comments.map((comment: any, idx: number) => (
                                <div key={idx} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                  padding: '0.75rem 1rem', borderRadius: '10px',
                                  background: comment.hidden ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.02)',
                                  border: `1px solid ${comment.flagged ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
                                  opacity: comment.hidden ? 0.55 : 1,
                                  transition: 'opacity 0.2s'
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{comment.authorName}</span>
                                      {comment.flagged && (
                                        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '99px' }}>⚑ Flagged</span>
                                      )}
                                      {comment.hidden && (
                                        <span style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '99px' }}>Hidden</span>
                                      )}
                                    </div>
                                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{comment.text}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem', opacity: 0.55 }}>
                                      {new Date(comment.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexShrink: 0 }}>
                                    <button
                                      onClick={() => handleToggleHideComment(msg.id, comment)}
                                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}
                                    >
                                      {comment.hidden ? 'Unhide' : 'Hide'}
                                    </button>
                                    <button
                                      onClick={() => handleToggleFlagAccount(msg.id, comment)}
                                      style={{
                                        background: comment.flagged ? 'rgba(239,68,68,0.08)' : 'none',
                                        border: `1px solid ${comment.flagged ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                                        borderRadius: '6px', padding: '0.3rem 0.65rem', cursor: 'pointer',
                                        fontSize: '0.78rem', fontWeight: 600,
                                        color: comment.flagged ? '#DC2626' : 'var(--text-secondary)'
                                      }}
                                    >
                                      {comment.flagged ? '⚑ Unflag' : '⚑ Flag'}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
