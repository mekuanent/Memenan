"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import defaultServicesData from '@/lib/data/church-services.json';
import type { ChurchServiceItem } from '@/app/register/page';

export default function DashboardChurchServices() {
  const { user, profile, loading: authLoading } = useAuth();
  const [churchId, setChurchId] = useState<string | null>(null);
  const [churchName, setChurchName] = useState<string>('');
  const [services, setServices] = useState<ChurchServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  const [customName, setCustomName] = useState('');
  const [customNameAm, setCustomNameAm] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customInstructionsAm, setCustomInstructionsAm] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) window.location.href = '/login';
  }, [user, authLoading]);

  useEffect(() => {
    const init = async () => {
      const adminRole = profile?.churches?.find(
        (c: any) => c.role === 'Church Admin' || c.role === 'Admin'
      );
      if (!adminRole) {
        setLoading(false);
        return;
      }
      setChurchId(adminRole.churchId);

      const snap = await getDoc(doc(db, 'churches', adminRole.churchId));
      if (snap.exists()) {
        const data = snap.data();
        setChurchName(data.name || '');
        const existingServices: ChurchServiceItem[] = data.services || [];
        const existingMap = new Map(existingServices.map(s => [s.id, s]));

        // Merge defaults with saved church services
        const merged: ChurchServiceItem[] = (defaultServicesData as any[]).map(def => {
          const saved = existingMap.get(def.id);
          if (saved) {
            existingMap.delete(def.id);
            return { ...saved, enabled: true };
          }
          return {
            id: def.id,
            name: def.name,
            name_am: def.name_am,
            enabled: existingServices.length === 0 ? Boolean(def.defaultEnabled) : false,
            instructions: def.defaultInstructions || '',
            instructions_am: def.defaultInstructions_am || '',
            isCustom: false,
          };
        });

        // Append any custom services saved by this church
        existingMap.forEach(customSvc => {
          merged.push({ ...customSvc, enabled: true, isCustom: true });
        });

        setServices(merged);
      }
      setLoading(false);
    };
    if (profile) init();
  }, [profile]);

  const toggleService = (id: string) => {
    setServices(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    setSavedBanner(false);
  };

  const updateInstruction = (
    id: string,
    field: 'instructions' | 'instructions_am',
    val: string
  ) => {
    setServices(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: val } : s))
    );
    setSavedBanner(false);
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const newItem: ChurchServiceItem = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      name_am: customNameAm.trim() || undefined,
      enabled: true,
      instructions: customInstructions.trim() || 'Contact the church office for preparation instructions.',
      instructions_am: customInstructionsAm.trim() || '',
      isCustom: true,
    };
    setServices(prev => [...prev, newItem]);
    setCustomName('');
    setCustomNameAm('');
    setCustomInstructions('');
    setCustomInstructionsAm('');
    setShowAddCustom(false);
    setSavedBanner(false);
  };

  const handleRemoveCustom = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
    setSavedBanner(false);
  };

  const handleSaveAll = async () => {
    if (!churchId) return;
    setSaving(true);
    setSavedBanner(false);
    try {
      const enabledServices = services.filter(s => s.enabled);
      await updateDoc(doc(db, 'churches', churchId), {
        services: enabledServices,
      });
      setSavedBanner(true);
    } catch (err) {
      console.error(err);
      alert('Failed to save church services.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading services...</div>;
  }

  if (!churchId) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>Admin access required.</div>;
  }

  return (
    <main className="animate-fade-in-up" style={{ padding: '3.5rem 2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.4rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back to Church Console
          </Link>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Sacraments & Church Services
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Configure the sacraments and services offered at <strong>{churchName}</strong> and how members should prepare to partake.
          </p>
        </div>

        <button onClick={handleSaveAll} disabled={saving} className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {savedBanner && (
        <div style={{ padding: '0.9rem 1.25rem', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px', fontWeight: 600, marginBottom: '1.5rem' }}>
          ✓ Church services and partaking instructions saved! Members can now view them in the Church Directory.
        </div>
      )}

      {/* Add Custom Service */}
      <div className="glass-card" style={{ padding: '1.35rem 1.5rem', marginBottom: '1.5rem' }}>
        {!showAddCustom ? (
          <button
            onClick={() => setShowAddCustom(true)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Custom Sacrament or Service
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label>Service Name (English)</label>
                <input className="input-field" type="text" value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. House Blessing / Holy Unction" />
              </div>
              <div className="input-group">
                <label>Service Name (Amharic — Optional)</label>
                <input className="input-field" type="text" value={customNameAm} onChange={e => setCustomNameAm(e.target.value)} placeholder="ምሳሌ፦ ቀንዲል እና ጸበል" />
              </div>
            </div>
            <div className="input-group">
              <label>Instructions on How to Partake (English)</label>
              <textarea className="input-field" rows={3} value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} placeholder="Step-by-step instructions on how to prepare, register, and partake..." />
            </div>
            <div className="input-group">
              <label>መመሪያ (Amharic Instructions — Optional)</label>
              <textarea className="input-field" rows={3} value={customInstructionsAm} onChange={e => setCustomInstructionsAm(e.target.value)} placeholder="በአማርኛ የሚሰጥ መመሪያ..." />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleAddCustom} className="btn-primary" style={{ padding: '0.55rem 1.25rem' }}>Add to List</button>
              <button onClick={() => setShowAddCustom(false)} className="btn-secondary" style={{ padding: '0.55rem 1rem' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Services List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {services.map(service => (
          <div
            key={service.id}
            className="glass-card"
            style={{
              padding: '1.5rem',
              borderLeft: service.enabled ? '4px solid var(--primary)' : '4px solid var(--border)',
              opacity: service.enabled ? 1 : 0.65,
              transition: '0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: service.enabled ? '1rem' : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>
                <input
                  type="checkbox"
                  checked={service.enabled}
                  onChange={() => toggleService(service.id)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span>
                  {service.name}
                  {service.name_am && (
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.95rem', marginLeft: '0.5rem' }}>
                      ({service.name_am})
                    </span>
                  )}
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: service.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.06)', color: service.enabled ? '#059669' : 'var(--text-secondary)' }}>
                  {service.enabled ? 'Offered' : 'Not Offered'}
                </span>
                {service.isCustom && (
                  <button
                    onClick={() => handleRemoveCustom(service.id)}
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#DC2626', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {service.enabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border)' }}>
                <div className="input-group">
                  <label style={{ fontSize: '0.82rem' }}>Instructions on How to Partake (English)</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={service.instructions}
                    onChange={e => updateInstruction(service.id, 'instructions', e.target.value)}
                    style={{ fontSize: '0.88rem', lineHeight: 1.5 }}
                  />
                </div>
                <div className="input-group">
                  <label style={{ fontSize: '0.82rem' }}>መመሪያ (Amharic Instructions)</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={service.instructions_am || ''}
                    onChange={e => updateInstruction(service.id, 'instructions_am', e.target.value)}
                    style={{ fontSize: '0.88rem', lineHeight: 1.5 }}
                    placeholder="በአማርኛ የሚሰጥ መመሪያ..."
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
