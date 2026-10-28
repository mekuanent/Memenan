"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function Navbar() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut(auth);
    window.location.href = '/login';
  };

  const isAdmin = profile?.globalRole === 'Super Admin';
  const isChurchAdmin = profile?.churches?.some((c: any) => c.role === 'Church Admin' || c.role === 'Admin');
  const isClergy = profile?.churches?.some((c: any) => c.role === 'Father' || c.role === 'Deacon');
  const { language, setLanguage, t } = useLanguage();

  return (
    <nav style={{ 
      position: 'sticky', top: 0, left: 0, right: 0, zIndex: 50,
      padding: '1rem 2rem', 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
        <Link href="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '8px', boxShadow: '0 0 10px rgba(124, 58, 237, 0.3)' }}></div>
          Memenan
        </Link>
        
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link href="/" style={{ color: pathname === '/' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_home')}</Link>
          <Link href="/churches" style={{ color: pathname === '/churches' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_churches')}</Link>
          <Link href="/announcements" style={{ color: pathname === '/announcements' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_news')}</Link>
          <Link href="/sermons" style={{ color: pathname === '/sermons' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_sermons')}</Link>
          <Link href="/blogs" style={{ color: pathname === '/blogs' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_blogs')}</Link>
          <Link href="/volunteers" style={{ color: pathname === '/volunteers' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_schedules')}</Link>
          {user && (
            <Link href="/calendar" style={{ color: pathname === '/calendar' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_calendar')}</Link>
          )}
          <Link href="/give" style={{ color: pathname === '/give' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_give')}</Link>
          <Link href="/lyrics" style={{ color: pathname === '/lyrics' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_lyrics')}</Link>
          
          {isAdmin && (
            <Link href="/admin" style={{ color: pathname === '/admin' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_super_admin')}</Link>
          )}
          {(isClergy || isChurchAdmin) && (
            <Link href="/dashboard/office-hours" style={{ color: pathname === '/dashboard/office-hours' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_office_hours')}</Link>
          )}
          {isChurchAdmin && !isAdmin && (
            <Link href="/dashboard" style={{ color: pathname === '/dashboard' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.2s ease' }}>{t('nav_church_console')}</Link>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        {/* Language Switcher */}
        <div style={{ display: 'flex', background: 'var(--background)', borderRadius: '999px', padding: '0.2rem', border: '1px solid var(--border)', marginRight: '0.5rem' }}>
          <button 
            onClick={() => setLanguage('en')}
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '999px', border: 'none', cursor: 'pointer', background: language === 'en' ? 'var(--primary)' : 'transparent', color: language === 'en' ? 'white' : 'var(--text-secondary)', transition: '0.2s ease' }}
          >
            En
          </button>
          <button 
            onClick={() => setLanguage('am')}
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '999px', border: 'none', cursor: 'pointer', background: language === 'am' ? 'var(--primary)' : 'transparent', color: language === 'am' ? 'white' : 'var(--text-secondary)', transition: '0.2s ease' }}
          >
            አማ
          </button>
        </div>

        {!loading && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/profile" style={{ color: pathname === '/profile' ? 'var(--primary)' : 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: '0.3s ease' }}>{t('nav_my_account')}</Link>
            <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.4rem 1rem', borderRadius: '999px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>{t('nav_sign_out')}</button>
          </div>
        ) : !loading && !user ? (
          <>
            <Link href="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}>{t('nav_login')}</Link>
            <Link href="/signup" className="btn-secondary" style={{ padding: '0.4rem 1.25rem', fontSize: '0.9rem' }}>{t('nav_sign_up')}</Link>
          </>
        ) : (
          <div style={{ width: '20px', height: '20px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        )}
      </div>
    </nav>
  );
}
