"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import {
  getEthiopianHolidays,
  getGregorianHolidays,
  getEthiopianFastSummaries,
  formatEthiopianLabel,
  Holiday,
  FastSummary,
} from '@/lib/ethiopianCalendar';

type CalendarType = 'ethiopian' | 'gregorian';

interface CustomHoliday {
  id: string;
  name: string;
  date: string;
  endDate?: string;
  type?: 'holiday' | 'fasting';
  ethiopianDate?: string;
  isCustom: boolean;
  hidden: boolean;
}

interface ChurchCalendar {
  churchId: string;
  calendarType: CalendarType;
  customHolidays: CustomHoliday[];
  hiddenDefaults: string[];
  hiddenFasts?: string[];
}

export default function DashboardCalendar() {
  const { user, profile, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const [churchId, setChurchId] = useState<string | null>(null);
  const [calendarDoc, setCalendarDoc] = useState<ChurchCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'holidays' | 'fasts'>('holidays');

  // Add holiday / fast form
  const [addName, setAddName] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addEndDate, setAddEndDate] = useState('');
  const [addType, setAddType] = useState<'holiday' | 'fasting'>('holiday');
  const [showAddForm, setShowAddForm] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!authLoading && !user) window.location.href = '/login';
  }, [user, authLoading]);

  useEffect(() => {
    const init = async () => {
      const adminRole = profile?.churches?.find((c: any) => c.role === 'Church Admin' || c.role === 'Admin');
      if (!adminRole) { setLoading(false); return; }
      setChurchId(adminRole.churchId);
      const snap = await getDoc(doc(db, 'church_calendars', adminRole.churchId));
      if (snap.exists()) {
        const data = snap.data() as ChurchCalendar;
        setCalendarDoc({
          ...data,
          customHolidays: data.customHolidays || [],
          hiddenDefaults: data.hiddenDefaults || [],
          hiddenFasts: data.hiddenFasts || [],
        });
      }
      setLoading(false);
    };
    if (profile) init();
  }, [profile]);

  const selectCalendarType = async (type: CalendarType) => {
    if (!churchId) return;
    setSaving(true);
    const newDoc: ChurchCalendar = {
      churchId,
      calendarType: type,
      customHolidays: [],
      hiddenDefaults: [],
      hiddenFasts: [],
    };
    await setDoc(doc(db, 'church_calendars', churchId), newDoc);
    setCalendarDoc(newDoc);
    setSaving(false);
  };

  const toggleHideDefault = async (holidayId: string) => {
    if (!calendarDoc || !churchId) return;
    const already = calendarDoc.hiddenDefaults.includes(holidayId);
    const updated = already
      ? calendarDoc.hiddenDefaults.filter(h => h !== holidayId)
      : [...calendarDoc.hiddenDefaults, holidayId];
    await updateDoc(doc(db, 'church_calendars', churchId), { hiddenDefaults: updated });
    setCalendarDoc({ ...calendarDoc, hiddenDefaults: updated });
  };

  const toggleHideFast = async (fastId: string) => {
    if (!calendarDoc || !churchId) return;
    const currentHidden = calendarDoc.hiddenFasts || [];
    const already = currentHidden.includes(fastId);
    const updated = already
      ? currentHidden.filter(f => f !== fastId)
      : [...currentHidden, fastId];
    await updateDoc(doc(db, 'church_calendars', churchId), { hiddenFasts: updated });
    setCalendarDoc({ ...calendarDoc, hiddenFasts: updated });
  };

  const addCustomEntry = async () => {
    if (!addName.trim() || !addDate || !calendarDoc || !churchId) return;
    setSaving(true);
    const ethStart = calendarDoc.calendarType === 'ethiopian' ? formatEthiopianLabel(addDate) : undefined;
    const ethEnd = (calendarDoc.calendarType === 'ethiopian' && addEndDate && addEndDate >= addDate)
      ? formatEthiopianLabel(addEndDate)
      : undefined;

    const newEntry: CustomHoliday = {
      id: `custom-${Date.now()}`,
      name: addName.trim(),
      date: addDate,
      ...(addEndDate && addEndDate >= addDate ? { endDate: addEndDate } : {}),
      type: addType,
      ethiopianDate: ethStart ? (ethEnd && ethEnd !== ethStart ? `${ethStart} – ${ethEnd}` : ethStart) : undefined,
      isCustom: true,
      hidden: false,
    };
    const updated = [...calendarDoc.customHolidays, newEntry];
    await updateDoc(doc(db, 'church_calendars', churchId), { customHolidays: updated });
    setCalendarDoc({ ...calendarDoc, customHolidays: updated });
    setAddName('');
    setAddDate('');
    setAddEndDate('');
    setShowAddForm(false);
    setSaving(false);
  };

  const removeCustomHoliday = async (id: string) => {
    if (!calendarDoc || !churchId) return;
    const updated = calendarDoc.customHolidays.filter(h => h.id !== id);
    await updateDoc(doc(db, 'church_calendars', churchId), { customHolidays: updated });
    setCalendarDoc({ ...calendarDoc, customHolidays: updated });
  };

  const switchCalendarType = async (type: CalendarType) => {
    if (!calendarDoc || !churchId) return;
    if (!confirm(`Switch to the ${type === 'ethiopian' ? 'Ethiopian Orthodox' : 'Gregorian'} calendar? Your custom entries will be preserved.`)) return;
    const updated = { ...calendarDoc, calendarType: type };
    await updateDoc(doc(db, 'church_calendars', churchId), { calendarType: type });
    setCalendarDoc(updated);
  };

  if (loading || authLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading...</div>;
  if (!churchId) return <div style={{ padding: '4rem', textAlign: 'center' }}>Admin access required.</div>;

  // ── Calendar Type Picker ──────────────────────────────────────────────────
  if (!calendarDoc) {
    return (
      <div style={{ minHeight: 'calc(100vh - 72px)' }}>
        <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '3rem' }}>
            <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back to Dashboard
            </Link>
            <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />
            <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Choose Your Calendar</h1>
          </div>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.7 }}>
            Select a calendar type. This will pre-fill your church&apos;s calendar with the corresponding holidays and fasting periods, which you can then customize freely.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Ethiopian Card */}
            <button onClick={() => selectCalendarType('ethiopian')} disabled={saving} style={{ textAlign: 'left', padding: '2rem', borderRadius: '20px', border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', transition: '0.2s' }} className="glass-card">
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🇪🇹</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ethiopian Orthodox</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                13-month Ge&apos;ez calendar. Pre-filled with Enkutatash, Genna, Timkat, Fasika, Meskel, and canonical Ethiopian Orthodox fasts.
              </p>
            </button>

            {/* Gregorian Card */}
            <button onClick={() => selectCalendarType('gregorian')} disabled={saving} style={{ textAlign: 'left', padding: '2rem', borderRadius: '20px', border: '2px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', transition: '0.2s' }} className="glass-card">
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🗓️</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Gregorian Calendar</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Standard Western calendar. Pre-filled with Christmas, Easter, New Year, and major public holidays, plus custom fasting support.
              </p>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Holiday & Fasting Manager ──────────────────────────────────────────────
  const isEthiopian = calendarDoc.calendarType === 'ethiopian';

  const defaultHolidays: Holiday[] = isEthiopian
    ? getEthiopianHolidays(currentYear, language)
    : getGregorianHolidays(currentYear);

  const customHolidayEntries = calendarDoc.customHolidays.filter(c => (c.type || 'holiday') === 'holiday');
  const customFastEntries = calendarDoc.customHolidays.filter(c => c.type === 'fasting');

  const allHolidays = [
    ...defaultHolidays.map(h => ({ ...h, isCustom: false, hidden: calendarDoc.hiddenDefaults.includes(h.id), endDate: undefined as string | undefined })),
    ...customHolidayEntries,
  ].sort((a, b) => a.date.localeCompare(b.date));

  const defaultFastSummaries: FastSummary[] = isEthiopian
    ? getEthiopianFastSummaries(currentYear, language)
    : [];

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)' }}>
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </Link>
          <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Church Calendar</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => switchCalendarType('ethiopian')}
              style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: isEthiopian ? 'var(--primary)' : 'transparent', color: isEthiopian ? '#fff' : 'var(--text-secondary)' }}
            >🇪🇹 Ethiopian</button>
            <button
              onClick={() => switchCalendarType('gregorian')}
              style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', background: !isEthiopian ? 'var(--primary)' : 'transparent', color: !isEthiopian ? '#fff' : 'var(--text-secondary)' }}
            >🗓️ Gregorian</button>
          </div>
        </div>

        {/* Tabs: Holidays vs Fasting Periods */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <button
            onClick={() => { setActiveTab('holidays'); setAddType('holiday'); }}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer',
              background: activeTab === 'holidays' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'holidays' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            🗓️ Holidays ({allHolidays.length})
          </button>
          <button
            onClick={() => { setActiveTab('fasts'); setAddType('fasting'); }}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: 'pointer',
              background: activeTab === 'fasts' ? '#8B5CF6' : 'transparent',
              color: activeTab === 'fasts' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            🕯️ Fasting Periods ({defaultFastSummaries.length + customFastEntries.length})
          </button>
        </div>

        {/* Add Custom Holiday / Fasting Period Card */}
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          {!showAddForm ? (
            <button
              onClick={() => {
                setAddType(activeTab === 'fasts' ? 'fasting' : 'holiday');
                setShowAddForm(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: activeTab === 'fasts' ? '#8B5CF6' : 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {activeTab === 'fasts' ? 'Add Custom Fasting Period' : 'Add Custom Holiday or Special Date'}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ flex: 1, minWidth: '140px' }}>
                  <label>Entry Type</label>
                  <select className="input-field" value={addType} onChange={e => setAddType(e.target.value as 'holiday' | 'fasting')}>
                    <option value="holiday">Holiday / Feast</option>
                    <option value="fasting">Fasting Period (ጾም)</option>
                  </select>
                </div>
                <div className="input-group" style={{ flex: 2, minWidth: '220px' }}>
                  <label>{addType === 'fasting' ? 'Fast Name' : 'Holiday Name'}</label>
                  <input
                    className="input-field"
                    type="text"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder={addType === 'fasting' ? 'e.g. Special Parish Fast / ጸሎተ ምሕላ' : 'e.g. Church Patron Saint Feast'}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label>{addType === 'fasting' ? 'Start Date' : 'Date'}</label>
                  <input className="input-field" type="date" value={addDate} onChange={e => setAddDate(e.target.value)} />
                </div>
                <div className="input-group" style={{ flex: 1, minWidth: '160px' }}>
                  <label>End Date (Optional, for multi-day span)</label>
                  <input className="input-field" type="date" min={addDate} value={addEndDate} onChange={e => setAddEndDate(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={addCustomEntry} disabled={saving || !addName.trim() || !addDate} className="btn-primary" style={{ padding: '0.65rem 1.4rem' }}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} style={{ padding: '0.65rem 1rem', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: Holidays List */}
        {activeTab === 'holidays' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              <span>Holiday</span>
              <span>Date</span>
              <span>Visibility</span>
            </div>

            {allHolidays.map((entry) => {
              const startStr = new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
              const endStr = entry.endDate
                ? new Date(entry.endDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
                : null;
              const displayDate = endStr && endStr !== startStr ? `${startStr} – ${endStr}` : startStr;

              return (
                <div key={entry.id} className="glass-card" style={{ padding: '0.9rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center', opacity: entry.hidden ? 0.45 : 1, transition: 'opacity 0.2s' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{entry.name}</span>
                      {entry.isCustom ? (
                        <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.1)', color: '#6366F1', padding: '0.1rem 0.45rem', borderRadius: '99px', fontWeight: 700 }}>Custom</span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', padding: '0.1rem 0.45rem', borderRadius: '99px', fontWeight: 700 }}>Default</span>
                      )}
                    </div>
                    {isEthiopian && entry.ethiopianDate && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{entry.ethiopianDate}</div>
                    )}
                  </div>

                  <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{displayDate}</span>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {entry.isCustom ? (
                      <button onClick={() => removeCustomHoliday(entry.id)} style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#DC2626', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>Remove</button>
                    ) : (
                      <button onClick={() => toggleHideDefault(entry.id)} style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                        {entry.hidden ? 'Show' : 'Hide'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: Fasting Periods List */}
        {activeTab === 'fasts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {isEthiopian && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  <span>Canonical Ethiopian Orthodox Fast</span>
                  <span>{currentYear} Period</span>
                  <span>Status</span>
                </div>

                {defaultFastSummaries.map((fast) => {
                  const isHidden = (calendarDoc.hiddenFasts || []).includes(fast.id);
                  return (
                    <div key={fast.id} className="glass-card" style={{ padding: '0.95rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center', opacity: isHidden ? 0.45 : 1, transition: 'opacity 0.2s', borderLeft: '3px solid #8B5CF6' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>{fast.name}</span>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', padding: '0.1rem 0.45rem', borderRadius: '99px', fontWeight: 700 }}>Default Fast</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {fast.ethiopianLabel}
                        </div>
                      </div>

                      <span style={{ fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{fast.periodLabel}</span>

                      <div>
                        <button
                          onClick={() => toggleHideFast(fast.id)}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: isHidden ? 'rgba(139,92,246,0.1)' : 'none',
                            color: isHidden ? '#8B5CF6' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                          }}
                        >
                          {isHidden ? 'Enable' : 'Disable'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Fasts Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ padding: '0 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Custom Church Fasting Periods ({customFastEntries.length})
              </div>

              {customFastEntries.length === 0 ? (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                  No custom fasting periods added yet. Click <strong>&ldquo;Add Custom Fasting Period&rdquo;</strong> above to add a single-day or multi-week fast for your congregation.
                </div>
              ) : (
                customFastEntries.map((entry) => {
                  const startStr = new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
                  const endStr = entry.endDate
                    ? new Date(entry.endDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
                    : null;
                  const displayDate = endStr && endStr !== startStr ? `${startStr} – ${endStr}` : startStr;

                  return (
                    <div key={entry.id} className="glass-card" style={{ padding: '0.95rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1rem', alignItems: 'center', borderLeft: '3px solid #8B5CF6' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600 }}>{entry.name}</span>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', padding: '0.1rem 0.45rem', borderRadius: '99px', fontWeight: 700 }}>Custom Fast</span>
                        </div>
                        {isEthiopian && entry.ethiopianDate && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{entry.ethiopianDate}</div>
                        )}
                      </div>

                      <span style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{displayDate}</span>

                      <button onClick={() => removeCustomHoliday(entry.id)} style={{ padding: '0.3rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#DC2626', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
