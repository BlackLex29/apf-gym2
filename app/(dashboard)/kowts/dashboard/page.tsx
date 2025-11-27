"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

// Type definitions ehehehhehehehhehe
type SessionType = 'personal_training' | 'group_training' | 'consultation' | 'assessment';
type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
type PaymentStatus = 'pending' | 'paid' | 'refunded';

interface Session {
  id: string;
  sessionId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  coachId: string;
  coachName: string;
  sessionType: SessionType;
  date: Timestamp;
  startTime: string;
  endTime: string;
  duration: number;
  location: string;
  focusArea: string[];
  notes: string;
  status: SessionStatus;
  paymentStatus: PaymentStatus;
  price: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CoachStats {
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  monthlyRevenue: number;
  totalClients: number;
  averageRating: number;
}

interface CoachData {
  name?: string;
  specialty?: string;
  [key: string]: unknown;
}

const CoachDashboard: React.FC = () => {
  const { user, userRole } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<CoachStats>({
    totalSessions: 0,
    completedSessions: 0,
    upcomingSessions: 0,
    monthlyRevenue: 0,
    totalClients: 0,
    averageRating: 4.8
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed'>('today');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [coachData, setCoachData] = useState<CoachData | null>(null);

  // Load coach data from Firestore
  const loadCoachData = useCallback(async () => {
    if (!user) return;
    
    try {
      const coachDocRef = doc(db, 'users', user.uid);
      const coachDoc = await getDoc(coachDocRef);
      
      if (coachDoc.exists()) {
        setCoachData(coachDoc.data() as CoachData);
        console.log('✅ Coach data loaded:', coachDoc.data());
      } else {
        console.log('❌ No coach data found for user:', user.uid);
      }
    } catch (error) {
      console.error('Error loading coach data:', error);
    }
  }, [user]);

  // Load coach sessions
  const loadCoachSessions = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('🔍 Loading sessions for coach:', user.uid);
      
      const sessionsRef = collection(db, 'sessions');
      const q = query(
        sessionsRef,
        where('coachId', '==', user.uid),
        orderBy('date', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const sessionsData: Session[] = [];
      const clientsSet = new Set<string>();
      
      console.log('📊 Found sessions:', querySnapshot.size);
      
      querySnapshot.forEach((doc) => {
        const sessionData = { id: doc.id, ...doc.data() } as Session;
        sessionsData.push(sessionData);
        clientsSet.add(sessionData.clientId);
        console.log('📝 Session:', sessionData.sessionId, sessionData.clientName, sessionData.status);
      });

      setSessions(sessionsData);

      // Calculate stats
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const monthlySessions = sessionsData.filter(session => {
        const sessionDate = session.date.toDate();
        return sessionDate.getMonth() === currentMonth && 
               sessionDate.getFullYear() === currentYear;
      });

      const completedSessions = sessionsData.filter(s => s.status === 'completed');
      const upcomingSessions = sessionsData.filter(s => 
        s.status === 'scheduled' && s.date.toDate() >= new Date()
      );

      const monthlyRevenue = monthlySessions
        .filter(s => s.status === 'completed')
        .reduce((sum, session) => sum + session.price, 0);

      setStats({
        totalSessions: sessionsData.length,
        completedSessions: completedSessions.length,
        upcomingSessions: upcomingSessions.length,
        monthlyRevenue,
        totalClients: clientsSet.size,
        averageRating: 4.8
      });

      console.log('✅ Sessions loaded successfully');

    } catch (error) {
      console.error('❌ Error loading coach sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Filter sessions for display
  const getFilteredSessions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (activeTab) {
      case 'today':
        return sessions.filter(session => {
          const sessionDate = session.date.toDate();
          sessionDate.setHours(0, 0, 0, 0);
          return sessionDate.getTime() === today.getTime() && session.status !== 'completed';
        });
      
      case 'upcoming':
        return sessions.filter(session => 
          session.status === 'scheduled' && session.date.toDate() >= new Date()
        );
      
      case 'completed':
        return sessions.filter(session => session.status === 'completed');
      
      default:
        return [];
    }
  };

  // Get session status color using CSS variables
  const getSessionStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  // Get session type icon and label
  const getSessionTypeInfo = (type: SessionType) => {
    switch (type) {
      case 'personal_training': return { icon: '💪', label: 'Personal Training', color: 'bg-blue-500 dark:bg-blue-600' };
      case 'group_training': return { icon: '👥', label: 'Group Training', color: 'bg-green-500 dark:bg-green-600' };
      case 'consultation': return { icon: '💬', label: 'Consultation', color: 'bg-purple-500 dark:bg-purple-600' };
      case 'assessment': return { icon: '📊', label: 'Assessment', color: 'bg-orange-500 dark:bg-orange-600' };
      default: return { icon: '🎯', label: 'Session', color: 'bg-gray-500 dark:bg-gray-600' };
    }
  };

  // Format date for display
  const formatSessionDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // Format time for display
  const formatSessionTime = (session: Session) => {
    return `${session.startTime} - ${session.endTime}`;
  };

  // Calculate today&apos;s earnings
  const getTodayEarnings = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return sessions
      .filter(session => {
        const sessionDate = session.date.toDate();
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === today.getTime() && session.status === 'completed';
      })
      .reduce((sum, session) => sum + session.price, 0);
  };

  // Update session status
  const updateSessionStatus = async (sessionId: string, newStatus: SessionStatus) => {
    try {
      console.log(`Updating session ${sessionId} to ${newStatus}`);
      
      // Update local state
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: newStatus }
          : session
      ));
      
      // Reload sessions to reflect changes
      await loadCoachSessions();
    } catch (error) {
      console.error('Error updating session status:', error);
    }
  };

  useEffect(() => {
    if (user && userRole === 'coach') {
      loadCoachData();
      loadCoachSessions();
    }
  }, [user, userRole, loadCoachData, loadCoachSessions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredSessions = getFilteredSessions();
  const todayEarnings = getTodayEarnings();
  const coachName = coachData?.name || 'Coach';
  const coachSpecialty = coachData?.specialty || 'Fitness Training';

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Welcome back, {coachName}! 👋
              </h1>
              <p className="text-muted-foreground">
                {coachSpecialty} • Here&apos;s your schedule and performance overview
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Coach ID</div>
              <div className="font-mono text-lg font-bold text-primary">{user?.uid?.slice(-8)}</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Today&apos;s Sessions */}
          <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                <span className="text-2xl">📅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Today&apos;s Sessions</p>
                <p className="text-2xl font-bold text-foreground">
                  {sessions.filter(s => {
                    const today = new Date();
                    const sessionDate = s.date.toDate();
                    return sessionDate.toDateString() === today.toDateString();
                  }).length}
                </p>
              </div>
            </div>
          </div>

          {/* Today&apos;s Earnings */}
          <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
                <span className="text-2xl">💰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Today&apos;s Earnings</p>
                <p className="text-2xl font-bold text-foreground">₱{todayEarnings}</p>
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-xl">
                <span className="text-2xl">📈</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold text-foreground">₱{stats.monthlyRevenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Active Clients */}
          <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-xl">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalClients}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Sessions Only */}
        <div className="bg-card rounded-xl shadow-sm border border-border">
          {/* Session Tabs */}
          <div className="border-b border-border">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('today')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'today'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                🎯 Today ({sessions.filter(s => {
                  const today = new Date();
                  const sessionDate = s.date.toDate();
                  return sessionDate.toDateString() === today.toDateString() && s.status !== 'completed';
                }).length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'upcoming'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                📅 Upcoming ({stats.upcomingSessions})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'completed'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                ✅ Completed ({stats.completedSessions})
              </button>
            </nav>
          </div>

          {/* Sessions List */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {activeTab === 'today' && "Today&apos;s Sessions"}
              {activeTab === 'upcoming' && 'Upcoming Sessions'}
              {activeTab === 'completed' && 'Completed Sessions'}
            </h3>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground text-6xl mb-4">
                  {activeTab === 'today' && '📅'}
                  {activeTab === 'upcoming' && '🎯'}
                  {activeTab === 'completed' && '✅'}
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">No sessions found</h3>
                <p className="text-muted-foreground">
                  {activeTab === 'today' && "You don&apos;t have any sessions scheduled for today."}
                  {activeTab === 'upcoming' && "You don&apos;t have any upcoming sessions."}
                  {activeTab === 'completed' && "You haven&apos;t completed any sessions yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSessions.map((session) => {
                  const typeInfo = getSessionTypeInfo(session.sessionType);
                  return (
                    <div
                      key={session.id}
                      className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer bg-card"
                      onClick={() => setSelectedSession(session)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start space-x-3">
                          <div className={`shrink-0 w-12 h-12 ${typeInfo.color} rounded-lg flex items-center justify-center`}>
                            <span className="text-xl text-white">{typeInfo.icon}</span>
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">
                              {session.clientName}
                            </h4>
                            <p className="text-sm text-muted-foreground">{typeInfo.label}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              📍 {session.location} • ⏱️ {session.duration} mins
                            </p>
                            {session.focusArea.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs text-muted-foreground">
                                  Focus: {session.focusArea.join(', ')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-foreground">
                            {formatSessionTime(session)}
                          </div>
                          <div className="text-sm text-muted-foreground mb-2">
                            {formatSessionDate(session.date)}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSessionStatusColor(session.status)}`}>
                            {session.status.replace('_', ' ')}
                          </span>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                            ₱{session.price}
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Actions for Today&apos;s Sessions */}
                      {activeTab === 'today' && session.status === 'scheduled' && (
                        <div className="mt-3 pt-3 border-t border-border flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSessionStatus(session.id, 'in_progress');
                            }}
                            className="flex-1 bg-yellow-500 text-white py-2 px-3 rounded text-sm font-medium hover:bg-yellow-600 transition-colors"
                          >
                            Start Session
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateSessionStatus(session.id, 'completed');
                            }}
                            className="flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm font-medium hover:bg-green-600 transition-colors"
                          >
                            Mark Complete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Session Detail Modal */}
        {selectedSession && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-border">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Session Details</h2>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Client Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">👤 Client Information</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="font-medium text-foreground">{selectedSession.clientName}</div>
                      <div className="text-sm text-muted-foreground">{selectedSession.clientEmail}</div>
                      <div className="text-sm text-muted-foreground">{selectedSession.clientPhone}</div>
                    </div>
                  </div>

                  {/* Session Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">🎯 Session Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Type</div>
                        <div className="font-semibold text-foreground">
                          {getSessionTypeInfo(selectedSession.sessionType).label}
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Price</div>
                        <div className="font-semibold text-green-600 dark:text-green-400">₱{selectedSession.price}</div>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Duration</div>
                        <div className="font-semibold text-foreground">{selectedSession.duration} mins</div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                        <div className="text-sm text-muted-foreground">Location</div>
                        <div className="font-semibold text-foreground capitalize">{selectedSession.location}</div>
                      </div>
                    </div>
                  </div>

                  {/* Time & Date */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">🕐 Schedule</h3>
                    <div className="bg-muted rounded-lg p-4">
                      <div className="font-semibold text-foreground">
                        {formatSessionDate(selectedSession.date)}
                      </div>
                      <div className="text-muted-foreground">
                        {selectedSession.startTime} - {selectedSession.endTime}
                      </div>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  {selectedSession.focusArea.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3">🎯 Focus Areas</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedSession.focusArea.map((area) => (
                          <span
                            key={area}
                            className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedSession.notes && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3">📝 Notes</h3>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                        <p className="text-foreground">{selectedSession.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">📊 Status</h3>
                    <div className="flex space-x-4">
                      <div className="flex-1 bg-muted rounded-lg p-3 text-center">
                        <div className="text-sm text-muted-foreground">Session</div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${getSessionStatusColor(selectedSession.status)}`}>
                          {selectedSession.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex-1 bg-muted rounded-lg p-3 text-center">
                        <div className="text-sm text-muted-foreground">Payment</div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${
                          selectedSession.paymentStatus === 'paid' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : selectedSession.paymentStatus === 'pending'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {selectedSession.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="flex-1 bg-muted text-muted-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition-colors"
                  >
                    Close
                  </button>
                  <button className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                    Add Session Notes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachDashboard;