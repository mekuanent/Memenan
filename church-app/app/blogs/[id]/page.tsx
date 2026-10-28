"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

export default function BlogReadingPage({ params }: { params: { id: string } }) {
  const [blog, setBlog] = useState<any>(null);
  const [churchName, setChurchName] = useState('Unknown Church');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const docRef = doc(db, 'blogs', params.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            setBlog({ id: docSnap.id, ...data });
            
            // Fetch associated church
            if (data.churchId) {
                const cDoc = await getDoc(doc(db, 'churches', data.churchId));
                if (cDoc.exists()) setChurchName(cDoc.data().name);
            }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [params.id]);

  if (loading) return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading article...</div>;
  
  if (!blog) return (
      <div style={{ padding: '6rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>Article Not Found</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>This devotional may have been deleted or removed by the church administration.</p>
          <Link href="/blogs" className="btn-secondary">Return to Directory</Link>
      </div>
  );

  return (
    <article style={{ minHeight: 'calc(100vh - 72px)', background: 'var(--background)' }}>
      {/* Header Section */}
      <header style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '4rem 2rem' }}>
        <div className="animate-fade-in-up" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <Link href="/blogs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', marginBottom: '2rem', fontSize: '0.9rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Devotionals
            </Link>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {churchName}
                </span>
            </div>

            <h1 style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-1px', marginBottom: '2rem' }}>
                {blog.title}
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem' }}>
                    {blog.author.charAt(0).toUpperCase()}
                </div>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{blog.author}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(blog.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                </div>
            </div>
        </div>
      </header>

      {/* Reading Content */}
      <main className="animate-fade-in-up delay-200" style={{ padding: '4rem 2rem 8rem 2rem' }}>
        <div style={{ maxWidth: '750px', margin: '0 auto' }}>
            <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{blog.content}</ReactMarkdown>
            </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .markdown-content {
            color: #374151;
            line-height: 1.9;
            font-size: 1.15rem;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            margin-top: 2em;
            margin-bottom: 0.8em;
            font-weight: 800;
            color: #111827;
            line-height: 1.3;
            letter-spacing: -0.5px;
        }
        .markdown-content h1 { font-size: 2.2rem; }
        .markdown-content h2 { font-size: 1.8rem; }
        .markdown-content h3 { font-size: 1.4rem; }
        .markdown-content p { margin-bottom: 1.5em; }
        .markdown-content ul, .markdown-content ol { padding-left: 1.5em; margin-bottom: 1.5em; }
        .markdown-content li { margin-bottom: 0.5em; }
        .markdown-content blockquote {
            border-left: 4px solid var(--primary);
            padding: 0.5rem 0 0.5rem 1.5rem;
            margin: 2rem 0;
            color: #4B5563;
            font-size: 1.25rem;
            font-style: italic;
            background: rgba(124, 58, 237, 0.03);
            border-radius: 0 8px 8px 0;
        }
        .markdown-content a {
            color: var(--primary);
            text-decoration: underline;
            text-underline-offset: 4px;
            font-weight: 500;
        }
        .markdown-content strong { font-weight: 700; color: #111827; }
        .markdown-content hr {
            border: 0;
            height: 1px;
            background: var(--border);
            margin: 3rem 0;
        }
      `}} />
    </article>
  );
}
