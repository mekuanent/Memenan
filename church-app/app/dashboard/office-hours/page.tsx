"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatTime12h(time24: string): string {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

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

export default function OfficeHoursManagementPage() {
  const { user, profile, loading: authLoading } = useAuth();

  // Determine user's clergy or admin memberships
  const eligibleMemberships = useMemo(() => {
    if (!profile?.churches) return [];
    return profile.churches.filter((c: any) =>
      ['Church Admin', 'Admin', 'Father', 'Deacon'].includes(c.role)
    );
  }, [profile]);

  const [selectedChurchId, setSelectedChurchId] = useState<string>('');
  const [churchNames, setChurchNames] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'schedule' | 'appointments' | 'clergy-roles'>('schedule');

  const [officeHours, setOfficeHours] = useState<any[]>([]);
  const [churchMembers, setChurchMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states for creating an office hour opening
  const [title, setTitle] = useState('Spiritual Counseling & Office Hours');
  const [clergyTitle, setClergyTitle] = useState<'Father' | 'Deacon'>('Father');
  const [selectedClergyUid, setSelectedClergyUid] = useState<string>('');
  const [scheduleType, setScheduleType] = useState<'specific' | 'recurring'>('recurring');
  const [specificDate, setSpecificDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<number>(3); // Wednesday default
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('12:00');
  const [sessionMode, setSessionMode] = useState<'one-on-one' | 'drop-in'>('one-on-one');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<number>(30);
  const [locationType, setLocationType] = useState<'In-Person' | 'Phone Call' | 'Virtual'>('In-Person');
  const [locationDetail, setLocationDetail] = useState('Church Office');

  // Role assignment state for Church Admins
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignRoleType, setAssignRoleType] = useState<'Father' | 'Deacon'>('Father');

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/login';
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (eligibleMemberships.length > 0 && !selectedChurchId) {
      const first = eligibleMemberships[0];
      setSelectedChurchId(first.churchId);
      if (first.role === 'Deacon') setClergyTitle('Deacon');
      else setClergyTitle('Father');
    }
    if (user && !selectedClergyUid) {
      setSelectedClergyUid(user.uid);
    }
  }, [eligibleMemberships, selectedChurchId, user, selectedClergyUid]);

  const currentMembership = useMemo(
    () => eligibleMemberships.find((m: any) => m.churchId === selectedChurchId),
    [eligibleMemberships, selectedChurchId]
  );

  const isChurchAdmin =
    currentMembership?.role === 'Church Admin' || currentMembership?.role === 'Admin';

  const fetchData = async () => {
    if (!selectedChurchId || !user) return;
    setLoading(true);
    try {
      // Fetch church names
      const cSnap = await getDocs(collection(db, 'churches'));
      const cMap: Record<string, string> = {};
      cSnap.docs.forEach(d => {
        cMap[d.id] = d.data().name || d.id;
      });
      setChurchNames(cMap);

      // Fetch church members
      const uSnap = await getDocs(collection(db, 'users'));
      const allUsers = uSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const members = allUsers.filter(
        u => u.churches && u.churches.some((c: any) => c.churchId === selectedChurchId)
      );
      setChurchMembers(members);

      // Fetch office hours for this church
      const ohSnap = await getDocs(
        query(collection(db, 'office_hours'), where('churchId', '==', selectedChurchId))
      );
      const ohList = ohSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setOfficeHours(ohList);
    } catch (err) {
      console.error('Error loading office hours data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && selectedChurchId) {
      fetchData();
    } else if (!authLoading && eligibleMemberships.length === 0) {
      setLoading(false);
    }
  }, [authLoading, selectedChurchId, eligibleMemberships.length]);

  const clergyMembers = useMemo(() => {
    return churchMembers.filter(m =>
      m.churches?.some(
        (c: any) =>
          c.churchId === selectedChurchId &&
          ['Father', 'Deacon', 'Church Admin', 'Admin'].includes(c.role)
      )
    );
  }, [churchMembers, selectedChurchId]);

  const visibleOfficeHours = useMemo(() => {
    if (isChurchAdmin) return officeHours;
    return officeHours.filter(oh => oh.clergyId === user?.uid);
  }, [officeHours, isChurchAdmin, user]);

  const handleCreateOfficeHour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChurchId || !user) return;
    if (scheduleType === 'specific' && !specificDate) {
      alert('Please choose a date for the office hours.');
      return;
    }
    if (startTime >= endTime) {
      alert('End time must be after start time.');
      return;
    }

    setSaving(true);
    try {
      const targetUser =
        churchMembers.find(m => m.id === selectedClergyUid) || {
          id: user.uid,
          name: user.displayName || profile?.name || 'Clergy',
        };

      const newDoc = {
        churchId: selectedChurchId,
        clergyId: targetUser.id,
        clergyName: targetUser.name || targetUser.email || 'Clergy',
        clergyTitle,
        title: title.trim() || 'Office Hours',
        scheduleType,
        date: scheduleType === 'specific' ? specificDate : null,
        dayOfWeek: scheduleType === 'recurring' ? Number(dayOfWeek) : null,
        startTime,
        endTime,
        sessionMode,
        slotDurationMinutes: sessionMode === 'one-on-one' ? Number(slotDurationMinutes) : null,
        locationType,
        locationDetail: locationDetail.trim() || locationType,
        bookings: [],
        rsvps: [],
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'office_hours'), newDoc);
      setSpecificDate('');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create office hours opening.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOfficeHour = async (id: string) => {
    if (!confirm('Delete this office hour opening?')) return;
    try {
      await deleteDoc(doc(db, 'office_hours', id));
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignClergyRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !selectedChurchId) return;
    const member = churchMembers.find(m => m.id === selectedMemberId);
    if (!member) return;

    setSaving(true);
    try {
      const updatedChurches = (member.churches || []).map((c: any) =>
        c.churchId === selectedChurchId ? { ...c, role: assignRoleType } : c
      );
      await updateDoc(doc(db, 'users', member.id), { churches: updatedChurches });
      setSelectedMemberId('');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to update member role.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeClergyRole = async (memberId: string) => {
    const member = churchMembers.find(m => m.id === memberId);
    if (!member) return;
    if (!confirm(`Change ${member.name || member.email}'s role back to standard Member?`)) return;

    try {
      const updatedChurches = (member.churches || []).map((c: any) =>
        c.churchId === selectedChurchId ? { ...c, role: 'Member' } : c
      );
      await updateDoc(doc(db, 'users', member.id), { churches: updatedChurches });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelBooking = async (oh: any, bookingToRemove: any) => {
    if (!confirm(`Cancel appointment with ${bookingToRemove.userName}?`)) return;
    try {
      const updatedBookings = (oh.bookings || []).filter(
        (b: any) =>
          !(
            b.date === bookingToRemove.date &&
            b.slotStart === bookingToRemove.slotStart &&
            b.userId === bookingToRemove.userId
          )
      );
      await updateDoc(doc(db, 'office_hours', oh.id), { bookings: updatedBookings });
      await fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading || loading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Office Hours Console...</div>;
  }

  if (eligibleMemberships.length === 0) {
    return (
      <div style={{ padding: '5rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>Clergy Access Required</h2>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Only Church Fathers, Deacons, and Church Administrators can manage office hour schedules. Please ask your Church Administrator to assign your Father or Deacon role.
        </p>
        <Link href="/calendar" className="btn-primary" style={{ display: 'inline-block', marginTop: '1.5rem', textDecoration: 'none' }}>
          Go to Unified Calendar
        </Link>
      </div>
    );
  }

  // Collect all upcoming 1-on-1 bookings and drop-in RSVPs across visibleOfficeHours
  const allBookedAppointments = visibleOfficeHours.flatMap(oh =>
    (oh.bookings || []).map((b: any) => ({
      ...b,
      ohId: oh.id,
      ohTitle: oh.title,
      clergyName: oh.clergyName,
      clergyTitle: oh.clergyTitle,
      locationType: oh.locationType,
      locationDetail: oh.locationDetail,
      ohRef: oh,
    }))
  ).sort((a, b) => `${a.date} ${a.slotStart}`.localeCompare(`${b.date} ${b.slotStart}`));

  const dropInSessionsWithRsvps = visibleOfficeHours.filter(
    oh => oh.sessionMode === 'drop-in' && (oh.rsvps || []).length > 0
  );

  return (
    <main className="animate-fade-in-up" style={{ padding: '3.5rem 2rem', maxWidth: '1150px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            {isChurchAdmin && (
              <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Church Console
              </Link>
            )}
            <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
              {currentMembership?.role}
            </span>
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Clergy Office Hours
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage 1-on-1 counseling/confession slots and open drop-in hours for your congregation.
          </p>
        </div>

        {/* Church selector if user belongs to multiple churches */}
        {eligibleMemberships.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Church:</label>
            <select
              className="input-field"
              value={selectedChurchId}
              onChange={e => setSelectedChurchId(e.target.value)}
              style={{ width: 'auto', minWidth: '200px' }}
            >
              {eligibleMemberships.map((m: any) => (
                <option key={m.churchId} value={m.churchId}>
                  {churchNames[m.churchId] || m.churchId} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('schedule')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'schedule' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'schedule' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          🗓️ Manage Openings ({visibleOfficeHours.length})
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          style={{
            padding: '0.55rem 1.15rem',
            borderRadius: '10px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'appointments' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'appointments' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          📋 Booked Appointments & Drop-In RSVPs ({allBookedAppointments.length})
        </button>
        {isChurchAdmin && (
          <button
            onClick={() => setActiveTab('clergy-roles')}
            style={{
              padding: '0.55rem 1.15rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'clergy-roles' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'clergy-roles' ? '#fff' : 'var(--text-secondary)',
            }}
          >
            ⛪ Assign Fathers & Deacons
          </button>
        )}
      </div>

      {/* TAB 1: Manage Openings */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.45fr', gap: '2rem', alignItems: 'start' }}>
          {/* Left: Create Opening Form */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Add Office Hour Opening
            </h3>
            <form onSubmit={handleCreateOfficeHour} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Clergy Title</label>
                  <select
                    className="input-field"
                    value={clergyTitle}
                    onChange={e => setClergyTitle(e.target.value as 'Father' | 'Deacon')}
                  >
                    <option value="Father">Father (ካህን / አባ)</option>
                    <option value="Deacon">Deacon (ዲያቆን)</option>
                  </select>
                </div>

                {isChurchAdmin && clergyMembers.length > 0 && (
                  <div className="input-group" style={{ flex: 1.4 }}>
                    <label>Clergy Member</label>
                    <select
                      className="input-field"
                      value={selectedClergyUid}
                      onChange={e => setSelectedClergyUid(e.target.value)}
                    >
                      {clergyMembers.map(cm => (
                        <option key={cm.id} value={cm.id}>
                          {cm.name || cm.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="input-group">
                <label>Session Title / Purpose</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Confession & Spiritual Guidance"
                />
              </div>

              {/* Schedule Type: Recurring vs Specific Date */}
              <div className="input-group">
                <label>Availability Schedule</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setScheduleType('recurring')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: scheduleType === 'recurring' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: scheduleType === 'recurring' ? 'rgba(99,102,241,0.08)' : 'transparent',
                      color: scheduleType === 'recurring' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    🔁 Weekly Recurring
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('specific')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: scheduleType === 'specific' ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: scheduleType === 'specific' ? 'rgba(99,102,241,0.08)' : 'transparent',
                      color: scheduleType === 'specific' ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    📅 Specific Date
                  </button>
                </div>
              </div>

              {scheduleType === 'recurring' ? (
                <div className="input-group">
                  <label>Day of the Week</label>
                  <select
                    className="input-field"
                    value={dayOfWeek}
                    onChange={e => setDayOfWeek(Number(e.target.value))}
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={day} value={idx}>
                        Every {day}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="input-group">
                  <label>Date</label>
                  <input
                    required
                    type="date"
                    className="input-field"
                    value={specificDate}
                    onChange={e => setSpecificDate(e.target.value)}
                  />
                </div>
              )}

              {/* Start & End Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Start Time</label>
                  <input
                    required
                    type="time"
                    className="input-field"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>End Time</label>
                  <input
                    required
                    type="time"
                    className="input-field"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Session Mode: 1-on-1 Bookable Slots vs Open Drop-In */}
              <div className="input-group">
                <label>Booking Format</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSessionMode('one-on-one')}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: sessionMode === 'one-on-one' ? '2px solid #059669' : '1px solid var(--border)',
                      background: sessionMode === 'one-on-one' ? 'rgba(16,185,129,0.08)' : 'transparent',
                      color: sessionMode === 'one-on-one' ? '#059669' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    👤 1-on-1 Bookable Slots
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionMode('drop-in')}
                    style={{
                      padding: '0.65rem',
                      borderRadius: '8px',
                      border: sessionMode === 'drop-in' ? '2px solid #059669' : '1px solid var(--border)',
                      background: sessionMode === 'drop-in' ? 'rgba(16,185,129,0.08)' : 'transparent',
                      color: sessionMode === 'drop-in' ? '#059669' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    👥 Open Drop-In (with RSVP)
                  </button>
                </div>
              </div>

              {sessionMode === 'one-on-one' && (
                <div className="input-group">
                  <label>Appointment Slot Duration</label>
                  <select
                    className="input-field"
                    value={slotDurationMinutes}
                    onChange={e => setSlotDurationMinutes(Number(e.target.value))}
                  >
                    <option value={15}>15 minutes per person</option>
                    <option value={30}>30 minutes per person</option>
                    <option value={45}>45 minutes per person</option>
                    <option value={60}>60 minutes per person</option>
                  </select>
                </div>
              )}

              {/* Location / Format */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.75rem' }}>
                <div className="input-group">
                  <label>Meeting Format</label>
                  <select
                    className="input-field"
                    value={locationType}
                    onChange={e => {
                      const val = e.target.value as 'In-Person' | 'Phone Call' | 'Virtual';
                      setLocationType(val);
                      if (val === 'In-Person') setLocationDetail('Church Office');
                      else if (val === 'Phone Call') setLocationDetail('Phone Consultation');
                      else setLocationDetail('Virtual Video Link');
                    }}
                  >
                    <option value="In-Person">In-Person</option>
                    <option value="Phone Call">Phone Call</option>
                    <option value="Virtual">Virtual Link</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Room / Phone / Link</label>
                  <input
                    required
                    type="text"
                    className="input-field"
                    value={locationDetail}
                    onChange={e => setLocationDetail(e.target.value)}
                    placeholder="e.g. Sanctuary Room B, Phone #, or Zoom URL"
                  />
                </div>
              </div>

              <button type="submit" disabled={saving} className="btn-primary" style={{ width: '100%', padding: '0.85rem', marginTop: '0.25rem' }}>
                {saving ? 'Publishing Opening...' : 'Publish Office Hours'}
              </button>
            </form>
          </div>

          {/* Right: Published Openings List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              Active Office Hour Openings
            </h3>

            {visibleOfficeHours.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No office hour openings published yet. Use the form on the left to add weekly recurring or specific-date availability.
              </div>
            ) : (
              visibleOfficeHours.map(oh => {
                const slots =
                  oh.sessionMode === 'one-on-one'
                    ? generateTimeSlots(oh.startTime, oh.endTime, oh.slotDurationMinutes || 30)
                    : [];
                const totalBookings = (oh.bookings || []).length;
                const totalRsvps = (oh.rsvps || []).length;

                return (
                  <div
                    key={oh.id}
                    className="glass-card"
                    style={{
                      padding: '1.35rem 1.5rem',
                      borderLeft: '4px solid #10B981',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                            {oh.clergyTitle} {oh.clergyName}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: oh.sessionMode === 'one-on-one' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)', color: oh.sessionMode === 'one-on-one' ? '#2563EB' : '#D97706' }}>
                            {oh.sessionMode === 'one-on-one'
                              ? `👤 1-on-1 (${oh.slotDurationMinutes}m slots)`
                              : '👥 Open Drop-In'}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.4rem' }}>{oh.title}</h4>
                      </div>

                      <button
                        onClick={() => handleDeleteOfficeHour(oh.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(239,68,68,0.3)',
                          background: 'rgba(239,68,68,0.05)',
                          color: '#DC2626',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                      <div>
                        <strong>When:</strong>{' '}
                        {oh.scheduleType === 'recurring'
                          ? `Every ${DAYS_OF_WEEK[oh.dayOfWeek]}`
                          : new Date(oh.date + 'T12:00:00').toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              timeZone: 'UTC',
                            })}
                      </div>
                      <div>
                        <strong>Time:</strong> {formatTime12h(oh.startTime)} – {formatTime12h(oh.endTime)}
                      </div>
                      <div>
                        <strong>Location:</strong> {oh.locationType} ({oh.locationDetail})
                      </div>
                    </div>

                    {oh.sessionMode === 'one-on-one' ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: '#F8FAFC', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <strong>{slots.length} slots per session</strong> ({slots.map(s => formatTime12h(s.start)).join(', ')}) •{' '}
                        <span style={{ color: '#059669', fontWeight: 600 }}>{totalBookings} booked appointment(s)</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: '#F8FAFC', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <strong>Drop-In Window</strong> •{' '}
                        <span style={{ color: '#D97706', fontWeight: 600 }}>{totalRsvps} total RSVP(s)</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Booked Appointments & Drop-In RSVPs */}
      {activeTab === 'appointments' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* 1-on-1 Booked Appointments */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
              👤 Booked 1-on-1 Appointments ({allBookedAppointments.length})
            </h3>

            {allBookedAppointments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                No 1-on-1 appointments have been booked yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {allBookedAppointments.map((b, idx) => (
                  <div
                    key={`${b.ohId}-${b.date}-${b.slotStart}-${idx}`}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid var(--border)',
                      borderLeft: '4px solid #10B981',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>
                        {b.userName} {b.userEmail ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>({b.userEmail})</span> : null}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600, marginTop: '0.2rem' }}>
                        {new Date(b.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} • {formatTime12h(b.slotStart)} – {formatTime12h(b.slotEnd)}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        With {b.clergyTitle} {b.clergyName} • {b.ohTitle} ({b.locationDetail})
                      </div>
                      {b.note && (
                        <div style={{ fontSize: '0.82rem', marginTop: '0.35rem', padding: '0.4rem 0.6rem', background: '#fff', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <strong>Note:</strong> {b.note}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleCancelBooking(b.ohRef, b)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.05)',
                        color: '#DC2626',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drop-In Sessions & RSVPs */}
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
              👥 Drop-In Office Hours RSVPs
            </h3>

            {dropInSessionsWithRsvps.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                No drop-in RSVPs recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {dropInSessionsWithRsvps.map(oh => {
                  // Group RSVPs by date
                  const byDate: Record<string, any[]> = {};
                  for (const r of oh.rsvps || []) {
                    if (!byDate[r.date]) byDate[r.date] = [];
                    byDate[r.date].push(r);
                  }

                  return (
                    <div key={oh.id} style={{ padding: '1rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 700 }}>{oh.title} — {oh.clergyTitle} {oh.clergyName}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                        {formatTime12h(oh.startTime)} – {formatTime12h(oh.endTime)} • {oh.locationDetail}
                      </div>

                      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([dateStr, list]) => (
                        <div key={dateStr} style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#D97706' }}>
                            {new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })} — {list.length} {list.length === 1 ? 'person' : 'people'} going
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                            {list.map((r, i) => (
                              <span key={i} style={{ fontSize: '0.78rem', padding: '0.15rem 0.55rem', background: '#fff', border: '1px solid var(--border)', borderRadius: '999px' }}>
                                {r.userName}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Assign Fathers & Deacons (Church Admin only) */}
      {activeTab === 'clergy-roles' && isChurchAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Assign Clergy Role
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Grant a church member the <strong>Father</strong> or <strong>Deacon</strong> role so they can manage their own office hours calendar and counseling slots.
            </p>

            <form onSubmit={handleAssignClergyRole} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Select Church Member</label>
                <select
                  required
                  className="input-field"
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                >
                  <option value="">Choose a member...</option>
                  {churchMembers.map(m => {
                    const roleInChurch = m.churches?.find((c: any) => c.churchId === selectedChurchId)?.role || 'Member';
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name || m.email} ({roleInChurch})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="input-group">
                <label>Clergy Role</label>
                <select
                  className="input-field"
                  value={assignRoleType}
                  onChange={e => setAssignRoleType(e.target.value as 'Father' | 'Deacon')}
                >
                  <option value="Father">Father (ካህን / አባ)</option>
                  <option value="Deacon">Deacon (ዲያቆን)</option>
                </select>
              </div>

              <button type="submit" disabled={saving || !selectedMemberId} className="btn-primary" style={{ width: '100%' }}>
                {saving ? 'Assigning...' : 'Assign Role'}
              </button>
            </form>
          </div>

          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
              Current Fathers & Deacons
            </h3>

            {churchMembers.filter(m =>
              m.churches?.some((c: any) => c.churchId === selectedChurchId && ['Father', 'Deacon'].includes(c.role))
            ).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                No members have been assigned the Father or Deacon role yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {churchMembers
                  .filter(m =>
                    m.churches?.some((c: any) => c.churchId === selectedChurchId && ['Father', 'Deacon'].includes(c.role))
                  )
                  .map(m => {
                    const roleObj = m.churches.find((c: any) => c.churchId === selectedChurchId);
                    return (
                      <div
                        key={m.id}
                        style={{
                          padding: '0.9rem 1.15rem',
                          borderRadius: '10px',
                          background: '#F8FAFC',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{m.name || 'Member'}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.email}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '999px', background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                            {roleObj?.role}
                          </span>
                          <button
                            onClick={() => handleRevokeClergyRole(m.id)}
                            style={{
                              padding: '0.3rem 0.65rem',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: '#fff',
                              color: 'var(--text-secondary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Remove Role
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
