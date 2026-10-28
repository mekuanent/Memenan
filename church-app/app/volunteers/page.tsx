"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function VolunteersPublicPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [schedules, setSchedules] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    fetchSchedules();
  }, [user, authLoading, profile]);

  const fetchSchedules = async () => {
    if (!profile?.churches || profile.churches.length === 0) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // For MVP, if they belong to multiple churches, we just fetch schedules for all of them
      const churchIds = profile.churches.map((c: any) => c.churchId);
      
      const sq = query(collection(db, 'volunteer_schedules'), where('churchId', 'in', churchIds));
      const tq = query(collection(db, 'volunteer_teams'), where('churchId', 'in', churchIds));
      
      const [sSnap, tSnap] = await Promise.all([getDocs(sq), getDocs(tq)]);
      
      setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Sort by date upcoming
      const sData = sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .filter((s: any) => new Date(s.date) >= new Date(new Date().setHours(0,0,0,0))); // Only future or today
        
      setSchedules(sData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (slotId: string) => {
    if (!user || !profile) return;
    try {
      const slot = schedules.find(s => s.id === slotId);
      if (!slot) return;
      
      const newVolunteer = { userId: user.uid, userName: profile.name || user.email };
      const updatedVolunteers = [...(slot.volunteers || []), newVolunteer];
      const newStatus = updatedVolunteers.length >= (slot.quantityNeeded || 1) ? 'Filled' : 'Open';

      await updateDoc(doc(db, 'volunteer_schedules', slotId), {
        volunteers: arrayUnion(newVolunteer),
        status: newStatus
      });
      fetchSchedules();
    } catch (err) {
      console.error(err);
      alert('Failed to RSVP');
    }
  };

  const handleCancelRSVP = async (slotId: string) => {
    if (!confirm('Are you sure you want to cancel your RSVP?')) return;
    try {
      const slot = schedules.find(s => s.id === slotId);
      if (!slot || !user) return;
      const volunteerToRemove = slot.volunteers?.find((v: any) => v.userId === user.uid);
      if (!volunteerToRemove) return;
      
      await updateDoc(doc(db, 'volunteer_schedules', slotId), {
        volunteers: arrayRemove(volunteerToRemove),
        status: 'Open'
      });
      fetchSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || authLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading Schedules...</div>;

  if (!profile?.churches || profile.churches.length === 0) {
    return (
      <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>You aren't connected to a church.</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Join a church from the Churches directory to view volunteer schedules.</p>
        <button onClick={() => router.push('/churches')} className="btn-primary" style={{ marginTop: '2rem' }}>Browse Churches</button>
      </main>
    );
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return ` at ${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const getGoogleCalendarUrl = (slot: any) => {
    const team = teams.find(t => t.id === slot.teamId);
    const text = encodeURIComponent(`Volunteer: ${slot.role} - ${team?.name || slot.teamName}`);
    const dateObj = new Date(slot.date);
    let d1, d2;

    if (slot.startTime) {
      // Create local date but push it to UTC for ISO string format
      const localDate = new Date(`${slot.date}T${slot.startTime}:00`);
      d1 = localDate.toISOString().replace(/-|:|\.\d\d\d/g, '');
      const durationMs = (slot.durationHours || 2) * 60 * 60 * 1000;
      const endDate = new Date(localDate.getTime() + durationMs);
      d2 = endDate.toISOString().replace(/-|:|\.\d\d\d/g, '');
    } else {
      d1 = dateObj.toISOString().split('T')[0].replace(/-/g, '');
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      d2 = nextDay.toISOString().split('T')[0].replace(/-/g, '');
    }

    const details = encodeURIComponent(team?.description || 'Volunteer Service Slot');
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${d1}/${d2}&details=${details}`;
    if (slot.location) {
      url += `&location=${encodeURIComponent(slot.location)}`;
    }
    return url;
  };

  const mySchedules = schedules.filter(s => s.volunteers?.some((v: any) => v.userId === user?.uid));
  const openSchedules = schedules.filter(s => s.status === 'Open' && !s.volunteers?.some((v: any) => v.userId === user?.uid));
  const otherSchedules = schedules.filter(s => s.status === 'Filled' && !s.volunteers?.some((v: any) => v.userId === user?.uid));

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Volunteer Schedules</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Sign up for open roles or manage your upcoming service slots.</p>
      </div>
      
      {/* My Schedule Section */}
      {mySchedules.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
             My Upcoming Shifts
          </h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {mySchedules.map(slot => (
              <div key={slot.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ flex: 1, paddingRight: '2rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {new Date(slot.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                    {formatTime(slot.startTime)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{slot.teamName} • <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{slot.role}</span></div>
                  {slot.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {slot.location}
                    </div>
                  )}
                  
                  {(() => {
                    const team = teams.find(t => t.id === slot.teamId);
                    if (!team) return null;
                    return (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                        {team.description && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{team.description}</div>}
                        {team.leaders && team.leaders.length > 0 && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <strong>Team Leaders:</strong> {team.leaders.map((l:any) => l.name).join(', ')}
                          </div>
                        )}
                        <a href={getGoogleCalendarUrl(slot)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                           Add to Google Calendar
                        </a>
                      </div>
                    )
                  })()}

                </div>
                <button onClick={() => handleCancelRSVP(slot.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 600, flexShrink: 0 }}>Cancel RSVP</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Open Roles Section */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Open Roles</h2>
        {openSchedules.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No open roles available right now.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {openSchedules.map(slot => (
              <div key={slot.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, paddingRight: '2rem' }}>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(slot.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    {formatTime(slot.startTime)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{slot.teamName} • <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{slot.role}</span></div>
                  {slot.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {slot.location}
                    </div>
                  )}
                  
                  {(() => {
                    const team = teams.find(t => t.id === slot.teamId);
                    if (!team) return null;
                    return (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px' }}>
                        {team.description && <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{team.description}</div>}
                        {team.leaders && team.leaders.length > 0 && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <strong>Team Leaders:</strong> {team.leaders.map((l:any) => l.name).join(', ')}
                          </div>
                        )}
                        <div style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}>
                          {(slot.quantityNeeded || 1) - (slot.volunteers?.length || 0)} spot(s) remaining
                        </div>
                      </div>
                    )
                  })()}

                </div>
                <button onClick={() => handleRSVP(slot.id)} className="btn-primary" style={{ padding: '0.5rem 1.5rem', flexShrink: 0 }}>Sign Up</button>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* Filled Roles Section (Just so people know who else is serving) */}
      {otherSchedules.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Filled Roles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {otherSchedules.map(slot => (
              <div key={slot.id} className="glass-card" style={{ padding: '1rem', background: '#F8FAFC' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {new Date(slot.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                  {formatTime(slot.startTime)}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{slot.teamName} • {slot.role}</div>
                {slot.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    {slot.location}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {slot.volunteers?.map((vol: any, idx: number) => (
                    <div key={idx} style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.9rem' }}>{vol.userName}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
