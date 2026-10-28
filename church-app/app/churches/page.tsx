"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import defaultServicesData from '@/lib/data/church-services.json';
import type { ChurchServiceItem } from '@/app/register/page';

const FALLBACK_SERVICES: ChurchServiceItem[] = (defaultServicesData as any[])
  .filter(s => s.defaultEnabled)
  .map(s => ({
    id: s.id,
    name: s.name,
    name_am: s.name_am,
    enabled: true,
    instructions: s.defaultInstructions || '',
    instructions_am: s.defaultInstructions_am || '',
  }));

export default function ChurchDirectory() {
  const { user, profile } = useAuth();
  const { language } = useLanguage();
  const [churches, setChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [selectedChurchForServices, setSelectedChurchForServices] = useState<any | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);

  useEffect(() => {
    const fetchChurches = async () => {
      try {
        const q = query(collection(db, 'churches'));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setChurches(docs.filter((c: any) => c.approvalStatus === 'Approved'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchChurches();
  }, []);

  const handleJoinChurch = async (churchId: string) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setJoinLoading(churchId);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        churches: arrayUnion({ churchId, role: 'Member' })
      }, { merge: true });
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        alert('Failed to join church. Please check your Firestore security rules.');
      } else {
        alert('Failed to join the network. Please try again.');
      }
      setJoinLoading(null);
    }
  };

  const isMemberOf = (churchId: string) => {
    if (!profile?.churches) return false;
    return profile.churches.some((c: any) => c.churchId === churchId);
  };

  const getChurchServices = (church: any): ChurchServiceItem[] => {
    if (Array.isArray(church.services) && church.services.length > 0) {
      return church.services.filter((s: ChurchServiceItem) => s.enabled !== false);
    }
    return FALLBACK_SERVICES;
  };

  const openServicesModal = (church: any, initialServiceId?: string) => {
    const svcs = getChurchServices(church);
    setSelectedChurchForServices(church);
    setActiveServiceId(initialServiceId || svcs[0]?.id || null);
  };

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>
            {language === 'am' ? 'አብያተ ክርስቲያናት እና አገልግሎቶች' : 'Global Church Network'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {language === 'am'
              ? 'አብያተ ክርስቲያናትን ይቀላቀሉ፤ የሚሰጡ መንፈሳዊ አገልግሎቶችን እና የአፈጻጸም መመሪያዎችን ይመልከቱ።'
              : 'Discover active congregations, join your parish, and view sacraments & instructions on how to partake.'}
          </p>
        </div>
      </div>

      <section>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading directory...</div>
        ) : churches.length === 0 ? (
          <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No approved network churches found locally yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {churches.map((church, i) => {
              const svcs = getChurchServices(church);

              return (
                <div key={church.id} className={`glass-card animate-fade-in-up delay-${(i % 3) * 100}`} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>{church.name}</h3>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '999px', background: church.taxId ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: church.taxId ? '#059669' : '#D97706' }}>
                        {church.taxId ? 'Verified' : 'Pending'}
                      </span>
                    </div>

                    {/* Services & Sacraments Pills */}
                    <div style={{ marginTop: '1.1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                        {language === 'am' ? 'የሚሰጡ አገልግሎቶች' : 'Sacraments & Services Offered'}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {svcs.map(svc => (
                          <button
                            key={svc.id}
                            onClick={() => openServicesModal(church, svc.id)}
                            title="Click to view instructions on how to partake"
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.65rem',
                              borderRadius: '999px',
                              border: '1px solid rgba(124, 58, 237, 0.25)',
                              background: 'rgba(124, 58, 237, 0.06)',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              transition: '0.15s',
                            }}
                          >
                            ✝ {language === 'am' && svc.name_am ? svc.name_am : svc.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => openServicesModal(church)}
                      className="btn-secondary"
                      style={{ width: '100%', padding: '0.65rem 1rem', fontSize: '0.86rem', fontWeight: 600 }}
                    >
                      📖 {language === 'am' ? 'የአገልግሎት መመሪያዎችን ይመልከቱ' : 'How to Partake (Instructions)'}
                    </button>

                    {isMemberOf(church.id) ? (
                      <div style={{ padding: '0.75rem 1rem', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', borderRadius: '8px', textAlign: 'center', fontWeight: 600, border: '1px solid rgba(124,58,237,0.2)', fontSize: '0.9rem' }}>
                        ✓ {language === 'am' ? 'አባል ነዎት' : 'Member'}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleJoinChurch(church.id)}
                        disabled={joinLoading === church.id}
                        className="btn-primary"
                        style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.9rem' }}
                      >
                        {joinLoading === church.id ? 'Joining...' : language === 'am' ? 'ቤተክርስቲያን ይቀላቀሉ' : 'Join Church'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Services & Instructions Modal ── */}
      {selectedChurchForServices && (() => {
        const svcs = getChurchServices(selectedChurchForServices);
        const currentSvc = svcs.find(s => s.id === activeServiceId) || svcs[0];

        return (
          <div
            onClick={() => setSelectedChurchForServices(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="glass-card animate-fade-in-up"
              style={{
                width: '100%',
                maxWidth: '680px',
                maxHeight: '85vh',
                overflowY: 'auto',
                padding: '2rem',
                background: '#fff',
                borderRadius: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {selectedChurchForServices.name}
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.2rem' }}>
                    {language === 'am' ? 'መንፈሳዊ አገልግሎቶች እና መመሪያዎች' : 'Sacraments & How to Partake'}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedChurchForServices(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {/* Service Selector Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                {svcs.map(svc => {
                  const isActive = currentSvc?.id === svc.id;
                  return (
                    <button
                      key={svc.id}
                      onClick={() => setActiveServiceId(svc.id)}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '999px',
                        border: isActive ? 'none' : '1px solid var(--border)',
                        background: isActive ? 'var(--primary)' : '#F8FAFC',
                        color: isActive ? '#fff' : 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      ✝ {language === 'am' && svc.name_am ? svc.name_am : svc.name}
                    </button>
                  );
                })}
              </div>

              {currentSvc && (
                <div style={{ background: '#F8FAFC', padding: '1.5rem', borderRadius: '14px', border: '1px solid var(--border)', borderLeft: '4px solid var(--primary)' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                    {language === 'am' && currentSvc.name_am ? currentSvc.name_am : currentSvc.name}
                  </h3>
                  {language === 'en' && currentSvc.name_am && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      {currentSvc.name_am}
                    </div>
                  )}

                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                    {language === 'am' ? 'እንዴት መሳተፍ እንደሚቻል (መመሪያ)፦' : 'Instructions on How to Prepare & Partake:'}
                  </div>
                  <div style={{ whiteSpace: 'pre-line', lineHeight: 1.75, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {language === 'am' && currentSvc.instructions_am
                      ? currentSvc.instructions_am
                      : currentSvc.instructions || 'Please contact the church office or schedule an appointment during Clergy Office Hours for guidance.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
