"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function SongDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [song, setSong] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // In Next.js 14 app directory params should be awaited if they are promises in some contexts,
  // but standard usage can extract them directly. React.use(params) is often required with newer Next versions.
  // Utilizing standard destructuring initially.
  const songId = params.id;

  useEffect(() => {
    const fetchSong = async () => {
      try {
        const docRef = doc(db, 'songs', songId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSong({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (songId) fetchSong();
  }, [songId]);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to permanently delete this song from the global bank?")) {
      try {
        await deleteDoc(doc(db, 'songs', songId));
        router.push('/lyrics');
      } catch (err) {
        console.error("Failed to delete song:", err);
        alert("Failed to delete the song. Check your database security permissions.");
      }
    }
  };

  if (loading) {
    return <div style={{ padding: '6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Lyrics...</div>;
  }

  if (!song) {
    return (
      <div style={{ padding: '6rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 600 }}>Song requested could not be located.</h2>
        <Link href="/lyrics" style={{ color: 'var(--primary)', marginTop: '1rem', display: 'inline-block', fontWeight: 600 }}>Return to Lyrics Bank</Link>
      </div>
    );
  }

  let verseCount = 0;
  const processedSections = song?.sections ? song.sections.map((sec: any) => {
    if (sec.type === 'Verse') {
      verseCount++;
      return { ...sec, displayType: `Verse ${verseCount}` };
    }
    return { ...sec, displayType: sec.type };
  }) : [];

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link href="/lyrics" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, transition: '0.2s' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7-7-7 7 7 7"/></svg>
          Back to Directory
        </Link>
        {user && (user.uid === song.contributorId || profile?.globalRole === 'Super Admin') && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={handleDelete} style={{ background: 'transparent', border: '1px solid #EF4444', color: '#EF4444', padding: '0.4rem 1.25rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', transition: '0.2sease' }}>
              Delete
            </button>
            <Link href={`/lyrics/${song.id}/edit`} className="btn-secondary" style={{ padding: '0.4rem 1.25rem', fontSize: '0.9rem' }}>
              Edit Song
            </Link>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', letterSpacing: '-1px', marginBottom: '0.5rem', color: 'var(--text-primary)', lineHeight: 1.1 }}>{song.title}</h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)' }}>By {song.author}</p>
        
        {song.tags && song.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            {song.tags.map((tag: string, i: number) => (
              <span key={i} style={{ background: 'white', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.4rem 1rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600 }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: '3.5rem', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}>
        {song.sections ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {processedSections.map((section: any, idx: number) => (
              <div key={idx}>
                <h4 style={{ color: 'var(--primary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {section.displayType}
                </h4>
                <p style={{ 
                  fontFamily: 'Outfit, "Noto Sans Ethiopic", sans-serif', 
                  fontSize: '1.2rem', 
                  lineHeight: 1.8, 
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <pre style={{ 
            fontFamily: 'Outfit, "Noto Sans Ethiopic", sans-serif', 
            fontSize: '1.2rem', 
            lineHeight: 1.8, 
            whiteSpace: 'pre-wrap',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            {song.lyrics}
          </pre>
        )}
      </div>
    </main>
  );
}
