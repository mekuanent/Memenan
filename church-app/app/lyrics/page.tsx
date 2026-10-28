"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LyricsBank() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const q = query(collection(db, 'songs'), orderBy('title'), limit(100));
        const snapshot = await getDocs(q);
        setSongs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching songs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  const filteredSongs = songs.filter(song => 
    song.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    song.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    song.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Global Lyrics Bank</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>A shared directory of religious songs powered by the community.</p>
        </div>
        {user ? (
          <Link href="/lyrics/new" className="btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
            Contribute Song
          </Link>
        ) : (
          <Link href="/login" className="btn-secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}>
            Login to Contribute
          </Link>
        )}
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <input 
          type="text" 
          placeholder="Search by title, author, or tags..." 
          className="input-field"
          style={{ maxWidth: '400px', border: '1px solid var(--primary)', boxShadow: '0 0 10px rgba(124,58,237,0.1)' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <section>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading catalog...</div>
        ) : filteredSongs.length === 0 && searchTerm === '' ? (
          <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
            <div style={{ width: '48px', height: '48px', color: 'var(--text-secondary)', margin: '0 auto 1rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            </div>
             <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No songs found in the bank. Be the first to contribute!</p>
          </div>
        ) : filteredSongs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No songs match your search query.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredSongs.map((song, i) => (
              <Link href={`/lyrics/${song.id}`} key={song.id} style={{ textDecoration: 'none' }}>
                <div className={`glass-card animate-fade-in-up delay-${(i % 3) * 100}`} style={{ padding: '1.5rem', transition: 'transform 0.2s ease', cursor: 'pointer' }} 
                     onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                     onMouseOut={e => e.currentTarget.style.transform = 'none'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{song.title}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{song.author}</p>
                    </div>
                    {song.tags && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {song.tags.map((tag: string, idx: number) => (
                          <span key={idx} style={{ background: '#F1F5F9', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
