"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function BlogsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      if (!profile?.churches || profile.churches.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const churchIds = profile.churches.map((c: any) => c.churchId);
        
        // Use in query for multi-tenant aggregation
        const q = query(
          collection(db, 'blogs'), 
          where('churchId', 'in', churchIds)
        );
        
        const snap = await getDocs(q);
        const fetchedBlogs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        
        // Client side sort (since 'in' queries can't easily be compound-ordered without composite indexes)
        fetchedBlogs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Map church names
        const enrichedBlogs = await Promise.all(fetchedBlogs.map(async (blog) => {
            const churchDoc = await getDoc(doc(db, 'churches', blog.churchId));
            return {
                ...blog,
                churchName: churchDoc.exists() ? churchDoc.data().name : 'Unknown Church'
            };
        }));

        setBlogs(enrichedBlogs);
      } catch (err) {
        console.error("Error fetching devotionals:", err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchBlogs();
    }
  }, [profile, authLoading]);

  if (authLoading || loading) return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading devotionals...</div>;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main className="animate-fade-in-up" style={{ padding: '0 2rem 4rem 2rem', flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        
        <div style={{ padding: '4rem 0', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1.5px', marginBottom: '1rem' }}>
             Devotionals
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
             Deepen your week with theological articles, pastoral letters, and spiritual insights from your church leaders.
          </p>
        </div>

        {!user ? (
          <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border)' }}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Sign in to read Devotionals</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Connect with your church to access their library of long-form content.</p>
             <Link href="/login" className="btn-primary" style={{ padding: '0.8rem 1.5rem' }}>Login to your Account</Link>
          </div>
        ) : profile?.churches?.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '24px', border: '1px solid var(--border)' }}>
             <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>No Connected Churches</h2>
             <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You must connect to a church to read their devotionals.</p>
             <Link href="/churches" className="btn-primary" style={{ padding: '0.8rem 1.5rem' }}>Explore Churches</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
            {blogs.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No devotionals have been published yet.</p>
                </div>
            ) : (
                blogs.map((blog, i) => (
                    <Link 
                        href={`/blogs/${blog.id}`} 
                        key={blog.id} 
                        className={`glass-card animate-fade-in-up delay-${(i % 3) * 100}`} 
                        style={{ padding: '2rem', textDecoration: 'none', display: 'flex', flexDirection: 'column', transition: '0.3s transform, 0.3s box-shadow', cursor: 'pointer' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <div style={{ background: 'var(--primary)', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '100px' }}>
                                ARTICLE
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                {blog.churchName}
                            </span>
                        </div>
                        
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '1rem' }}>
                            {blog.title}
                        </h2>
                        
                        <div style={{ flex: 1 }}>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {/* Strip markdown for preview text using a simple regex (not perfect, but good for previews) */}
                                {blog.content.replace(/[#*`_>\[\]]/g, '').slice(0, 150)}...
                            </p>
                        </div>

                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{blog.author}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {new Date(blog.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                    </Link>
                ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
