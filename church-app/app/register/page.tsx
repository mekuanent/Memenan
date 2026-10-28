"use client";

import React, { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import defaultServicesData from '@/lib/data/church-services.json';

export interface ChurchServiceItem {
  id: string;
  name: string;
  name_am?: string;
  enabled: boolean;
  instructions: string;
  instructions_am?: string;
  isCustom?: boolean;
}

export default function RegisterChurch() {
  const router = useRouter();
  const { language } = useLanguage();

  const [formData, setFormData] = useState({
    churchName: '',
    taxId: '',
    adminName: '',
    email: '',
    password: '',
  });

  const [services, setServices] = useState<ChurchServiceItem[]>(() =>
    (defaultServicesData as any[]).map(s => ({
      id: s.id,
      name: s.name,
      name_am: s.name_am,
      enabled: Boolean(s.defaultEnabled),
      instructions: s.defaultInstructions || '',
      instructions_am: s.defaultInstructions_am || '',
      isCustom: false,
    }))
  );

  const [expandedServiceId, setExpandedServiceId] = useState<string | null>('eucharist');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceInstructions, setCustomServiceInstructions] = useState('');
  const [showCustomServiceForm, setShowCustomServiceForm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleService = (id: string) => {
    setServices(prev =>
      prev.map(s => {
        if (s.id !== id) return s;
        const nextEnabled = !s.enabled;
        if (nextEnabled) setExpandedServiceId(id);
        return { ...s, enabled: nextEnabled };
      })
    );
  };

  const updateServiceInstruction = (id: string, field: 'instructions' | 'instructions_am', value: string) => {
    setServices(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleAddCustomService = () => {
    if (!customServiceName.trim()) return;
    const newId = `custom-${Date.now()}`;
    const newService: ChurchServiceItem = {
      id: newId,
      name: customServiceName.trim(),
      enabled: true,
      instructions: customServiceInstructions.trim() || 'Contact the church office for details on how to partake.',
      isCustom: true,
    };
    setServices(prev => [...prev, newService]);
    setCustomServiceName('');
    setCustomServiceInstructions('');
    setShowCustomServiceForm(false);
    setExpandedServiceId(newId);
  };

  const removeCustomService = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!auth) throw new Error("Firebase Auth is not properly initialized. Check your variables.");

      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: formData.adminName }).catch(console.error);

      const enabledServices = services.filter(s => s.enabled);

      const churchRef = await addDoc(collection(db, 'churches'), {
        name: formData.churchName,
        taxId: formData.taxId,
        approvalStatus: 'Pending',
        stripeAccountId: null,
        services: enabledServices,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'users', user.uid), {
        name: formData.adminName,
        email: formData.email,
        churches: [
          { churchId: churchRef.id, role: 'Church Admin' },
        ],
      });

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 1.5rem' }}>
        {success ? (
          <div className="glass-card animate-fade-in-up" style={{ padding: '3rem', textAlign: 'center', maxWidth: '520px' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '1rem' }}>Application Submitted</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
              Thank you for registering <strong style={{ color: 'var(--text-primary)' }}>{formData.churchName}</strong>! Your church profile and sacrament/service instructions have been saved. You can update them anytime from your Church Console.
            </p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary" style={{ width: '100%' }}>
              Go to My Church Dashboard
            </button>
          </div>
        ) : (
          <div className="glass-card animate-fade-in-up" style={{ padding: '3rem', width: '100%', maxWidth: '760px' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
              <h1 style={{ fontSize: '2.25rem', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '0.5rem' }}>
                {language === 'am' ? 'ቤተክርስቲያንዎን ይመዝግቡ' : 'Register Your Church'}
              </h1>
              <p style={{ color: 'var(--text-secondary)' }}>
                {language === 'am'
                  ? 'የቤተክርስቲያንዎን መረጃ እና የሚሰጡ መንፈሳዊ አገልግሎቶችን (ቅዱስ ቁርባን፣ ጥምቀት ወዘተ) ያስገቡ።'
                  : 'Set up your church profile and specify the sacraments & services you offer with instructions on how to partake.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {error && (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}

              {/* Section 1: Basic Church & Admin Info */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                  1. Church & Administrator Details
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label htmlFor="churchName">Church Name</label>
                    <input required type="text" id="churchName" name="churchName" value={formData.churchName} onChange={handleChange} className="input-field" placeholder="e.g. St. Mary Ethiopian Orthodox Church" />
                  </div>

                  <div className="input-group">
                    <label htmlFor="taxId">Tax ID (EIN)</label>
                    <input required type="text" id="taxId" name="taxId" value={formData.taxId} onChange={handleChange} className="input-field" placeholder="XX-XXXXXXX" />
                  </div>

                  <div className="input-group">
                    <label htmlFor="adminName">Primary Admin Name</label>
                    <input required type="text" id="adminName" name="adminName" value={formData.adminName} onChange={handleChange} className="input-field" placeholder="Full Name" />
                  </div>

                  <div className="input-group">
                    <label htmlFor="email">Admin Email</label>
                    <input required type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="admin@church.org" />
                  </div>
                </div>

                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="password">Secure Password</label>
                  <input required type="password" id="password" name="password" value={formData.password} onChange={handleChange} className="input-field" placeholder="••••••••" />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    2. Sacraments & Services Offered
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCustomServiceForm(!showCustomServiceForm)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    + Add Custom Service
                  </button>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                  Select the services your church provides and customize the instructions on how members and visitors should prepare to partake (e.g., fasting hours for Eucharist, godparent & registration requirements for Infant or Adult Baptism).
                </p>

                {showCustomServiceForm && (
                  <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="input-group">
                      <label>Custom Service Name</label>
                      <input
                        type="text"
                        className="input-field"
                        value={customServiceName}
                        onChange={e => setCustomServiceName(e.target.value)}
                        placeholder="e.g. House Blessing / Holy Unction"
                      />
                    </div>
                    <div className="input-group">
                      <label>Instructions on How to Partake</label>
                      <textarea
                        className="input-field"
                        rows={3}
                        value={customServiceInstructions}
                        onChange={e => setCustomServiceInstructions(e.target.value)}
                        placeholder="Step-by-step preparation, requirements, and contact instructions..."
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={handleAddCustomService} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                        Add Service
                      </button>
                      <button type="button" onClick={() => setShowCustomServiceForm(false)} className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {services.map(service => {
                    const isExpanded = expandedServiceId === service.id;
                    return (
                      <div
                        key={service.id}
                        style={{
                          borderRadius: '12px',
                          border: service.enabled ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                          background: service.enabled ? 'rgba(124, 58, 237, 0.03)' : 'var(--surface)',
                          padding: '1rem 1.15rem',
                          transition: '0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={service.enabled}
                              onChange={() => toggleService(service.id)}
                              style={{ width: '17px', height: '17px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <span>
                              {service.name}
                              {service.name_am ? <span style={{ color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '0.4rem', fontSize: '0.85rem' }}>({service.name_am})</span> : null}
                            </span>
                          </label>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {service.enabled && (
                              <button
                                type="button"
                                onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                {isExpanded ? 'Hide Instructions ▲' : 'Edit Instructions ▼'}
                              </button>
                            )}
                            {service.isCustom && (
                              <button
                                type="button"
                                onClick={() => removeCustomService(service.id)}
                                style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {service.enabled && isExpanded && (
                          <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="input-group">
                              <label style={{ fontSize: '0.8rem' }}>Instructions on How to Partake (English)</label>
                              <textarea
                                className="input-field"
                                rows={3}
                                value={service.instructions}
                                onChange={e => updateServiceInstruction(service.id, 'instructions', e.target.value)}
                                placeholder="Describe preparation steps, fasting requirements, or who to contact..."
                                style={{ fontSize: '0.85rem', lineHeight: 1.5 }}
                              />
                            </div>
                            {service.instructions_am !== undefined && (
                              <div className="input-group">
                                <label style={{ fontSize: '0.8rem' }}>መመሪያ (Amharic Instructions — Optional)</label>
                                <textarea
                                  className="input-field"
                                  rows={3}
                                  value={service.instructions_am || ''}
                                  onChange={e => updateServiceInstruction(service.id, 'instructions_am', e.target.value)}
                                  placeholder="በአማርኛ የሚሰጥ መመሪያ..."
                                  style={{ fontSize: '0.85rem', lineHeight: 1.5 }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.9rem' }}>
                {loading ? 'Processing...' : 'Register Church & Save Services'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
