"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function VolunteerAdminPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'roster' | 'teams'>('roster');
  
  const [teams, setTeams] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [churchMembers, setChurchMembers] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTeam, setNewScheduleTeam] = useState('');
  const [newScheduleRole, setNewScheduleRole] = useState('');
  const [newScheduleLocation, setNewScheduleLocation] = useState('');
  const [newScheduleQuantity, setNewScheduleQuantity] = useState(1);
  const [newScheduleStartTime, setNewScheduleStartTime] = useState('09:00');
  const [newScheduleDuration, setNewScheduleDuration] = useState(2);
  
  const adminChurch = profile?.churches?.find((c: any) => c.role === 'Church Admin' || c.role === 'Admin');

  useEffect(() => {
    if (authLoading) return;
    if (!adminChurch) {
      router.push('/dashboard');
      return;
    }
    
    fetchData();
  }, [authLoading, adminChurch]);

  const fetchData = async () => {
    if (!adminChurch) return;
    setLoading(true);
    try {
      // Fetch Teams
      const tq = query(collection(db, 'volunteer_teams'), where('churchId', '==', adminChurch.churchId));
      const tSnap = await getDocs(tq);
      setTeams(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Fetch Schedules
      const sq = query(collection(db, 'volunteer_schedules'), where('churchId', '==', adminChurch.churchId));
      const sSnap = await getDocs(sq);
      const sData = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setSchedules(sData);
      
      // Fetch All Users for Leader selection (MVP workaround for array of objects)
      const uq = query(collection(db, 'users'));
      const uSnap = await getDocs(uq);
      const allUsers = uSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const members = allUsers.filter(u => u.churches && u.churches.some((c: any) => c.churchId === adminChurch.churchId));
      setChurchMembers(members);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    try {
      await addDoc(collection(db, 'volunteer_teams'), {
        churchId: adminChurch.churchId,
        name: newTeamName,
        description: newTeamDesc,
        leaders: []
      });
      setNewTeamName('');
      setNewTeamDesc('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create team');
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Delete this team?')) return;
    try {
      await deleteDoc(doc(db, 'volunteer_teams', id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddLeader = async (teamId: string, userId: string) => {
    if (!userId) return;
    const user = churchMembers.find(u => u.id === userId);
    if (!user) return;
    try {
      await updateDoc(doc(db, 'volunteer_teams', teamId), {
        leaders: arrayUnion({ userId: user.id, name: user.name })
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to add leader');
    }
  };

  const handleRemoveLeader = async (teamId: string, leader: any) => {
    if (!confirm('Remove this leader?')) return;
    try {
      await updateDoc(doc(db, 'volunteer_teams', teamId), {
        leaders: arrayRemove(leader)
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const copyInviteLink = (teamId: string) => {
    const url = `${window.location.origin}/volunteers/invite?teamId=${teamId}&churchId=${adminChurch.churchId}`;
    navigator.clipboard.writeText(url);
    alert('Invite link copied to clipboard!');
  };

  const handleCreateScheduleSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleDate || !newScheduleTeam || !newScheduleRole) return;
    try {
      const team = teams.find(t => t.id === newScheduleTeam);
      await addDoc(collection(db, 'volunteer_schedules'), {
        churchId: adminChurch.churchId,
        teamId: newScheduleTeam,
        teamName: team?.name || '',
        date: newScheduleDate,
        startTime: newScheduleStartTime,
        durationHours: newScheduleDuration,
        location: newScheduleLocation,
        role: newScheduleRole,
        quantityNeeded: newScheduleQuantity,
        volunteers: [],
        status: 'Open'
      });
      setNewScheduleRole(''); // keep date and team selected for rapid entry
      setNewScheduleQuantity(1);
      setNewScheduleLocation('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to create slots');
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!confirm('Delete this open slot?')) return;
    try {
      await deleteDoc(doc(db, 'volunteer_schedules', id));
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };
  
  const handleRemoveVolunteer = async (slotId: string, volunteer: any) => {
    if (!confirm('Remove volunteer?')) return;
    try {
      const slot = schedules.find(s => s.id === slotId);
      if (!slot) return;
      const updatedVolunteers = slot.volunteers.filter((v: any) => v.userId !== volunteer.userId);
      const newStatus = updatedVolunteers.length >= slot.quantityNeeded ? 'Filled' : 'Open';

      await updateDoc(doc(db, 'volunteer_schedules', slotId), {
        volunteers: arrayRemove(volunteer),
        status: newStatus
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading Volunteer Hub...</div>;

  return (
    <main className="animate-fade-in-up" style={{ padding: '4rem 2rem', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Volunteer Scheduling</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Organize teams and manage open service slots.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <button 
          onClick={() => setActiveTab('roster')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'roster' ? 'var(--primary)' : 'transparent', color: activeTab === 'roster' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 600 }}
        >
          Manage Roster & Slots
        </button>
        <button 
          onClick={() => setActiveTab('teams')}
          style={{ padding: '0.5rem 1rem', background: activeTab === 'teams' ? 'var(--primary)' : 'transparent', color: activeTab === 'teams' ? 'white' : 'var(--text-secondary)', borderRadius: '8px', fontWeight: 600 }}
        >
          Manage Teams
        </button>
      </div>

      {activeTab === 'teams' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Create New Team</h3>
            <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Team Name</label>
                <input required type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="input-field" placeholder="e.g. Worship Band" />
              </div>
              <div className="input-group">
                <label>Description (Optional)</label>
                <textarea value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} className="input-field" placeholder="Brief description of responsibilities..." rows={3} />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Create Team</button>
            </form>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {teams.length === 0 ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No teams created yet.</div>
            ) : (
              teams.map(team => (
                <div key={team.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{team.name}</h4>
                      {team.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>{team.description}</p>}
                    </div>
                    <button onClick={() => handleDeleteTeam(team.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem' }}>Delete</button>
                  </div>
                  
                  <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team Leaders</h5>
                    
                    {team.leaders && team.leaders.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                        {team.leaders.map((leader: any, idx: number) => (
                          <div key={idx} style={{ background: 'white', border: '1px solid var(--border)', padding: '0.25rem 0.5rem 0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {leader.name}
                            <button onClick={() => handleRemoveLeader(team.id, leader)} style={{ background: 'var(--border)', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', color: 'var(--text-secondary)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>No leaders assigned yet.</p>
                    )}
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        list={`members-${team.id}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          const selected = churchMembers.find(m => `${m.name} (${m.email})` === val);
                          if (selected) {
                            handleAddLeader(team.id, selected.id);
                            e.target.value = '';
                          }
                        }} 
                        className="input-field" 
                        style={{ padding: '0.5rem', fontSize: '0.9rem', flex: 1 }}
                        placeholder="Search members..."
                      />
                      <datalist id={`members-${team.id}`}>
                        {churchMembers.map(m => (
                          <option key={m.id} value={`${m.name} (${m.email})`} />
                        ))}
                      </datalist>
                      <button onClick={() => copyInviteLink(team.id)} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                        Copy Invite Link
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'roster' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          <div className="glass-card" style={{ padding: '2rem', height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Post Open Slot</h3>
            <form onSubmit={handleCreateScheduleSlot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label>Date</label>
                <input required type="date" value={newScheduleDate} onChange={e => setNewScheduleDate(e.target.value)} className="input-field" />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Start Time</label>
                  <input required type="time" value={newScheduleStartTime} onChange={e => setNewScheduleStartTime(e.target.value)} className="input-field" />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Duration (hrs)</label>
                  <input required type="number" step="0.5" min="0.5" value={newScheduleDuration} onChange={e => setNewScheduleDuration(parseFloat(e.target.value))} className="input-field" />
                </div>
              </div>
              <div className="input-group">
                <label>Team</label>
                <select required value={newScheduleTeam} onChange={e => setNewScheduleTeam(e.target.value)} className="input-field">
                  <option value="">Select Team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Required Role</label>
                <input required type="text" value={newScheduleRole} onChange={e => setNewScheduleRole(e.target.value)} className="input-field" placeholder="e.g. Acoustic Guitar, Greeter" />
              </div>
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Location</label>
                  <button type="button" onClick={() => setNewScheduleLocation('Virtual')} style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Set Virtual</button>
                </div>
                <input required type="text" value={newScheduleLocation} onChange={e => setNewScheduleLocation(e.target.value)} className="input-field" placeholder="e.g. Main Auditorium, or Virtual" />
              </div>
              <div className="input-group">
                <label>Quantity Needed</label>
                <input required type="number" min="1" max="20" value={newScheduleQuantity} onChange={e => setNewScheduleQuantity(parseInt(e.target.value))} className="input-field" />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Add Slots</button>
            </form>
          </div>
          
          <div className="glass-card" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Upcoming Schedules</h3>
            
            {schedules.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No slots posted yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {schedules.map(slot => (
                  <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {new Date(slot.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                            {slot.startTime && ` at ${(() => {
                               const [h, m] = slot.startTime.split(':').map(Number);
                               const ampm = h >= 12 ? 'PM' : 'AM';
                               const hr = h % 12 || 12;
                               return `${hr}:${m.toString().padStart(2, '0')} ${ampm}`;
                             })()}`}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>• {slot.teamName}</span>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Role: {slot.role}</div>
                        {slot.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            {slot.location}
                          </div>
                        )}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Capacity: {slot.volunteers?.length || 0} / {slot.quantityNeeded || 1}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {slot.status === 'Open' && (
                          <div style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#CA8A04', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                            OPEN
                          </div>
                        )}
                        {slot.status === 'Filled' && (
                          <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16A34A', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                            FILLED
                          </div>
                        )}
                        
                        <button onClick={() => handleDeleteSlot(slot.id)} style={{ background: 'transparent', color: '#DC2626', fontSize: '0.85rem', fontWeight: 600, padding: '0.3rem 0.6rem', border: '1px solid #DC2626', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                           Delete
                        </button>
                      </div>
                    </div>
                    
                    {slot.volunteers && slot.volunteers.length > 0 && (
                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {slot.volunteers.map((vol: any, idx: number) => (
                          <div key={idx} style={{ background: 'white', border: '1px solid var(--border)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {vol.userName}
                            <button onClick={() => handleRemoveVolunteer(slot.id, vol)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
