"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  doc, 
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Type definitions
type SessionType = 'personal_training' | 'group_training' | 'consultation' | 'assessment';
type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
type PaymentStatus = 'pending' | 'paid' | 'refunded';

interface Session {
  id?: string;
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
  duration: number; // in minutes
  location: string;
  focusArea: string[];
  notes: string;
  status: SessionStatus;
  paymentStatus: PaymentStatus;
  price: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  originalBookingId?: string; // Track which booking this came from
  completedAt?: Timestamp; // New field for completion timestamp
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  membershipStatus: string;
}

interface Coach {
  id: string;
  name: string;
  email: string;
  specialty: string;
  status: string;
  authUid: string;
}

interface Booking {
  id: string;
  coachId: string;
  coachName: string;
  coachEmail: string;
  clientEmail: string;
  clientUid: string;
  sessions: Array<{
    date: string;
    time: string;
    duration: number;
  }>;
  totalSessions: number;
  totalPrice: number;
  paymentMethod: 'cash' | 'online';
  status: 'pending_confirmation' | 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Beautiful Alert Component
const Alert: React.FC<{
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: () => void;
}> = ({ type, message, onClose }) => {
  const alertConfig = {
    success: {
      bgColor: 'bg-green-50 border-green-200',
      textColor: 'text-green-800',
      icon: '✅',
      title: 'Success'
    },
    error: {
      bgColor: 'bg-red-50 border-red-200',
      textColor: 'text-red-800',
      icon: '❌',
      title: 'Error'
    },
    warning: {
      bgColor: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-800',
      icon: '⚠️',
      title: 'Warning'
    },
    info: {
      bgColor: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      icon: 'ℹ️',
      title: 'Info'
    }
  };

  const config = alertConfig[type];

  return (
    <div className={`fixed top-4 right-4 z-50 border rounded-lg p-4 shadow-lg ${config.bgColor} ${config.textColor} max-w-sm animate-in slide-in-from-right duration-300`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 text-lg mr-3">{config.icon}</div>
        <div className="flex-1">
          <div className="font-semibold">{config.title}</div>
          <div className="text-sm mt-1">{message}</div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const SessionManagement: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'all' | 'bookings'>('upcoming');
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);

  // Session form state
  const [sessionForm, setSessionForm] = useState({
    clientId: '',
    coachId: '',
    sessionType: 'personal_training' as SessionType,
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    location: 'gym',
    focusArea: [] as string[],
    notes: '',
    price: 800
  });

  const focusAreas = [
    'Weight Loss', 'Muscle Gain', 'Strength Training', 'Cardio', 
    'Flexibility', 'Rehabilitation', 'Sports Specific', 'General Fitness'
  ];

  const sessionTypes = [
    { value: 'personal_training', label: 'Personal Training', price: 800 },
    { value: 'group_training', label: 'Group Training', price: 400 },
    { value: 'consultation', label: 'Consultation', price: 500 },
    { value: 'assessment', label: 'Fitness Assessment', price: 600 }
  ];

  // Show alert function
  const showAlert = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Generate session ID
  const generateSessionId = (): string => {
    const prefix = 'SESS';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  // Safe function to get client name from email
  const getClientNameFromEmail = (email: string | undefined): string => {
    if (!email) return 'Unknown Client';
    return email.split('@')[0];
  };

  // Safe function to get client email
  const getClientEmail = (booking: Booking): string => {
    return booking.clientEmail || 'No email provided';
  };

  // Load all data - wrapped in useCallback to fix useEffect dependency
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load sessions
      const sessionsRef = collection(db, 'sessions');
      const sessionsQuery = query(sessionsRef, orderBy('date', 'desc'));
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessionsData: Session[] = [];
      sessionsSnapshot.forEach((doc) => {
        sessionsData.push({ id: doc.id, ...doc.data() } as Session);
      });
      setSessions(sessionsData);

      // Load bookings with safe data handling
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(bookingsRef, orderBy('createdAt', 'desc'));
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData: Booking[] = [];
      bookingsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Ensure all required fields have default values
        bookingsData.push({ 
          id: doc.id, 
          coachId: data.coachId || '',
          coachName: data.coachName || 'Unknown Coach',
          coachEmail: data.coachEmail || '',
          clientEmail: data.clientEmail || '',
          clientUid: data.clientUid || '',
          sessions: data.sessions || [],
          totalSessions: data.totalSessions || 0,
          totalPrice: data.totalPrice || 0,
          paymentMethod: data.paymentMethod || 'cash',
          status: data.status || 'pending_confirmation',
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || Timestamp.now()
        } as Booking);
      });
      setBookings(bookingsData);

      // Load clients from memberships and bookings
      const membershipsRef = collection(db, 'monthlyMemberships');
      const membershipsSnapshot = await getDocs(membershipsRef);
      const clientsData: Client[] = [];
      
      membershipsSnapshot.forEach((doc) => {
        const data = doc.data();
        clientsData.push({
          id: doc.id,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown Client',
          email: data.email || '',
          phone: data.phone || 'Not provided',
          membershipStatus: data.status || 'unknown'
        });
      });

      // Also load from bookings for booking-only clients with safe handling
      const existingEmails = new Set(clientsData.map(client => client.email));
      
      bookingsData.forEach((booking) => {
        const clientEmail = getClientEmail(booking);
        if (clientEmail && !existingEmails.has(clientEmail)) {
          clientsData.push({
            id: `booking-${booking.id}`,
            name: getClientNameFromEmail(clientEmail),
            email: clientEmail,
            phone: 'Not provided',
            membershipStatus: 'booking_only'
          });
          existingEmails.add(clientEmail);
        }
      });

      setClients(clientsData);

      // Load coaches from users collection
      const coachesRef = collection(db, 'users');
      const coachesQuery = query(coachesRef, where('role', '==', 'coach'));
      const coachesSnapshot = await getDocs(coachesQuery);
      const coachesData: Coach[] = [];
      coachesSnapshot.forEach((doc) => {
        const data = doc.data();
        coachesData.push({
          id: doc.id,
          name: data.name || 'Unknown Coach',
          email: data.email || '',
          specialty: data.specialty || 'General',
          status: data.status || 'active',
          authUid: data.authUid || ''
        } as Coach);
      });
      setCoaches(coachesData);

    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('error', 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Confirm booking (hindi na convert to sessions)
  const confirmBooking = async (booking: Booking) => {
    try {
      // Update booking status to confirmed
      const bookingRef = doc(db, 'bookings', booking.id);
      await updateDoc(bookingRef, {
        status: 'confirmed',
        updatedAt: Timestamp.now()
      });

      showAlert('success', `Booking confirmed successfully for ${getClientEmail(booking)}!`);
      loadData(); // Reload data

    } catch (error) {
      console.error('Error confirming booking:', error);
      showAlert('error', 'Error confirming booking');
    }
  };

  // Calculate duration from start and end time
  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;
    
    return endTotal - startTotal;
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSessionForm(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-calculate duration when times change
    if (name === 'startTime' || name === 'endTime') {
      const duration = calculateDuration(
        name === 'startTime' ? value : sessionForm.startTime,
        name === 'endTime' ? value : sessionForm.endTime
      );
      setSessionForm(prev => ({ ...prev, duration }));
    }

    // Auto-set price when session type changes
    if (name === 'sessionType') {
      const selectedType = sessionTypes.find(type => type.value === value);
      if (selectedType) {
        setSessionForm(prev => ({ ...prev, price: selectedType.price }));
      }
    }
  };

  // Handle focus area selection
  const handleFocusAreaChange = (area: string) => {
    setSessionForm(prev => ({
      ...prev,
      focusArea: prev.focusArea.includes(area)
        ? prev.focusArea.filter(a => a !== area)
        : [...prev.focusArea, area]
    }));
  };

  // Create new session
  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionForm.clientId || !sessionForm.coachId || !sessionForm.date) {
      showAlert('warning', 'Please fill in all required fields');
      return;
    }

    try {
      const selectedClient = clients.find(c => c.id === sessionForm.clientId);
      const selectedCoach = coaches.find(c => c.id === sessionForm.coachId);

      if (!selectedClient || !selectedCoach) {
        showAlert('error', 'Invalid client or coach selection');
        return;
      }

      const sessionData: Omit<Session, 'id'> = {
        sessionId: generateSessionId(),
        clientId: sessionForm.clientId,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email,
        clientPhone: selectedClient.phone,
        coachId: sessionForm.coachId,
        coachName: selectedCoach.name,
        sessionType: sessionForm.sessionType,
        date: Timestamp.fromDate(new Date(sessionForm.date)),
        startTime: sessionForm.startTime,
        endTime: sessionForm.endTime,
        duration: sessionForm.duration,
        location: sessionForm.location,
        focusArea: sessionForm.focusArea,
        notes: sessionForm.notes,
        status: 'scheduled',
        paymentStatus: 'pending',
        price: sessionForm.price,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'sessions'), sessionData);
      
      showAlert('success', `Session created successfully for ${selectedClient.name}!`);
      setShowSessionForm(false);
      resetForm();
      loadData(); // Reload sessions
      
    } catch (error) {
      console.error('Error creating session:', error);
      showAlert('error', 'Error creating session');
    }
  };

  // Update session status
  const updateSessionStatus = async (sessionId: string, status: SessionStatus) => {
    try {
      const sessionRef = doc(db, 'sessions', sessionId);
      
      // Define proper type for update data
      const updateData: {
        status: SessionStatus;
        updatedAt: Timestamp;
        completedAt?: Timestamp;
      } = {
        status,
        updatedAt: Timestamp.now()
      };

      // If marking as completed, add completedAt timestamp
      if (status === 'completed') {
        updateData.completedAt = Timestamp.now();
      }

      await updateDoc(sessionRef, updateData);
      
      setSessions(prev => prev.map(session =>
        session.id === sessionId ? { ...session, ...updateData } : session
      ));

      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        if (status === 'completed') {
          showAlert('success', `🎉 Session completed for ${session.clientName}! Great job!`);
        } else if (status === 'in_progress') {
          showAlert('info', `Session started for ${session.clientName}`);
        } else if (status === 'cancelled') {
          showAlert('warning', `Session cancelled for ${session.clientName}`);
        }
      }
      
    } catch (error) {
      console.error('Error updating session:', error);
      showAlert('error', 'Error updating session');
    }
  };

  // Update booking status
  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        status,
        updatedAt: Timestamp.now()
      });

      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        if (status === 'cancelled') {
          showAlert('warning', `Booking cancelled for ${getClientEmail(booking)}`);
        }
      }
      
      loadData(); // Reload data
    } catch (error) {
      console.error('Error updating booking:', error);
      showAlert('error', 'Error updating booking');
    }
  };

  // Reset form
  const resetForm = () => {
    setSessionForm({
      clientId: '',
      coachId: '',
      sessionType: 'personal_training',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
      duration: 60,
      location: 'gym',
      focusArea: [],
      notes: '',
      price: 800
    });
  };

  // Filter sessions based on active tab
  const filteredSessions = sessions.filter(session => {
    const sessionDate = session.date.toDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (activeTab) {
      case 'upcoming':
        return sessionDate >= today && session.status === 'scheduled';
      case 'completed':
        return session.status === 'completed';
      case 'all':
        return true;
      default:
        return true;
    }
  });

  // Filter bookings for display
  const filteredBookings = bookings.filter(booking => 
    booking.status === 'pending_confirmation' || booking.status === 'pending_payment'
  );

  // Get today's completed sessions count - IMPROVED
  const getTodayCompletedSessions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return sessions.filter(session => {
      if (session.status !== 'completed') return false;
      
      // Check if completed today OR session date is today
      const sessionDate = session.date.toDate();
      sessionDate.setHours(0, 0, 0, 0);
      
      const completedToday = session.completedAt && 
        session.completedAt.toDate().toDateString() === today.toDateString();
      
      const sessionWasToday = sessionDate.toDateString() === today.toDateString();
      
      return completedToday || sessionWasToday;
    }).length;
  };

  // Get session status color - UPDATED TO MATCH ORANGE COLOR SCHEME
  const getSessionStatusColor = (status: SessionStatus) => {
    switch (status) {
      case 'scheduled': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'no_show': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get booking status color - UPDATED TO MATCH ORANGE COLOR SCHEME
  const getBookingStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'pending_confirmation': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'pending_payment': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get session type icon
  const getSessionTypeIcon = (type: SessionType) => {
    switch (type) {
      case 'personal_training': return '💪';
      case 'group_training': return '👥';
      case 'consultation': return '💬';
      case 'assessment': return '📊';
      default: return '🎯';
    }
  };

  // Format date for display
  const formatSessionDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format time for display
  const formatSessionTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format booking date
  const formatBookingDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get completion time if available
  const getCompletionTime = (session: Session) => {
    if (session.completedAt) {
      return formatSessionTime(session.completedAt);
    }
    return 'N/A';
  };

  useEffect(() => {
    loadData();
  }, [loadData]); // Fixed dependency array

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      {/* Beautiful Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Session Management</h1>
              <p className="text-muted-foreground">Manage coaching sessions and bookings</p>
            </div>
            <button
              onClick={() => setShowSessionForm(true)}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              + Schedule New Session
            </button>
          </div>
        </div>

        {/* Stats Cards - UPDATED with accurate completed today count */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg">
                <span className="text-2xl">📅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Upcoming Sessions</p>
                <p className="text-2xl font-bold text-foreground">
                  {sessions.filter(s => s.status === 'scheduled' && s.date.toDate() >= new Date()).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold text-foreground">
                  {getTodayCompletedSessions()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">📋</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending Bookings</p>
                <p className="text-2xl font-bold text-foreground">
                  {bookings.filter(b => b.status === 'pending_confirmation' || b.status === 'pending_payment').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                <p className="text-2xl font-bold text-foreground">{clients.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - UPDATED COLORS */}
        <div className="bg-card rounded-lg shadow mb-6">
          <div className="border-b border-border">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'upcoming'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                📅 Upcoming Sessions
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'completed'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                ✅ Completed ({sessions.filter(s => s.status === 'completed').length})
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'bookings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                📋 Pending Bookings ({filteredBookings.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                }`}
              >
                📊 All Sessions ({sessions.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Bookings List */}
        {activeTab === 'bookings' && (
          <div className="bg-card rounded-lg shadow overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Pending Bookings</h3>
              {filteredBookings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground text-6xl mb-4">📋</div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No pending bookings</h3>
                  <p className="text-muted-foreground">All bookings have been processed.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="border border-border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-foreground">{booking.coachName}</h4>
                          <p className="text-sm text-muted-foreground">{getClientEmail(booking)}</p>
                          <p className="text-sm text-muted-foreground">
                            {booking.totalSessions} session(s) • ₱{booking.totalPrice}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBookingStatusColor(booking.status)}`}>
                            {booking.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-foreground mb-2">Booked Sessions:</h5>
                        <div className="space-y-1">
                          {booking.sessions.map((session, index) => (
                            <div key={index} className="text-sm text-muted-foreground bg-muted p-2 rounded">
                              {session.date} • {session.time} • {session.duration} hours
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-sm text-muted-foreground">
                          Booked on {formatBookingDate(booking.createdAt)}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmBooking(booking)}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90"
                          >
                            Confirm Booking
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                            className="bg-destructive text-destructive-foreground px-4 py-2 rounded text-sm font-medium hover:bg-destructive/90"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions List */}
        {(activeTab === 'upcoming' || activeTab === 'completed' || activeTab === 'all') && (
          <div className="bg-card rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Session Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Client & Coach</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time & Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status & Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <span className="text-lg">{getSessionTypeIcon(session.sessionType)}</span>
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-foreground">
                              {sessionTypes.find(t => t.value === session.sessionType)?.label}
                            </div>
                            <div className="text-sm text-muted-foreground">ID: {session.sessionId}</div>
                            <div className="text-lg font-bold text-green-600">₱{session.price}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-foreground">{session.clientName}</div>
                          <div className="text-sm text-muted-foreground">{session.clientEmail}</div>
                          <div className="text-xs text-muted-foreground">{session.clientPhone}</div>
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Coach:</span> {session.coachName}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">
                          {formatSessionDate(session.date)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {session.startTime} - {session.endTime} ({session.duration} mins)
                        </div>
                        <div className="text-sm text-muted-foreground capitalize">
                          📍 {session.location}
                        </div>
                        {session.focusArea.length > 0 && (
                          <div className="mt-1">
                            <div className="text-xs text-muted-foreground">Focus: {session.focusArea.join(', ')}</div>
                          </div>
                        )}
                        {session.status === 'completed' && session.completedAt && (
                          <div className="mt-1 text-xs text-green-600 font-medium">
                            ✅ Completed at: {getCompletionTime(session)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSessionStatusColor(session.status)}`}>
                            {session.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            session.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : session.paymentStatus === 'pending'
                              ? 'bg-orange-100 text-orange-800 border-orange-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          } border`}>
                            {session.paymentStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-2">
                          {session.status === 'scheduled' && (
                            <>
                              <button
                                onClick={() => updateSessionStatus(session.id!, 'in_progress')}
                                className="bg-yellow-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-yellow-700"
                              >
                                Start Session
                              </button>
                              <button
                                onClick={() => updateSessionStatus(session.id!, 'cancelled')}
                                className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-xs font-medium hover:bg-destructive/90"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {session.status === 'in_progress' && (
                            <button
                              onClick={() => updateSessionStatus(session.id!, 'completed')}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700"
                            >
                              Complete Session
                            </button>
                          )}
                          {(session.status === 'completed' || session.notes) && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {session.notes && "📝 Has notes"}
                              {session.status === 'completed' && session.completedAt && (
                                <div className="text-green-600">
                                  ✅ Completed
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredSessions.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-muted-foreground text-6xl mb-4">
                    {activeTab === 'upcoming' ? '📅' : activeTab === 'completed' ? '✅' : '📊'}
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {activeTab === 'upcoming' 
                      ? 'No upcoming sessions scheduled.' 
                      : activeTab === 'completed'
                      ? 'No completed sessions yet.'
                      : 'No sessions found.'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {activeTab === 'upcoming' 
                      ? 'Schedule new sessions to see them here.' 
                      : activeTab === 'completed'
                      ? 'Completed sessions will appear here.'
                      : 'No sessions available in the system.'}
                  </p>
                  {activeTab === 'upcoming' && (
                    <button
                      onClick={() => setShowSessionForm(true)}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90"
                    >
                      Schedule Your First Session
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Creation Modal */}
        {showSessionForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-foreground">Schedule New Session</h2>
                  <button
                    onClick={() => {
                      setShowSessionForm(false);
                      resetForm();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={createSession} className="space-y-6">
                  {/* Client Selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Client *
                    </label>
                    <select
                      name="clientId"
                      value={sessionForm.clientId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    >
                      <option value="">Choose a client...</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} ({client.email}) - {client.membershipStatus}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Coach Selection */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Coach *
                    </label>
                    <select
                      name="coachId"
                      value={sessionForm.coachId}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    >
                      <option value="">Choose a coach...</option>
                      {coaches.map(coach => (
                        <option key={coach.id} value={coach.id}>
                          {coach.name} - {coach.specialty} ({coach.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Session Type */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Session Type *
                      </label>
                      <select
                        name="sessionType"
                        value={sessionForm.sessionType}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      >
                        {sessionTypes.map(type => (
                          <option key={type.value} value={type.value}>
                            {type.label} - ₱{type.price}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Location */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Location *
                      </label>
                      <select
                        name="location"
                        value={sessionForm.location}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      >
                        <option value="gym">Main Gym</option>
                        <option value="yoga_studio">Yoga Studio</option>
                        <option value="boxing_ring">Boxing Ring</option>
                        <option value="pool">Swimming Pool</option>
                        <option value="outdoor">Outdoor Area</option>
                        <option value="virtual">Virtual Session</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Date */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Date *
                      </label>
                      <input
                        type="date"
                        name="date"
                        value={sessionForm.date}
                        onChange={handleInputChange}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      />
                    </div>

                    {/* Start Time */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        name="startTime"
                        value={sessionForm.startTime}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      />
                    </div>

                    {/* End Time */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        End Time *
                      </label>
                      <input
                        type="time"
                        name="endTime"
                        value={sessionForm.endTime}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                      />
                    </div>
                  </div>

                  {/* Duration & Price Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm text-muted-foreground">Duration</div>
                      <div className="text-lg font-semibold text-foreground">
                        {sessionForm.duration} minutes
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-sm text-muted-foreground">Session Price</div>
                      <div className="text-lg font-semibold text-green-600">
                        ₱{sessionForm.price}
                      </div>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Focus Areas
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {focusAreas.map(area => (
                        <label key={area} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={sessionForm.focusArea.includes(area)}
                            onChange={() => handleFocusAreaChange(area)}
                            className="rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-foreground">{area}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Session Notes
                    </label>
                    <textarea
                      name="notes"
                      value={sessionForm.notes}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Any special instructions, client goals, or session focus..."
                      className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-background"
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSessionForm(false);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90"
                    >
                      Schedule Session
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionManagement;