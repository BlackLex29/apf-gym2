"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, updateDoc, doc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Type definitions for Bookings
type ActivityType = 'modeling' | 'dance' | 'karate' | 'zumba';
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
interface CoachBooking {
  id: string;
  coachId: string;
  coachName: string;
  coachEmail: string;
  clientEmail: string;
  clientName?: string;
  clientPhone?: string;
  sessions: Array<{
    date: string;
    time: string;
    duration: number;
  }>;
  totalHours: number;
  totalPrice: number;
  paymentMethod: "cash" | "online";
  paymentProof?: string;
  approvedBy?: string;
  status: "pending_confirmation" | "pending_payment" | "confirmed" | "cancelled" | "completed" | "paid";
  createdAt: Timestamp;
}
interface BookingRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  activityType: ActivityType;
  date: string;
  timeSlot: string;
  duration: number;
  participants: number;
  specialRequests: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt: Timestamp;
  bookingReference: string;
}
// Type definitions for Memberships
type UserType = 'regular' | 'student';
type PaymentMethod = 'cash' | 'gcash' | 'bank_transfer';
type MembershipStatus = 'active' | 'pending' | 'expired' | 'cancelled' | 'payment_pending';
interface MembershipRecord {
  id: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userType: UserType;
  paymentMethod: PaymentMethod;
  studentId?: string;
  monthlyPrice: number;
  startDate: Timestamp;
  expiryDate: Timestamp;
  status: MembershipStatus;
  createdAt: Timestamp;
  paymentDate?: Timestamp;
  approvedBy?: string;
  emergencyContact: string;
  emergencyPhone: string;
  healthConditions: string;
  fitnessGoals: string;
}
// Combined Client Interface
interface ClientSummary {
  email: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpent: number;
  membershipStatus?: MembershipStatus;
  lastActivity: Date;
  type: 'booking_only' | 'member' | 'both';
}
const ClientManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'memberships' | 'coach-bookings'>('overview');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
 
  // Booking filters
  const [bookingFilter, setBookingFilter] = useState<'all' | BookingStatus>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [bookingSearch, setBookingSearch] = useState('');
 
  // Membership filters
  const [membershipFilter, setMembershipFilter] = useState<'all' | MembershipStatus>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [membershipSearch, setMembershipSearch] = useState('');
  const [coachBookings, setCoachBookings] = useState<CoachBooking[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching all data...');
     
      // Fetch bookings
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(bookingsRef, orderBy('date', 'desc'), orderBy('timeSlot', 'asc'));
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookingsData: BookingRecord[] = [];
      bookingsSnapshot.forEach((doc) => {
        bookingsData.push({ id: doc.id, ...doc.data() } as BookingRecord);
      });

      const coachBookingsRef = collection(db, 'bookings');
      const coachBookingsQuery = query(coachBookingsRef, orderBy('createdAt', 'desc'));
      const coachBookingsSnapshot = await getDocs(coachBookingsQuery);
      const coachBookingsData: CoachBooking[] = [];
      coachBookingsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include documents that have coachId (coach bookings)
        if (data.coachId) {
          coachBookingsData.push({ id: doc.id, ...data } as CoachBooking);
        }
      });

      // Helper function to calculate end time
      console.log('Coach bookings fetched:', coachBookingsData.length);
      console.log('Bookings fetched:', bookingsData.length);
      
      // Fetch memberships
      const membershipsRef = collection(db, 'monthlyMemberships');
      const membershipsQuery = query(membershipsRef, orderBy('createdAt', 'desc'));
      const membershipsSnapshot = await getDocs(membershipsQuery);
      const membershipsData: MembershipRecord[] = [];
      membershipsSnapshot.forEach((doc) => {
        const data = doc.data();
        membershipsData.push({
          id: doc.id,
          ...data
        } as MembershipRecord);
      });
      
      console.log('Memberships fetched:', membershipsData.length);
      console.log('Memberships data:', membershipsData);
     
      setBookings(bookingsData);
      setMemberships(membershipsData);
      setCoachBookings(coachBookingsData);
      generateClientSummary(bookingsData, membershipsData);
     
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error instanceof Error) {
        alert('Error loading data: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Update coach booking status
  const updateCoachBookingStatus = async (bookingId: string, newStatus: CoachBooking['status']) => {
    setUpdatingId(bookingId);
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
     
      const updateData: Partial<CoachBooking> = {
        status: newStatus,
      };
      
      if (newStatus === 'confirmed') {
        updateData.approvedBy = 'admin';
      }
      
      await updateDoc(bookingRef, updateData);
     
      setCoachBookings(prev => prev.map(booking =>
        booking.id === bookingId ? { ...booking, ...updateData } : booking
      ));
     
      console.log('Coach booking updated successfully');
     
    } catch (error) {
      console.error('Error updating coach booking:', error);
      alert('Error updating booking: ' + (error as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Generate client summary
  const generateClientSummary = (bookingsData: BookingRecord[], membershipsData: MembershipRecord[]) => {
    const clientMap = new Map<string, ClientSummary>();
    
    // Process bookings
    bookingsData.forEach(booking => {
      // Skip if email is missing
      if (!booking.email) {
        console.warn('Booking missing email:', booking.id);
        return;
      }
     
      const clientEmail = booking.email.toLowerCase();
      if (!clientMap.has(clientEmail)) {
        clientMap.set(clientEmail, {
          email: booking.email,
          name: booking.name || 'Unknown',
          phone: booking.phone || 'N/A',
          totalBookings: 0,
          totalSpent: 0,
          lastActivity: booking.createdAt.toDate(),
          type: 'booking_only'
        });
      }
     
      const client = clientMap.get(clientEmail)!;
      client.totalBookings += 1;
      client.totalSpent += booking.totalPrice;
      if (booking.createdAt.toDate() > client.lastActivity) {
        client.lastActivity = booking.createdAt.toDate();
      }
    });
    
    // Process memberships
    membershipsData.forEach(membership => {
      // Skip if email is missing
      if (!membership.email) {
        console.warn('Membership missing email:', membership.id);
        return;
      }
     
      const clientEmail = membership.email.toLowerCase();
      if (!clientMap.has(clientEmail)) {
        clientMap.set(clientEmail, {
          email: membership.email,
          name: `${membership.firstName || ''} ${membership.lastName || ''}`.trim() || 'Unknown',
          phone: membership.phone || 'N/A',
          totalBookings: 0,
          totalSpent: 0,
          membershipStatus: membership.status,
          lastActivity: membership.createdAt.toDate(),
          type: 'member'
        });
      } else {
        const client = clientMap.get(clientEmail)!;
        client.membershipStatus = membership.status;
        client.type = 'both';
        if (membership.createdAt.toDate() > client.lastActivity) {
          client.lastActivity = membership.createdAt.toDate();
        }
      }
    });
    
    setClients(Array.from(clientMap.values()));
  };

  // Update booking status
  const updateBookingStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: newStatus });
     
      setBookings(prev => prev.map(booking =>
        booking.id === bookingId ? { ...booking, status: newStatus } : booking
      ));
     
      // Refresh client summary
      generateClientSummary(
        bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b),
        memberships
      );
    } catch (error) {
      console.error('Error updating booking status:', error);
    }
  };

  // Update membership status - COMPLETELY FIXED VERSION
  const updateMembershipStatus = async (membershipId: string, newStatus: MembershipStatus) => {
    setUpdatingId(membershipId);
    try {
      const membershipRef = doc(db, 'monthlyMemberships', membershipId);
     
      // Find the current membership data
      const currentMembership = memberships.find(m => m.id === membershipId);
      if (!currentMembership) {
        console.error('Membership not found');
        return;
      }

      const updateData: Partial<MembershipRecord> = {
        status: newStatus,
        approvedBy: 'admin'
      };

      // If activating membership, set payment date and calculate dates
      if (newStatus === 'active') {
        const now = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
       
        updateData.paymentDate = Timestamp.fromDate(now);
        updateData.startDate = Timestamp.fromDate(now);
        updateData.expiryDate = Timestamp.fromDate(expiryDate);
      }

      console.log('Updating membership:', membershipId, 'with data:', updateData);
      await updateDoc(membershipRef, updateData);
     
      // Update local state
      const updatedMemberships = memberships.map(membership =>
        membership.id === membershipId
          ? { ...membership, ...updateData }
          : membership
      );
     
      setMemberships(updatedMemberships);
     
      // Regenerate client summary with updated data
      generateClientSummary(bookings, updatedMemberships);
     
      console.log('Membership updated successfully');
     
    } catch (error) {
      console.error('Error updating membership status:', error);
      alert('Error updating membership: ' + (error as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter functions
  const filteredBookings = bookings.filter(booking => {
    const matchesFilter = bookingFilter === 'all' || booking.status === bookingFilter;
    const matchesDate = !selectedDate || booking.date === selectedDate;
    const matchesSearch = !bookingSearch ||
      booking.name.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      booking.email.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      booking.bookingReference.toLowerCase().includes(bookingSearch.toLowerCase());
   
    return matchesFilter && matchesDate && matchesSearch;
  });

  const filteredMemberships = memberships.filter(membership => {
    const matchesFilter = membershipFilter === 'all' || membership.status === membershipFilter;
    const matchesPaymentMethod = paymentMethodFilter === 'all' || membership.paymentMethod === paymentMethodFilter;
    const matchesSearch = !membershipSearch ||
      membership.firstName.toLowerCase().includes(membershipSearch.toLowerCase()) ||
      membership.lastName.toLowerCase().includes(membershipSearch.toLowerCase()) ||
      membership.email.toLowerCase().includes(membershipSearch.toLowerCase()) ||
      membership.membershipId.toLowerCase().includes(membershipSearch.toLowerCase());
   
    return matchesFilter && matchesPaymentMethod && matchesSearch;
  });

  // Utility functions
  const getBookingStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'completed': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getMembershipStatusColor = (status: MembershipStatus) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'payment_pending': return 'bg-orange-500/20 text-orange-700 border-orange-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'expired': return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getActivityIcon = (activity: ActivityType) => {
    switch (activity) {
      case 'modeling': return '📸';
      case 'dance': return '💃';
      case 'karate': return '🥋';
      case 'zumba': return '🎵';
      default: return '🎭';
    }
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'cash': return '💵';
      case 'gcash': return '📱';
      case 'bank_transfer': return '🏦';
      default: return '💰';
    }
  };

  // UPDATED: Enhanced date formatting to show full date with day names
  const formatDate = (dateString: string | Timestamp) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString.toDate();
    return date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // NEW: Format date for table display (shorter version)
  const formatDateShort = (dateString: string | Timestamp) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString.toDate();
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  const calculateDaysRemaining = (expiryDate: Timestamp): number => {
    const now = new Date();
    const expiry = expiryDate.toDate();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // NEW: Calculate membership duration in days
  const calculateMembershipDuration = (startDate: Timestamp, expiryDate: Timestamp): number => {
    const start = startDate.toDate();
    const expiry = expiryDate.toDate();
    const diffTime = expiry.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Statistics
  const stats = {
    totalClients: clients.length,
    activeMembers: memberships.filter(m => m.status === 'active').length,
    totalBookings: bookings.length,
    upcomingBookings: bookings.filter(b => {
      const bookingDate = new Date(b.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return bookingDate >= today && (b.status === 'confirmed' || b.status === 'pending');
    }).length,
    pendingGcash: memberships.filter(m => m.status === 'payment_pending').length,
    pendingCoachPayments: coachBookings.filter(b => b.status === 'pending_payment').length,
    totalRevenue: bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + b.totalPrice, 0) +
      memberships
        .filter(m => m.status === 'active')
        .reduce((sum, m) => sum + m.monthlyPrice, 0) +
      coachBookings
        .filter(b => b.status === 'paid' || b.status === 'completed')
        .reduce((sum, b) => sum + b.totalPrice, 0)
  };

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const markAsPaidAndCreateSession = async (booking: CoachBooking) => {
    setUpdatingId(booking.id);
    try {
      // Update booking status to paid
      const bookingRef = doc(db, 'bookings', booking.id);
      await updateDoc(bookingRef, {
        status: 'paid',
        approvedBy: 'admin'
      });

      // Create sessions for each booked session
      const sessionsRef = collection(db, 'sessions');
     
      for (const session of booking.sessions) {
        const sessionData = {
          sessionId: `SESS-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          clientId: booking.id,
          clientName: booking.clientName || 'N/A',
          clientEmail: booking.clientEmail,
          clientPhone: booking.clientPhone || 'N/A',
          coachId: booking.coachId,
          coachName: booking.coachName,
          sessionType: 'personal_training',
          date: Timestamp.fromDate(new Date(session.date)),
          startTime: session.time,
          endTime: calculateEndTime(session.time, session.duration),
          duration: session.duration * 60,
          location: 'gym',
          focusArea: [],
          notes: `Coach booking - ${booking.sessions.length} sessions package`,
          status: 'scheduled',
          paymentStatus: 'paid',
          price: booking.totalPrice / booking.sessions.length,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        await addDoc(sessionsRef, sessionData);
      }

      // Update local state
      setCoachBookings(prev => prev.map(b =>
        b.id === booking.id ? { ...b, status: 'paid', approvedBy: 'admin' } : b
      ));

      alert(`Payment confirmed! ${booking.sessions.length} session(s) created for ${booking.coachName}`);
     
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Error processing payment: ' + (error as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  const calculateEndTime = (startTime: string, durationHours: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + (durationHours * 60);
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading client data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Client Management</h1>
          <p className="text-muted-foreground">Comprehensive management of all clients, bookings, and memberships</p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-card rounded-lg shadow mb-6">
          <div className="border-b border-border">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'bookings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                📅 Studio Bookings
              </button>
              <button
                onClick={() => setActiveTab('memberships')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'memberships'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                🏋️ Memberships
              </button>
              <button
                onClick={() => setActiveTab('coach-bookings')}
                className={`flex-1 py-4 px-6 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'coach-bookings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                🎯 Coach Bookings
              </button>
            </nav>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <span className="text-2xl">👥</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalClients}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <span className="text-2xl">🏋️</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Members</p>
                <p className="text-2xl font-bold text-foreground">{stats.activeMembers}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <span className="text-2xl">📱</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">GCash Pending</p>
                <p className="text-2xl font-bold text-foreground">{stats.pendingGcash}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Coach Payments</p>
                <p className="text-2xl font-bold text-foreground">{stats.pendingCoachPayments || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="bg-card rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">All Clients</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Bookings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total Spent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Membership</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((client) => (
                    <tr key={client.email} className="hover:bg-muted/50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-foreground">{client.name}</div>
                          <div className="text-sm text-muted-foreground">{client.email}</div>
                          <div className="text-xs text-muted-foreground/70">{client.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          client.type === 'both' ? 'bg-purple-500/20 text-purple-700 border border-purple-500/30' :
                          client.type === 'member' ? 'bg-blue-500/20 text-blue-700 border border-blue-500/30' :
                          'bg-green-500/20 text-green-700 border border-green-500/30'
                        }`}>
                          {client.type === 'both' ? '🎯 Both' : client.type === 'member' ? '🏋️ Member' : '📅 Booking Only'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{client.totalBookings}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">₱{client.totalSpent}</td>
                      <td className="px-6 py-4">
                        {client.membershipStatus ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMembershipStatusColor(client.membershipStatus)}`}>
                            {client.membershipStatus.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No membership</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {client.lastActivity.toLocaleDateString('en-PH')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div>
            {/* Booking Filters */}
            <div className="bg-card rounded-lg shadow mb-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Search Bookings</label>
                  <input
                    type="text"
                    placeholder="Search by name, email, or reference..."
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
                  <select
                    value={bookingFilter}
                    onChange={(e) => setBookingFilter(e.target.value as 'all' | BookingStatus)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
                  />
                </div>
              </div>
            </div>
            {/* Bookings Table */}
            <div className="bg-card rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Customer & Activity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date & Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary/20 rounded-lg flex items-center justify-center">
                              <span className="text-lg">{getActivityIcon(booking.activityType)}</span>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-foreground">{booking.name}</div>
                              <div className="text-sm text-muted-foreground">{booking.email}</div>
                              <div className="text-xs text-muted-foreground/70">{booking.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-foreground">{formatDate(booking.date)}</div>
                          <div className="text-sm text-muted-foreground">{formatTime(booking.timeSlot)}</div>
                          <div className="text-xs text-muted-foreground/70">{booking.duration} hour{booking.duration > 1 ? 's' : ''}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-foreground">Ref: {booking.bookingReference}</div>
                          <div className="text-sm text-muted-foreground">Participants: {booking.participants}</div>
                          <div className="text-sm font-semibold text-green-600">₱{booking.totalPrice}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBookingStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex space-x-2">
                            {booking.status === 'pending' && (
                              <>
                                <button onClick={() => updateBookingStatus(booking.id, 'confirmed')} className="text-green-600 hover:text-green-700 bg-green-500/20 hover:bg-green-500/30 px-3 py-1 rounded text-xs font-medium border border-green-500/30">
                                  Confirm
                                </button>
                                <button onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="text-red-600 hover:text-red-700 bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded text-xs font-medium border border-red-500/30">
                                  Cancel
                                </button>
                              </>
                            )}
                            {booking.status === 'confirmed' && (
                              <>
                                <button onClick={() => updateBookingStatus(booking.id, 'completed')} className="text-blue-600 hover:text-blue-700 bg-blue-500/20 hover:bg-blue-500/30 px-3 py-1 rounded text-xs font-medium border border-blue-500/30">
                                  Complete
                                </button>
                                <button onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="text-red-600 hover:text-red-700 bg-red-500/20 hover:bg-red-500/30 px-3 py-1 rounded text-xs font-medium border border-red-500/30">
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Memberships Tab */}
        {activeTab === 'memberships' && (
          <div>
            {/* Membership Filters */}
            <div className="bg-card rounded-lg shadow mb-6 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Search Members</label>
                  <input
                    type="text"
                    placeholder="Search by name, email, or ID..."
                    value={membershipSearch}
                    onChange={(e) => setMembershipSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
                  <select
                    value={membershipFilter}
                    onChange={(e) => setMembershipFilter(e.target.value as 'all' | MembershipStatus)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="payment_pending">GCash Pending</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Payment Method</label>
                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value as 'all' | PaymentMethod)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background"
                  >
                    <option value="all">All Methods</option>
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
            </div>
            {/* Memberships Table */}
            <div className="bg-card rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Member & Plan</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Membership Period</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Payment & Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Validity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMemberships.map((membership) => (
                      <tr key={membership.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12 bg-primary/20 rounded-lg flex items-center justify-center">
                              <span className="text-lg">🏋️</span>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-foreground">{membership.firstName} {membership.lastName}</div>
                              <div className="text-sm text-muted-foreground">{membership.email}</div>
                              <div className="text-xs text-muted-foreground/70">{membership.phone}</div>
                              <div className="text-xs font-medium text-primary mt-1">
                                {membership.userType === 'student' ? '🎓 Student' : '👤 Regular'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-foreground">ID: {membership.membershipId}</div>
                            <div className="text-sm">
                              <div className="font-semibold text-muted-foreground">Start Date:</div>
                              <div className="text-green-600 font-medium">{formatDate(membership.startDate)}</div>
                            </div>
                            <div className="text-sm">
                              <div className="font-semibold text-muted-foreground">Expiry Date:</div>
                              <div className="text-red-600 font-medium">{formatDate(membership.expiryDate)}</div>
                            </div>
                            <div className="text-xs bg-muted px-2 py-1 rounded inline-block">
                              Duration: {calculateMembershipDuration(membership.startDate, membership.expiryDate)} days
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center mb-2">
                            <span className="text-lg mr-2">{getPaymentMethodIcon(membership.paymentMethod)}</span>
                            <span className="text-sm font-medium text-muted-foreground capitalize">{membership.paymentMethod.replace('_', ' ')}</span>
                          </div>
                          <div className="text-lg font-bold text-green-600 mb-2">₱{membership.monthlyPrice}</div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getMembershipStatusColor(membership.status)}`}>
                            {membership.status.replace('_', ' ')}
                          </span>
                          {membership.paymentDate && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Paid: {formatDateShort(membership.paymentDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {membership.status === 'active' ? (
                            <div className={`text-center p-3 rounded-lg border ${
                              calculateDaysRemaining(membership.expiryDate) <= 7
                                ? 'bg-red-500/20 border-red-500/30'
                                : calculateDaysRemaining(membership.expiryDate) <= 15
                                ? 'bg-orange-500/20 border-orange-500/30'
                                : 'bg-green-500/20 border-green-500/30'
                            }`}>
                              <div className={`font-bold text-lg ${
                                calculateDaysRemaining(membership.expiryDate) <= 7
                                  ? 'text-red-600'
                                  : calculateDaysRemaining(membership.expiryDate) <= 15
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                              }`}>
                                {calculateDaysRemaining(membership.expiryDate)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                days remaining
                              </div>
                              <div className="text-xs text-muted-foreground/70 mt-1">
                                until {formatDateShort(membership.expiryDate)}
                              </div>
                            </div>
                          ) : membership.status === 'expired' ? (
                            <div className="text-center p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                              <div className="font-bold text-lg text-red-600">Expired</div>
                              <div className="text-xs text-muted-foreground">
                                {Math.abs(calculateDaysRemaining(membership.expiryDate))} days ago
                              </div>
                              <div className="text-xs text-muted-foreground/70 mt-1">
                                since {formatDateShort(membership.expiryDate)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center p-3 bg-muted border border-border rounded-lg">
                              <div className="text-muted-foreground text-sm font-medium">
                                Not Active
                              </div>
                              <div className="text-xs text-muted-foreground/70 mt-1">
                                Will start upon activation
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-2">
                            {(membership.status === 'payment_pending' || membership.status === 'pending') && (
                              <>
                                <button
                                  onClick={() => updateMembershipStatus(membership.id, 'active')}
                                  disabled={updatingId === membership.id}
                                  className="w-full bg-primary text-primary-foreground px-3 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {updatingId === membership.id ? 'Processing...' : '✅ Confirm Payment & Activate'}
                                </button>
                                <button
                                  onClick={() => updateMembershipStatus(membership.id, 'cancelled')}
                                  disabled={updatingId === membership.id}
                                  className="w-full bg-destructive text-destructive-foreground px-3 py-2 rounded text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
                                >
                                  ❌ Reject
                                </button>
                              </>
                            )}
                            {membership.status === 'active' && (
                              <div className="text-center text-sm text-muted-foreground bg-green-500/20 p-2 rounded border border-green-500/30">
                                ✅ Paid - Active
                              </div>
                            )}
                            {(membership.status === 'active') && membership.approvedBy && (
                              <div className="text-xs text-muted-foreground text-center">
                                Approved by: {membership.approvedBy}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Coach Bookings Tab */}
        {activeTab === 'coach-bookings' && (
          <div>
            <div className="bg-card rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Coach Session Bookings</h2>
                <p className="text-sm text-muted-foreground mt-1">Manage and verify coach session payments</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Client & Coach</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sessions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Payment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {coachBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div>
                              <div className="text-xs text-muted-foreground">Client:</div>
                              <div className="font-medium text-foreground">{booking.clientName || 'N/A'}</div>
                              <div className="text-sm text-muted-foreground">{booking.clientEmail}</div>
                              {booking.clientPhone && (
                                <div className="text-xs text-muted-foreground/70">{booking.clientPhone}</div>
                              )}
                            </div>
                            <div className="pt-2 border-t border-border">
                              <div className="text-xs text-muted-foreground">Coach:</div>
                              <div className="font-medium text-primary">{booking.coachName}</div>
                              <div className="text-xs text-muted-foreground">{booking.coachEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-foreground">
                              {booking.sessions.length} session{booking.sessions.length > 1 ? 's' : ''}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Total: {booking.totalHours} hour{booking.totalHours > 1 ? 's' : ''}
                            </div>
                            <div className="max-h-32 overflow-y-auto space-y-1 mt-2">
                              {booking.sessions.map((session, idx) => (
                                <div key={idx} className="text-xs bg-muted p-2 rounded">
                                  <div className="font-medium">{formatDateShort(session.date)}</div>
                                  <div className="text-muted-foreground">{session.time} • {session.duration}h</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {booking.paymentMethod === 'online' ? 'Credit Card' : 'Cash'}
                              </span>
                              <span className="text-sm font-medium capitalize">
                                {booking.paymentMethod}
                              </span>
                            </div>
                            <div className="text-lg font-bold text-green-600">₱{booking.totalPrice}</div>
                            {booking.paymentProof && (
                              <a
                                href={booking.paymentProof}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:text-primary/80 underline block mt-2"
                              >
                                View Payment Proof
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            booking.status === 'confirmed' ? 'bg-green-500/20 text-green-700 border-green-500/30' :
                            booking.status === 'paid' ? 'bg-purple-500/20 text-purple-700 border-purple-500/30' :
                            booking.status === 'pending_payment' ? 'bg-orange-500/20 text-orange-700 border-orange-500/30' :
                            booking.status === 'pending_confirmation' ? 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30' :
                            booking.status === 'cancelled' ? 'bg-red-500/20 text-red-700 border-red-500/30' :
                            booking.status === 'completed' ? 'bg-blue-500/20 text-blue-700 border-blue-500/30' :
                            'bg-gray-500/20 text-gray-700 border-gray-500/30'
                          }`}>
                            {booking.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDateShort(booking.createdAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col space-y-2">
                            {booking.status === 'pending_confirmation' && (
                              <>
                                <button
                                  onClick={() => updateCoachBookingStatus(booking.id, 'confirmed')}
                                  disabled={updatingId === booking.id}
                                  className="w-full bg-primary text-primary-foreground px-3 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {updatingId === booking.id ? 'Processing...' : '✅ Confirm Booking'}
                                </button>
                                <button
                                  onClick={() => updateCoachBookingStatus(booking.id, 'cancelled')}
                                  disabled={updatingId === booking.id}
                                  className="w-full bg-destructive text-destructive-foreground px-3 py-2 rounded text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
                                >
                                  ❌ Cancel
                                </button>
                              </>
                            )}

                            {booking.status === 'pending_payment' && (
                              <>
                                <button
                                  onClick={() => markAsPaidAndCreateSession(booking)}
                                  disabled={updatingId === booking.id}
                                  className="w-full bg-primary text-primary-foreground px-3 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {updatingId === booking.id ? 'Processing...' : '💰 Confirm Payment & Create Sessions'}
                                </button>
                                <button
                                  onClick={() => updateCoachBookingStatus(booking.id, 'cancelled')}
                                  disabled={updatingId === booking.id}
                                  className="w-full bg-destructive text-destructive-foreground px-3 py-2 rounded text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
                                >
                                  ❌ Cancel
                                </button>
                              </>
                            )}

                            {booking.status === 'confirmed' && (
                              <div className="text-center text-sm text-muted-foreground bg-green-500/20 p-2 rounded border border-green-500/30">
                                ✅ Confirmed - Awaiting Payment
                              </div>
                            )}

                            {booking.status === 'paid' && (
                              <>
                                <button
                                  onClick={() => updateCoachBookingStatus(booking.id, 'completed')}
                                  disabled={updatingId === booking.id}
                                  className="w-full bg-primary text-primary-foreground px-3 py-2 rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {updatingId === booking.id ? 'Processing...' : '✅ Mark as Completed'}
                                </button>
                                <div className="text-xs text-green-600 text-center bg-green-500/20 p-2 rounded border border-green-500/30">
                                  💰 Payment Confirmed - Sessions Created
                                </div>
                              </>
                            )}

                            {booking.status === 'completed' && (
                              <div className="text-center text-sm text-muted-foreground bg-blue-500/20 p-2 rounded border border-blue-500/30">
                                ✅ Completed
                              </div>
                            )}

                            {booking.status === 'cancelled' && (
                              <div className="text-center text-sm text-muted-foreground bg-red-500/20 p-2 rounded border border-red-500/30">
                                ❌ Cancelled
                              </div>
                            )}

                            {['confirmed', 'paid', 'completed'].includes(booking.status) && booking.approvedBy && (
                              <div className="text-xs text-muted-foreground text-center mt-1">
                                Approved by: {booking.approvedBy}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {coachBookings.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No coach bookings yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientManagement;