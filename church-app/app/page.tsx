"use client";

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  return (
    <div style={{ overflowX: 'hidden' }}>
      <main style={{ padding: '6rem 2rem 5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 72px)', maxWidth: '1200px', margin: '0 auto' }}>
        
        <section style={{ textAlign: 'center', maxWidth: '800px' }} className="animate-fade-in-up">
          <div style={{ 
            display: 'inline-flex', padding: '0.5rem 1rem', background: 'rgba(124, 58, 237, 0.1)', 
            border: '1px solid rgba(124, 58, 237, 0.2)', borderRadius: '999px',
            color: 'var(--primary)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '2rem'
          }}>
            ✨ A Modern Platform for Modern Ministries
          </div>
          
          <h1 style={{ fontSize: '4.5rem', fontWeight: '800', lineHeight: 1.1, letterSpacing: '-2px', marginBottom: '1.5rem', background: 'linear-gradient(to right, #0F172A, #475569)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Transform How Your Church Connects
          </h1>
          
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem' }}>
            A comprehensive, beautifully simple platform featuring global lyric banks, automated tithing, and community event management designed for the modern web.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link href="/register" className="btn-primary">
              Register Your Church
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
            </Link>
            <a href="#features" className="btn-secondary">
              Explore Features
            </a>
          </div>
        </section>

        <div className="animate-fade-in-up delay-200" style={{ 
          marginTop: '5rem', width: '100%', maxWidth: '1000px', height: '400px', 
          background: 'white',
          border: '1px solid var(--border)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
          borderBottom: 'none', position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.5rem', background: '#F8FAFC' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EF4444' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#F59E0B' }}></div>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10B981' }}></div>
          </div>
          <div style={{ flex: 1, padding: '2rem', display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem', opacity: 0.8 }}>
            <div style={{ background: '#F1F5F9', borderRadius: '12px' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ height: '100px', background: '#F1F5F9', borderRadius: '12px' }}></div>
               <div style={{ flex: 1, background: '#F1F5F9', borderRadius: '12px' }}></div>
            </div>
          </div>
          
          <div style={{ 
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', 
            background: 'linear-gradient(to top, white 0%, transparent 100%)' 
          }}></div>
        </div>

      </main>
    </div>
  );
}
