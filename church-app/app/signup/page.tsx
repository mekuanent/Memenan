"use client";

import React, { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function MemberSignUp() {
  const { user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = '/profile';
    }
  }, [user, authLoading]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const newUser = userCredential.user;
      await updateProfile(newUser, { displayName: formData.name }).catch(console.error);

      // Create a standard member profile
      await setDoc(doc(db, 'users', newUser.uid), {
        name: formData.name,
        email: formData.email,
        role: 'Member',
        createdAt: new Date().toISOString()
      });

      // Once complete, they are securely signed in and the profile will load.
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during sign up.');
      setLoading(false);
    }
  };

  if (authLoading || user) return null;

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem 2rem' }}>
        <div className="glass-card animate-fade-in-up" style={{ padding: '3rem', width: '100%', maxWidth: '450px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '0.5rem' }}>Create Account</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Welcome! Sign up to start connecting.</p>
          </div>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && <div style={{ color: '#DC2626', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '12px', fontSize: '0.875rem' }}>{error}</div>}
            
            <div className="input-group">
              <label>Full Name</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="John Doe" />
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <input required type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="john@example.com" />
            </div>
            
            <div className="input-group">
              <label>Password</label>
              <input required type="password" name="password" value={formData.password} onChange={handleChange} className="input-field" placeholder="••••••••" />
            </div>
            
            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '1rem', width: '100%' }}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Already have an account? <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Log In</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
