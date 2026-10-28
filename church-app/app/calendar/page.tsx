"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import {
  gregorianToEthiopian,
  getEthiopianHolidays,
  getGregorianHolidays,
  getEthiopianFasts,
} from '@/lib/ethiopianCalendar';

function generateTimeSlots(startTime: string, endTime: string, durationMinutes: number): { start: string; end: string }[] {
  if (!startTime || !endTime || !durationMinutes || durationMinutes <= 0) return [];
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  const slots: { start: string; end: string }[] = [];

  while (cur + durationMinutes <= end) {
    const next = cur + durationMinutes;
    const sH = String(Math.floor(cur / 60)).padStart(2, '0');
    const sM = String(cur % 60).padStart(2, '0');
    const eH = String(Math.floor(next / 60)).padStart(2, '0');
    const eM = String(next % 60).padStart(2, '0');
    slots.push({ start: `${sH}:${sM}`, end: `${eH}:${eM}` });
    cur = next;
  }
  return slots;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'holiday' | 'fasting' | 'office-hours' | 'event' | 'volunteer' | 'public-event';

interface CalendarEntry {
  id: string;
  date: string;           // ISO date (YYYY-MM-DD)
  title: string;
  type: EventType;
  churchName?: string;
  churchId?: string;
  rsvpd?: boolean;        // true = user is going
  location?: string;
  startTime?: string;
  ethiopianDate?: string;
  raw?: any;
}

const TYPE_COLORS: Record<EventType, string> = {
  holiday:        '#F59E0B',   // amber
  fasting:        '#8B5CF6',   // purple
  'office-hours': '#10B981',   // emerald green
  event:          '#3B82F6',   // blue (RSVPd)
  volunteer:      '#EC4899',   // pink
  'public-event': 'var(--text-secondary)', // muted gray
};

const TYPE_BG: Record<EventType, string> = {
  holiday:        'rgba(245,158,11,0.12)',
  fasting:        'rgba(139,92,246,0.1)',
  'office-hours': 'rgba(16,185,129,0.12)',
  event:          'rgba(59,130,246,0.12)',
  volunteer:      'rgba(236,72,153,0.12)',
  'public-event': 'rgba(0,0,0,0.04)',
};

function formatTime12h(time24?: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { language } = useLanguage();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [churchNames, setChurchNames] = useState<Record<string, string>>({});
  const [activeChurchFilter, setActiveChurchFilter] = useState<string>('all');
  const [useEthiopianView, setUseEthiopianView] = useState(false);
  const [hasEthiopianChurch, setHasEthiopianChurch] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(today.toISOString().split('T')[0]);
  const [loadingData, setLoadingData] = useState(true);
  const [bookingNotes, setBookingNotes] = useState<Record<string, string>>({});
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const isClergyOrAdmin = useMemo(() => {
    return profile?.churches?.some((c: any) =>
      ['Father', 'Deacon', 'Church Admin', 'Admin'].includes(c.role)
    );
  }, [profile]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) window.location.href = '/login';
  }, [user, authLoading]);

  // ── Data fetching ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile || !user) return;

    const fetchAll = async () => {
      setLoadingData(true);
      const churchMemberships: { churchId: string; role: string }[] = profile.churches || [];
      if (churchMemberships.length === 0) {
        setLoadingData(false);
        return;
      }

      const churchIds = churchMemberships.map((c: any) => c.churchId);
      const allEntries: CalendarEntry[] = [];
      const names: Record<string, string> = {};
      let anyEthiopian = false;

      for (const cid of churchIds) {
        // 1. Church name
        const churchSnap = await getDoc(doc(db, 'churches', cid));
        const churchName = churchSnap.exists() ? (churchSnap.data().name || cid) : cid;
        names[cid] = churchName;

        // 2. Calendar holidays & fasts — only if the church admin has configured their calendar
        const calSnap = await getDoc(doc(db, 'church_calendars', cid));
        if (calSnap.exists()) {
          const calData = calSnap.data();
          const calType: 'ethiopian' | 'gregorian' = calData.calendarType || 'gregorian';
          if (calType === 'ethiopian') anyEthiopian = true;

          const defaults = calType === 'ethiopian'
            ? getEthiopianHolidays(viewYear, language)
            : getGregorianHolidays(viewYear);

          const hidden: string[] = calData.hiddenDefaults || [];
          const visibleDefaults = defaults.filter(h => !hidden.includes(h.id));

          for (const h of visibleDefaults) {
            allEntries.push({
              id: h.id + '-' + cid,
              date: h.date,
              title: h.name,
              type: 'holiday',
              churchId: cid,
              churchName,
              ethiopianDate: h.ethiopianDate,
            });
          }

          // Fasts
          if (calType === 'ethiopian') {
            const defaultFasts = getEthiopianFasts(viewYear, language);
            const hiddenFasts: string[] = calData.hiddenFasts || [];
            const visibleFasts = defaultFasts.filter(f => !hiddenFasts.some(hf => f.id.includes(hf)));

            for (const f of visibleFasts) {
              allEntries.push({
                id: f.id + '-' + cid,
                date: f.date,
                title: f.name,
                type: 'fasting',
                churchId: cid,
                churchName,
                ethiopianDate: f.ethiopianDate,
              });
            }
          }

          // Custom Holidays & Custom Multi-Day Fasts
          for (const ch of (calData.customHolidays || [])) {
            if (!ch.hidden && ch.date) {
              const entryType: EventType = ch.type === 'fasting' ? 'fasting' : 'holiday';
              if (ch.endDate && ch.endDate >= ch.date) {
                let cur = new Date(ch.date + 'T00:00:00Z');
                const end = new Date(ch.endDate + 'T00:00:00Z');
                while (cur <= end) {
                  const iso = cur.toISOString().split('T')[0];
                  if (iso.startsWith(`${viewYear}-`)) {
                    const eth = gregorianToEthiopian(cur);
                    allEntries.push({
                      id: `${ch.id}-${iso}-${cid}`,
                      date: iso,
                      title: ch.name,
                      type: entryType,
                      churchId: cid,
                      churchName,
                      ethiopianDate: calType === 'ethiopian'
                        ? `${eth.day} ${language === 'am' ? eth.monthNameAm : eth.monthName}`
                        : undefined,
                    });
                  }
                  cur = new Date(cur.getTime() + 86_400_000);
                }
              } else {
                allEntries.push({
                  id: ch.id + '-' + cid,
                  date: ch.date,
                  title: ch.name,
                  type: entryType,
                  churchId: cid,
                  churchName,
                  ethiopianDate: ch.ethiopianDate,
                });
              }
            }
          }
        }

        // 3. Events (public + RSVPd)
        const eventsSnap = await getDocs(query(collection(db, 'events'), where('churchId', '==', cid)));
        for (const eventDoc of eventsSnap.docs) {
          const ev = eventDoc.data();
          const rsvpList: string[] = ev.rsvps || [];
          const isGoing = rsvpList.includes(user.uid);
          if (!ev.date) continue;
          const isoDate = ev.date.split('T')[0];
          allEntries.push({
            id: eventDoc.id + '-' + cid,
            date: isoDate,
            title: ev.title || 'Event',
            type: isGoing ? 'event' : 'public-event',
            churchId: cid,
            churchName,
            location: ev.location,
            startTime: ev.startTime,
            rsvpd: isGoing,
            raw: { ...ev, id: eventDoc.id },
          });
        }

        // 4. Volunteer shifts signed up by user
        const volSnap = await getDocs(query(collection(db, 'volunteer_schedules'), where('churchId', '==', cid)));
        for (const vDoc of volSnap.docs) {
          const v = vDoc.data();
          // Support both top-level volunteer_schedules docs and nested slots
          if (v.date && Array.isArray(v.volunteers)) {
            const isAssigned = v.volunteers.some((vol: any) =>
              typeof vol === 'string' ? vol === user.uid : vol.userId === user.uid
            );
            if (isAssigned) {
              const isoDate = v.date.split('T')[0];
              allEntries.push({
                id: `vol-${vDoc.id}-${cid}`,
                date: isoDate,
                title: `${v.teamName || 'Volunteer'} — ${v.role || ''}`.trim(),
                type: 'volunteer',
                churchId: cid,
                churchName,
                location: v.location,
                startTime: v.startTime,
              });
            }
          }
          const slots: any[] = v.slots || [];
          for (const slot of slots) {
            const volunteers: string[] = slot.volunteers || [];
            if (volunteers.includes(user.uid) && slot.date) {
              const isoDate = slot.date.split('T')[0];
              allEntries.push({
                id: `vol-${vDoc.id}-${slot.id || slot.date}-${cid}`,
                date: isoDate,
                title: `${slot.teamName || 'Volunteer'} — ${slot.role || ''}`.trim(),
                type: 'volunteer',
                churchId: cid,
                churchName,
                location: slot.location,
                startTime: slot.startTime,
              });
            }
          }
        }

        // 5. Clergy Office Hours (specific dates & weekly recurring)
        const ohSnap = await getDocs(query(collection(db, 'office_hours'), where('churchId', '==', cid)));
        for (const ohDoc of ohSnap.docs) {
          const oh = { id: ohDoc.id, ...ohDoc.data() } as any;
          const labelPrefix = `${oh.clergyTitle || 'Father'} ${oh.clergyName || ''}`.trim();
          const entryTitle = `${labelPrefix}: ${oh.title || 'Office Hours'}`;
          const timeRangeLabel = `${formatTime12h(oh.startTime)} – ${formatTime12h(oh.endTime)}`;
          const locLabel = oh.locationDetail ? `${oh.locationType} • ${oh.locationDetail}` : oh.locationType;

          if (oh.scheduleType === 'specific' && oh.date) {
            allEntries.push({
              id: `oh-${oh.id}-${oh.date}-${cid}`,
              date: oh.date,
              title: entryTitle,
              type: 'office-hours',
              churchId: cid,
              churchName,
              location: locLabel,
              startTime: timeRangeLabel,
              raw: oh,
            });
          } else if (oh.scheduleType === 'recurring' && oh.dayOfWeek !== undefined && oh.dayOfWeek !== null) {
            // Generate occurrences for viewYear
            let cur = new Date(Date.UTC(viewYear, 0, 1));
            const yearEnd = new Date(Date.UTC(viewYear, 11, 31));
            while (cur <= yearEnd) {
              if (cur.getUTCDay() === Number(oh.dayOfWeek)) {
                const iso = cur.toISOString().split('T')[0];
                allEntries.push({
                  id: `oh-${oh.id}-${iso}-${cid}`,
                  date: iso,
                  title: entryTitle,
                  type: 'office-hours',
                  churchId: cid,
                  churchName,
                  location: locLabel,
                  startTime: timeRangeLabel,
                  raw: oh,
                });
              }
              cur = new Date(cur.getTime() + 86_400_000);
            }
          }
        }
      }

      setChurchNames(names);
      setEntries(allEntries);
      setHasEthiopianChurch(anyEthiopian);
      setLoadingData(false);
    };

    fetchAll();
  }, [profile, user, viewYear, language]);

  // ── Filtered entries ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (activeChurchFilter === 'all') return entries;
    return entries.filter(e => e.churchId === activeChurchFilter);
  }, [entries, activeChurchFilter]);

  // Map ISO date → entries
  const byDate = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    for (const e of filtered) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [filtered]);

  // ── Calendar grid math ──────────────────────────────────────────────────────
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long' });
  const todayISO = today.toISOString().split('T')[0];

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectedEntries = selectedDay ? (byDate[selectedDay] || []) : [];

  // ── Event RSVP toggle ───────────────────────────────────────────────────────
  const handleRsvp = async (entry: CalendarEntry) => {
    if (!user || !entry.raw) return;
    const eventRef = doc(db, 'events', entry.raw.id);
    const isGoing = entry.rsvpd;
    await updateDoc(eventRef, {
      rsvps: isGoing ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
    setEntries(prev => prev.map(e => {
      if (e.id !== entry.id) return e;
      return { ...e, rsvpd: !isGoing, type: isGoing ? 'public-event' : 'event' };
    }));
  };

  // ── Office Hours: Drop-In RSVP Toggle ───────────────────────────────────────
  const handleToggleDropInRsvp = async (entry: CalendarEntry) => {
    if (!user || !entry.raw) return;
    const oh = entry.raw;
    const busyKey = `dropin-${oh.id}-${entry.date}`;
    setActionBusyId(busyKey);
    try {
      const currentRsvps: any[] = oh.rsvps || [];
      const existing = currentRsvps.find(
        (r: any) => r.date === entry.date && r.userId === user.uid
      );
      const userName = user.displayName || profile?.name || user.email || 'Member';
      const updatedRsvps = existing
        ? currentRsvps.filter((r: any) => !(r.date === entry.date && r.userId === user.uid))
        : [...currentRsvps, { date: entry.date, userId: user.uid, userName }];

      await updateDoc(doc(db, 'office_hours', oh.id), { rsvps: updatedRsvps });

      setEntries(prev =>
        prev.map(e => {
          if (e.raw?.id === oh.id && e.type === 'office-hours') {
            return { ...e, raw: { ...e.raw, rsvps: updatedRsvps } };
          }
          return e;
        })
      );
    } catch (err) {
      console.error('Failed to update drop-in RSVP:', err);
    } finally {
      setActionBusyId(null);
    }
  };

  // ── Office Hours: 1-on-1 Slot Booking & Cancellation ────────────────────────
  const handleBookOneOnOneSlot = async (
    entry: CalendarEntry,
    slotStart: string,
    slotEnd: string
  ) => {
    if (!user || !entry.raw) return;
    const oh = entry.raw;
    const busyKey = `book-${oh.id}-${entry.date}-${slotStart}`;
    setActionBusyId(busyKey);
    try {
      const currentBookings: any[] = oh.bookings || [];
      const alreadyTaken = currentBookings.some(
        (b: any) => b.date === entry.date && b.slotStart === slotStart
      );
      if (alreadyTaken) {
        alert('This slot has just been booked by someone else.');
        return;
      }

      const noteKey = `${oh.id}-${entry.date}`;
      const newBooking = {
        date: entry.date,
        slotStart,
        slotEnd,
        userId: user.uid,
        userName: user.displayName || profile?.name || user.email || 'Member',
        userEmail: user.email || '',
        note: (bookingNotes[noteKey] || '').trim(),
      };

      const updatedBookings = [...currentBookings, newBooking];
      await updateDoc(doc(db, 'office_hours', oh.id), { bookings: updatedBookings });

      setEntries(prev =>
        prev.map(e => {
          if (e.raw?.id === oh.id && e.type === 'office-hours') {
            return { ...e, raw: { ...e.raw, bookings: updatedBookings } };
          }
          return e;
        })
      );
      setBookingNotes(prev => ({ ...prev, [noteKey]: '' }));
    } catch (err) {
      console.error('Failed to book slot:', err);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleCancelOneOnOneSlot = async (
    entry: CalendarEntry,
    slotStart: string,
    bookedUserId: string
  ) => {
    if (!user || !entry.raw) return;
    const oh = entry.raw;
    const busyKey = `cancel-${oh.id}-${entry.date}-${slotStart}`;
    setActionBusyId(busyKey);
    try {
      const currentBookings: any[] = oh.bookings || [];
      const updatedBookings = currentBookings.filter(
        (b: any) => !(b.date === entry.date && b.slotStart === slotStart && b.userId === bookedUserId)
      );
      await updateDoc(doc(db, 'office_hours', oh.id), { bookings: updatedBookings });

      setEntries(prev =>
        prev.map(e => {
          if (e.raw?.id === oh.id && e.type === 'office-hours') {
            return { ...e, raw: { ...e.raw, bookings: updatedBookings } };
          }
          return e;
        })
      );
    } catch (err) {
      console.error('Failed to cancel slot:', err);
    } finally {
      setActionBusyId(null);
    }
  };

  if (authLoading || loadingData) {
    return (
      <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading your calendar...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 72px)', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '3rem 2rem', maxWidth: '1150px', margin: '0 auto', width: '100%' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
              {language === 'am' ? 'የእኔ ቀን መቁጠሪያ' : 'My Calendar'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {language === 'am'
                ? 'በዓላት፣ አጽዋማት፣ የካህናት የቢሮ ሰዓት እና መርሐግብሮች በአንድ ቦታ።'
                : 'Holidays, fasts, clergy office hours, and church events in one place.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isClergyOrAdmin && (
              <Link
                href="/dashboard/office-hours"
                className="btn-secondary"
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.84rem', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                ⛪ {language === 'am' ? 'የቢሮ ሰዓት አስተዳድር' : 'Manage Office Hours'}
              </Link>
            )}

            {/* Ethiopian / Gregorian toggle */}
            {hasEthiopianChurch && (
              <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <button onClick={() => setUseEthiopianView(false)} style={{ padding: '0.4rem 1rem', borderRadius: '7px', border: 'none', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', background: !useEthiopianView ? 'var(--primary)' : 'transparent', color: !useEthiopianView ? '#fff' : 'var(--text-secondary)' }}>Gregorian</button>
                <button onClick={() => setUseEthiopianView(true)} style={{ padding: '0.4rem 1rem', borderRadius: '7px', border: 'none', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', background: useEthiopianView ? 'var(--primary)' : 'transparent', color: useEthiopianView ? '#fff' : 'var(--text-secondary)' }}>🇪🇹 Ethiopian</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Church Filter Pills ── */}
        {Object.keys(churchNames).length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setActiveChurchFilter('all')} style={{ padding: '0.35rem 0.9rem', borderRadius: '99px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', background: activeChurchFilter === 'all' ? 'var(--primary)' : 'transparent', color: activeChurchFilter === 'all' ? '#fff' : 'var(--text-secondary)' }}>All Churches</button>
            {Object.entries(churchNames).map(([cid, name]) => (
              <button key={cid} onClick={() => setActiveChurchFilter(cid)} style={{ padding: '0.35rem 0.9rem', borderRadius: '99px', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', background: activeChurchFilter === cid ? 'var(--primary)' : 'transparent', color: activeChurchFilter === cid ? '#fff' : 'var(--text-secondary)' }}>
                {name}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 380px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── Calendar Grid ── */}
          <div className="glass-card" style={{ padding: '1.5rem', minWidth: 0 }}>
            {/* Month Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <button onClick={prevMonth} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>
                  {useEthiopianView
                    ? (() => { const eth = gregorianToEthiopian(new Date(viewYear, viewMonth, 15)); return `${language === 'am' ? eth.monthNameAm : eth.monthName} ${eth.year}`; })()
                    : `${monthName} ${viewYear}`
                  }
                </div>
                {useEthiopianView && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{monthName} {viewYear}</div>
                )}
              </div>
              <button onClick={nextMonth} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day-of-week headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '0.5rem' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0.3rem 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
              {/* Empty offset cells */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayEntries = byDate[iso] || [];
                const isToday = iso === todayISO;
                const isSelected = iso === selectedDay;

                // Ethiopian sub-label
                let ethLabel: string | null = null;
                if (useEthiopianView && hasEthiopianChurch) {
                  const eth = gregorianToEthiopian(new Date(viewYear, viewMonth, dayNum));
                  ethLabel = `${eth.day}`;
                }

                const fastingEntries = dayEntries.filter(e => e.type === 'fasting');
                const regularEntries = dayEntries.filter(e => e.type !== 'fasting');
                const isFastingDay = fastingEntries.length > 0;

                // Show up to 2 pill chips; overflow as '+N more'
                const MAX_CHIPS = 2;
                const visible = regularEntries.slice(0, MAX_CHIPS);
                const overflow = regularEntries.length - MAX_CHIPS;

                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDay(iso === selectedDay ? null : iso)}
                    style={{
                      padding: '0.3rem 0.25rem 0.4rem',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
                      background: isSelected
                        ? 'rgba(99,102,241,0.04)'
                        : isToday
                        ? 'rgba(99,102,241,0.07)'
                        : isFastingDay
                        ? 'rgba(139,92,246,0.05)'
                        : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: '2px',
                      minHeight: '72px',
                      textAlign: 'left',
                    }}
                  >
                    {/* Day number */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          width: '24px', height: '24px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '50%',
                          fontWeight: isToday ? 700 : 500,
                          fontSize: '0.85rem',
                          background: isToday ? 'var(--primary)' : 'transparent',
                          color: isToday ? '#fff' : 'var(--text-primary)',
                        }}>
                          {dayNum}
                        </span>
                        {isFastingDay && (
                          <span title={fastingEntries.map(e => e.title).join(', ')} style={{ fontSize: '0.65rem', color: TYPE_COLORS.fasting, fontWeight: 700, cursor: 'help' }}>
                            {language === 'am' ? 'ፆም' : 'F'}
                          </span>
                        )}
                      </div>
                      {ethLabel && (
                        <span style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', opacity: 0.65, paddingRight: '2px' }}>{ethLabel}</span>
                      )}
                    </div>

                    {/* Event pill chips */}
                    {visible.map(entry => (
                      <div key={entry.id} style={{
                        background: TYPE_BG[entry.type],
                        borderLeft: `2.5px solid ${TYPE_COLORS[entry.type]}`,
                        borderRadius: '4px',
                        padding: '1px 4px',
                        fontSize: '0.67rem',
                        fontWeight: 600,
                        color: entry.type === 'public-event' ? 'var(--text-secondary)' : TYPE_COLORS[entry.type],
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        lineHeight: '16px',
                      }}>
                        {entry.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', paddingLeft: '4px', fontWeight: 600 }}>+{overflow} more</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
              {([
                ['fasting', language === 'am' ? 'ፆም (Fasting)' : 'Fasting'],
                ['holiday', language === 'am' ? 'በዓል (Holiday)' : 'Holiday'],
                ['office-hours', language === 'am' ? 'የቢሮ ሰዓት (Office Hours)' : 'Office Hours'],
                ['event', language === 'am' ? 'የምሳተፍበት (Going)' : 'Going'],
                ['public-event', language === 'am' ? 'መርሐግብር (Event)' : 'Event'],
                ['volunteer', language === 'am' ? 'አገልግሎት (Volunteer)' : 'Volunteer'],
              ] as [EventType, string][]).map(([type, label]) => (
                <div key={type} style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  background: TYPE_BG[type as EventType],
                  borderLeft: `2.5px solid ${TYPE_COLORS[type as EventType]}`,
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: type === 'public-event' ? 'var(--text-secondary)' : TYPE_COLORS[type as EventType],
                }}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Day Detail Panel ── */}
          {selectedDay && (
            <div className="glass-card animate-fade-in-up" style={{ padding: '1.5rem', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {new Date(selectedDay + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                  </div>
                  {useEthiopianView && hasEthiopianChurch && (() => {
                    const eth = gregorianToEthiopian(new Date(selectedDay + 'T12:00:00'));
                    return <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{eth.day} {language === 'am' ? eth.monthNameAm : eth.monthName} {eth.year}</div>;
                  })()}
                </div>
                <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              {selectedEntries.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Nothing scheduled on this day.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {selectedEntries.map(entry => {
                    const oh = entry.type === 'office-hours' ? entry.raw : null;

                    return (
                      <div key={entry.id} style={{ padding: '0.95rem 1rem', borderRadius: '12px', background: TYPE_BG[entry.type], borderLeft: `3px solid ${TYPE_COLORS[entry.type]}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{entry.title}</div>
                            {entry.churchName && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{entry.churchName}</div>
                            )}
                            {entry.startTime && (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {entry.startTime}
                              </div>
                            )}
                            {entry.location && (
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                {entry.location}
                              </div>
                            )}
                            {(entry.type === 'holiday' || entry.type === 'fasting') && entry.ethiopianDate && useEthiopianView && (
                              <div style={{ fontSize: '0.78rem', color: TYPE_COLORS[entry.type], marginTop: '0.2rem', fontWeight: 600 }}>🗓 {entry.ethiopianDate}</div>
                            )}
                          </div>

                          {/* RSVP button for public events */}
                          {entry.type === 'public-event' && entry.raw && (
                            <button
                              onClick={() => handleRsvp(entry)}
                              style={{ marginLeft: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '7px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Join
                            </button>
                          )}
                          {entry.type === 'event' && entry.raw && (
                            <button
                              onClick={() => handleRsvp(entry)}
                              style={{ marginLeft: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '7px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Going ✓
                            </button>
                          )}
                        </div>

                        {/* ── Office Hours Interactive Booking / Drop-In UI ── */}
                        {oh && oh.sessionMode === 'drop-in' && (() => {
                          const dayRsvps: any[] = (oh.rsvps || []).filter((r: any) => r.date === entry.date);
                          const isUserGoing = dayRsvps.some((r: any) => r.userId === user?.uid);
                          const busyKey = `dropin-${oh.id}-${entry.date}`;

                          return (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(16,185,129,0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#059669' }}>
                                  👥 Open Drop-In • {dayRsvps.length} {dayRsvps.length === 1 ? 'person' : 'people'} going
                                </span>
                                <button
                                  onClick={() => handleToggleDropInRsvp(entry)}
                                  disabled={actionBusyId === busyKey}
                                  style={{
                                    padding: '0.3rem 0.75rem',
                                    borderRadius: '7px',
                                    border: isUserGoing ? '1px solid #059669' : 'none',
                                    background: isUserGoing ? 'transparent' : '#10B981',
                                    color: isUserGoing ? '#059669' : '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {isUserGoing ? 'Going ✓' : 'RSVP Drop-In'}
                                </button>
                              </div>

                              {dayRsvps.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  {dayRsvps.map((r: any, idx: number) => (
                                    <span key={idx} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.8)', padding: '0.1rem 0.45rem', borderRadius: '99px', color: 'var(--text-secondary)', border: '1px solid rgba(16,185,129,0.25)' }}>
                                      {r.userName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {oh && oh.sessionMode === 'one-on-one' && (() => {
                          const slots = generateTimeSlots(oh.startTime, oh.endTime, oh.slotDurationMinutes || 30);
                          const dayBookings: any[] = (oh.bookings || []).filter((b: any) => b.date === entry.date);
                          const isOwnerOrAdmin =
                            oh.clergyId === user?.uid ||
                            profile?.churches?.some((c: any) => c.churchId === entry.churchId && ['Church Admin', 'Admin'].includes(c.role));
                          const noteKey = `${oh.id}-${entry.date}`;

                          return (
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(16,185,129,0.2)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669' }}>
                                👤 1-on-1 Appointments ({oh.slotDurationMinutes || 30} min slots)
                              </div>

                              <input
                                type="text"
                                placeholder="Optional topic/note before clicking Book..."
                                value={bookingNotes[noteKey] || ''}
                                onChange={e => setBookingNotes(prev => ({ ...prev, [noteKey]: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '0.38rem 0.6rem',
                                  fontSize: '0.78rem',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(16,185,129,0.35)',
                                  background: 'rgba(255,255,255,0.85)',
                                }}
                              />

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {slots.map(slot => {
                                  const booking = dayBookings.find((b: any) => b.slotStart === slot.start);
                                  const isMine = booking?.userId === user?.uid;
                                  const bookBusy = actionBusyId === `book-${oh.id}-${entry.date}-${slot.start}`;
                                  const cancelBusy = actionBusyId === `cancel-${oh.id}-${entry.date}-${slot.start}`;

                                  return (
                                    <div
                                      key={slot.start}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.35rem 0.55rem',
                                        borderRadius: '7px',
                                        background: booking ? (isMine ? 'rgba(16,185,129,0.18)' : 'rgba(0,0,0,0.04)') : 'rgba(255,255,255,0.85)',
                                        border: '1px solid rgba(16,185,129,0.22)',
                                        fontSize: '0.78rem',
                                      }}
                                    >
                                      <div>
                                        <span style={{ fontWeight: 600 }}>
                                          {formatTime12h(slot.start)} – {formatTime12h(slot.end)}
                                        </span>
                                        {booking && (
                                          <span style={{ marginLeft: '0.4rem', fontSize: '0.73rem', color: isMine ? '#059669' : 'var(--text-secondary)', fontWeight: 600 }}>
                                            • {isMine ? 'Booked by You ✓' : isOwnerOrAdmin ? `Booked (${booking.userName})` : 'Taken'}
                                          </span>
                                        )}
                                      </div>

                                      {!booking ? (
                                        <button
                                          onClick={() => handleBookOneOnOneSlot(entry, slot.start, slot.end)}
                                          disabled={bookBusy}
                                          style={{
                                            padding: '0.2rem 0.55rem',
                                            borderRadius: '5px',
                                            border: 'none',
                                            background: '#10B981',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: '0.73rem',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {bookBusy ? '...' : 'Book'}
                                        </button>
                                      ) : (isMine || isOwnerOrAdmin) ? (
                                        <button
                                          onClick={() => handleCancelOneOnOneSlot(entry, slot.start, booking.userId)}
                                          disabled={cancelBusy}
                                          style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '5px',
                                            border: '1px solid rgba(239,68,68,0.35)',
                                            background: 'rgba(239,68,68,0.06)',
                                            color: '#DC2626',
                                            fontWeight: 600,
                                            fontSize: '0.72rem',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
