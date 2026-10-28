"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface LyricSection {
  type: string;
  content: string;
}

export default function EditSong({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    tags: '',
  });

  const [sections, setSections] = useState<LyricSection[]>([]);
  const SECTION_TYPES = ['Verse', 'Chorus', 'Pre-Chorus', 'Bridge', 'Intro', 'Outro'];

  const songId = params.id;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const docRef = doc(db, 'songs', songId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (user?.uid !== data.contributorId && profile?.globalRole !== 'Super Admin') {
              router.push('/lyrics');
              return;
          }
          setFormData({
            title: data.title || '',
            author: data.author || '',
            tags: data.tags ? data.tags.join(', ') : '',
          });
          setSections(data.sections || [{ type: 'Verse', content: data.lyrics || '' }]);
        } else {
            router.push('/lyrics');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPageLoading(false);
      }
    };
    if (!authLoading && user && songId) fetchSong();
  }, [songId, authLoading, user, profile, router]);

  const handleSectionTypeChange = (index: number, newType: string) => {
    const updated = [...sections];
    updated[index].type = newType;
    setSections(updated);
  };

  const handleSectionContentChange = (index: number, newContent: string) => {
    const updated = [...sections];
    updated[index].content = newContent;
    setSections(updated);
  };

  const addSection = () => {
    setSections([...sections, { type: 'Chorus', content: '' }]);
  };

  const removeSection = (index: number) => {
    const updated = [...sections];
    updated.splice(index, 1);
    setSections(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (sections.length === 0 || sections.some(s => s.content.trim() === '')) {
      setError("Please ensure all added verse blocks have lyrics.");
      setLoading(false);
      return;
    }

    try {
      const tagArray = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      const docRef = doc(db, 'songs', songId);
      await updateDoc(docRef, {
        title: formData.title,
        author: formData.author,
        tags: tagArray,
        sections: sections,
        updatedAt: new Date().toISOString()
      });

      router.push(`/lyrics/${songId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update song.');
      setLoading(false);
    }
  };

  if (authLoading || !user || pageLoading) {
    return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Editor...</div>;
  }

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Edit Song</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Modify structured formatting perfectly.</p>
      </div>

      <div className="glass-card" style={{ padding: '3rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && <div style={{ color: '#DC2626', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '12px' }}>{error}</div>}
          
          <div className="input-group">
            <label>Song Title</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="input-field" placeholder="Amazing Grace" />
          </div>

          <div className="input-group">
            <label>Author / Composer</label>
            <input required type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="input-field" placeholder="John Newton" />
          </div>

          <div className="input-group">
            <label>Tags (Comma Separated)</label>
            <input type="text" value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} className="input-field" placeholder="Worship, Traditional, Hymn" />
          </div>

          <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <label style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'block' }}>Song Structure Elements</label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {sections.map((section, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.5)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 1 }}>
                      {SECTION_TYPES.map(t => (
                        <button 
                          type="button" 
                          key={t}
                          onClick={() => handleSectionTypeChange(index, t)}
                          style={{
                            padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: '0.2s', border: '1px solid',
                            backgroundColor: section.type === t ? 'var(--primary)' : 'white',
                            color: section.type === t ? 'white' : 'var(--text-secondary)',
                            borderColor: section.type === t ? 'var(--primary)' : 'var(--border)'
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {sections.length > 1 && (
                      <button type="button" onClick={() => removeSection(index)} style={{ color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '0.2rem', marginLeft: '1rem' }}>
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea 
                    required 
                    value={section.content} 
                    onChange={e => handleSectionContentChange(index, e.target.value)} 
                    className="input-field" 
                    placeholder={`Enter the lyrics for this ${section.type}...`} 
                    style={{ minHeight: '100px', resize: 'vertical', lineHeight: '1.6' }} 
                  />
                </div>
              ))}
            </div>

            <button type="button" onClick={addSection} className="btn-secondary" style={{ marginTop: '1.5rem', width: '100%', borderStyle: 'dashed' }}>
              + Add Song Section
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading ? 'Updating...' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
