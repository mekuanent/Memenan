"use client";

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function Login() {
  const { user, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user && profile !== undefined) {
      if (profile?.globalRole === 'Super Admin') {
        window.location.href = '/admin';
      } else if (profile?.churches && profile.churches.length > 0) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/profile';
      }
    }
  }, [user, profile, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success triggers the useEffect listener to handle redirection.
    } catch (err: any) {
      console.error("Login failed: ", err);
      // More descriptive error handling
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          setError('Incorrect email or password. Please try again.');
      } else {
          setError(err.message || 'Invalid credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || user) return null;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem 2rem' }}>
        <div className="glass-card animate-fade-in-up" style={{ padding: '3rem', width: '100%', maxWidth: '450px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ width: '48px', height: '48px', background: 'var(--primary)', borderRadius: '12px', margin: '0 auto 1.5rem' }}></div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '0.5rem' }}>Welcome Back</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Sign in to manage your church.</p>
          </div>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && <div style={{ color: '#DC2626', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '12px', fontSize: '0.875rem' }}>{error}</div>}
            
            <div className="input-group">
              <label>Email Address</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="admin@grace.community" />
            </div>
            
            <div className="input-group">
              <label>Password</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
            </div>
            
            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Don't have an account? <Link href="/signup" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Sign Up</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
