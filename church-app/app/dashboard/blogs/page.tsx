"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import dynamic from 'next/dynamic';
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css';
import TurndownService from 'turndown';
import { marked } from 'marked';
import Link from 'next/link';

export default function BlogsAdminPage() {
  const { profile, loading: authLoading } = useAuth();
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const churchId = profile?.churches?.[0]?.churchId;

  useEffect(() => {
    if (churchId) {
      loadBlogs(churchId);
      if (profile?.firstName && profile?.lastName) {
          setAuthor(`${profile.firstName} ${profile.lastName}`);
      }
    }
  }, [churchId, profile]);

  const loadBlogs = async (cid: string) => {
    try {
      // Removed orderBy to prevent composite index requirement crashes
      const q = query(collection(db, 'blogs'), where('churchId', '==', cid));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Sort client-side
      docs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setBlogs(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const modules = {
    toolbar: {
      container: '#custom-toolbar'
    }
  };
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!churchId) return alert('No church context found.');
    if (!content.trim() || !title.trim()) return alert('Title and content are required.');

    setSubmitting(true);
    try {
      const turndownService = new TurndownService();
      // Configure turndown to keep some HTML or just basic settings if needed
      turndownService.addRule('strikethrough', {
        filter: ['del', 's', 'strike'] as any,
        replacement: function (content) {
          return '~' + content + '~'
        }
      });
      const markdownContent = turndownService.turndown(content);

      if (editingId) {
        await updateDoc(doc(db, 'blogs', editingId), {
          title: title.trim(),
          author: author.trim() || 'Church Administration',
          content: markdownContent,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'blogs'), {
          churchId,
          title: title.trim(),
          author: author.trim() || 'Church Administration',
          content: markdownContent,
          createdAt: new Date().toISOString()
        });
      }
      
      setTitle('');
      setContent('');
      setEditingId(null);
      await loadBlogs(churchId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (blog: any) => {
    setEditingId(blog.id);
    setTitle(blog.title);
    setAuthor(blog.author);
    
    // Convert markdown back to HTML for Quill
    const htmlContent = await marked.parse(blog.content || '');
    setContent(htmlContent);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    if (profile?.firstName && profile?.lastName) {
        setAuthor(`${profile.firstName} ${profile.lastName}`);
    } else {
        setAuthor('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this devotional? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'blogs', id));
      setBlogs(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (authLoading || loading) return <div style={{ padding: '6rem', textAlign: 'center' }}>Loading Devotionals...</div>;

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
           Back to Console
        </Link>
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Devotionals & Articles</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '1.1rem' }}>Write deep-dive theological articles, devotionals, and pastoral letters.</p>
      </div>

      <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          {editingId ? 'Edit Devotional' : 'Compose New Entry'}
        </h2>
        
        <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div className="input-group" style={{ flex: 2 }}>
                <label>Article Title</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Navigating Seasons of Waiting" className="input-field" />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Author</label>
                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Pastor John Doe" className="input-field" />
              </div>
          </div>

          <div className="input-group">
            <label style={{ marginBottom: '0.5rem', display: 'block' }}>Content Body</label>
            
            <div id="custom-toolbar" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderBottom: 'none', padding: '0.5rem', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="ql-bold" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 'bold' }}>B</button>
                <button type="button" className="ql-italic" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontStyle: 'italic' }}>I</button>
                <button type="button" className="ql-underline" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', textDecoration: 'underline' }}>U</button>
                <button type="button" className="ql-strike" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', textDecoration: 'line-through' }}>S</button>
                <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.2rem' }}></div>
                <button type="button" className="ql-header" value="1" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 800 }}>H1</button>
                <button type="button" className="ql-header" value="2" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 700 }}>H2</button>
                <button type="button" className="ql-header" value="3" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 600 }}>H3</button>
                <div style={{ width: '1px', background: 'var(--border)', margin: '0 0.2rem' }}></div>
                <button type="button" className="ql-list" value="bullet" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer' }}>• List</button>
                <button type="button" className="ql-list" value="ordered" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer' }}>1. List</button>
                <button type="button" className="ql-blockquote" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer' }}>" Quote</button>
                <button type="button" className="ql-link" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer' }}>Link</button>
            </div>

            <div style={{ background: 'white', borderRadius: '0 0 8px 8px', border: '1px solid var(--border)', borderTop: 'none', overflow: 'hidden' }}>
                <ReactQuill 
                  theme="snow" 
                  modules={modules}
                  value={content} 
                  onChange={setContent} 
                  placeholder="Write your devotional here..."
                />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '1rem' }}>
            {editingId && (
                <button type="button" onClick={handleCancelEdit} disabled={submitting} className="btn-secondary" style={{ padding: '0.8rem 2rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
            )}
            <button disabled={submitting} type="submit" className="btn-primary" style={{ padding: '0.8rem 2rem' }}>
              {submitting ? (editingId ? 'Updating...' : 'Publishing...') : (editingId ? 'Update Devotional' : 'Publish Devotional')}
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Published Library</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {blogs.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No devotionals have been published yet.</p>
          </div>
        ) : (
          blogs.map(blog => (
            <div key={blog.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{blog.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  By {blog.author} • {new Date(blog.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link 
                  href={`/blogs/${blog.id}`} 
                  target="_blank"
                  style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="View Entry"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </Link>
                <button 
                  onClick={() => handleEdit(blog)}
                  style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                  title="Edit Entry"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button 
                  onClick={() => handleDelete(blog.id)}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                  title="Delete Entry"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"/></svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .ql-toolbar.ql-snow {
            border: none;
            padding: 0;
            display: none; /* Hide default toolbar styles generated by Quill */
        }
        #custom-toolbar.ql-toolbar {
            display: flex !important;
        }
        .ql-container {
            font-size: 1.05rem;
            font-family: inherit;
            border: none !important;
        }
        .ql-editor {
            min-height: 300px;
        }
        .ql-editor.ql-blank::before {
            font-style: italic;
            color: var(--text-secondary);
        }
      `}} />
    </main>
  );
}
