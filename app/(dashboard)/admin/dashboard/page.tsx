"use client";
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Users, Calendar, TrendingUp, Bell, Dumbbell, Clock, DollarSign,
  Music, RefreshCw, Plus, X, Search, Filter
} from 'lucide-react';

// Define types based on Firestore structure
interface Stat {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend: 'up' | 'down';
}

interface Membership {
  id: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userType: 'regular' | 'student';
  monthlyPrice: number;
  startDate: Timestamp;
  expiryDate: Timestamp;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  paymentMethod: string;
  studentId?: string;
  createdAt: Timestamp;
}

interface StudioBooking {
  id: string;
  bookingReference: string;
  name: string;
  phone: string;
  activityType: string;
  date: string;
  timeSlot: string;
  duration: number;
  participants: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  specialRequests: string;
  createdAt: Timestamp;
}

interface CoachSession {
  id: string;
  bookingReference: string;
  name: string;
  email: string;
  phone: string;
  serviceType: string;
  date: string;
  timeSlot: string;
  duration: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  specialRequests: string;
  createdAt: Timestamp;
}

interface DashboardData {
  stats: Stat[];
  memberships: Membership[];
  studioBookings: StudioBooking[];
  coachSessions: CoachSession[];
  totalRevenue: number;
  totalMembers: number;
  totalBookings: number;
}

const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [user] = useState({ email: 'admin@gymschedpro.com' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'memberships' | 'bookings' | 'sessions'>('memberships');
  const [loading, setLoading] = useState(true);
  
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    stats: [
      {
        title: 'Total Members',
        value: '0',
        change: '+0%',
        icon: Users,
        color: 'bg-primary', // Using primary color
        trend: 'up'
      },
      {
        title: 'Active Memberships',
        value: '0',
        change: '+0%',
        icon: Calendar,
        color: 'bg-emerald-500', // Complementary green
        trend: 'up'
      },
      {
        title: 'Studio Bookings',
        value: '0',
        change: '+0%',
        icon: Music,
        color: 'bg-purple-500', // Keeping purple for variety
        trend: 'up'
      },
      {
        title: 'Coach Sessions',
        value: '0',
        change: '+0%',
        icon: Dumbbell,
        color: 'bg-orange-500', // Using orange theme
        trend: 'up'
      },
      {
        title: 'Total Revenue',
        value: '₱0',
        change: '+0%',
        icon: DollarSign,
        color: 'bg-green-500', // Green for money
        trend: 'up'
      }
    ],
    memberships: [],
    studioBookings: [],
    coachSessions: [],
    totalRevenue: 0,
    totalMembers: 0,
    totalBookings: 0
  });

  // Fetch data from Firestore
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch monthly memberships
      const membershipsSnapshot = await getDocs(
        query(collection(db, 'monthlyMemberships'), orderBy('createdAt', 'desc'))
      );
      const memberships = membershipsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Membership[];

      // Fetch studio bookings
      const studioBookingsSnapshot = await getDocs(
        query(collection(db, 'bookings'), orderBy('createdAt', 'desc'))
      );
      const studioBookings = studioBookingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudioBooking[];

      // Fetch coach sessions (assuming they're stored in 'coachSessions' collection)
      const coachSessionsSnapshot = await getDocs(
        query(collection(db, 'coachSessions'), orderBy('createdAt', 'desc'))
      );
      const coachSessions = coachSessionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CoachSession[];

      // Calculate stats
      const activeMemberships = memberships.filter(m => m.status === 'active').length;
      const totalStudioBookings = studioBookings.length;
      const totalCoachSessions = coachSessions.length;
      
      // Calculate total revenue
      const studioRevenue = studioBookings.reduce((sum, booking) => sum + booking.totalPrice, 0);
      const coachRevenue = coachSessions.reduce((sum, session) => sum + session.totalPrice, 0);
      const membershipRevenue = memberships
        .filter(m => m.status === 'active')
        .reduce((sum, membership) => sum + membership.monthlyPrice, 0);
      
      const totalRevenue = studioRevenue + coachRevenue + membershipRevenue;

      // Update dashboard data
      setDashboardData({
        stats: [
          {
            title: 'Total Members',
            value: memberships.length.toString(),
            change: '+12%',
            icon: Users,
            color: 'bg-primary',
            trend: 'up'
          },
          {
            title: 'Active Memberships',
            value: activeMemberships.toString(),
            change: '+8%',
            icon: Calendar,
            color: 'bg-emerald-500',
            trend: 'up'
          },
          {
            title: 'Studio Bookings',
            value: totalStudioBookings.toString(),
            change: '+15%',
            icon: Music,
            color: 'bg-purple-500',
            trend: 'up'
          },
          {
            title: 'Coach Sessions',
            value: totalCoachSessions.toString(),
            change: '+10%',
            icon: Dumbbell,
            color: 'bg-orange-500',
            trend: 'up'
          },
          {
            title: 'Total Revenue',
            value: `₱${totalRevenue.toLocaleString()}`,
            change: '+18%',
            icon: DollarSign,
            color: 'bg-green-500',
            trend: 'up'
          }
        ],
        memberships,
        studioBookings,
        coachSessions,
        totalRevenue,
        totalMembers: memberships.length,
        totalBookings: totalStudioBookings + totalCoachSessions
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update stats based on time range
  useEffect(() => {
    const updateStatsForTimeRange = () => {
      const baseStats = [...dashboardData.stats];
      
      switch (timeRange) {
        case 'today':
          // Use current data for today
          break;
        case 'week':
          // Simulate weekly growth
          baseStats[0].value = (parseInt(baseStats[0].value) + 5).toString();
          baseStats[1].value = (parseInt(baseStats[1].value) + 3).toString();
          baseStats[2].value = (parseInt(baseStats[2].value) + 8).toString();
          baseStats[3].value = (parseInt(baseStats[3].value) + 4).toString();
          baseStats[4].value = `₱${(dashboardData.totalRevenue * 1.2).toLocaleString()}`;
          break;
        case 'month':
          // Simulate monthly growth
          baseStats[0].value = (parseInt(baseStats[0].value) + 15).toString();
          baseStats[1].value = (parseInt(baseStats[1].value) + 12).toString();
          baseStats[2].value = (parseInt(baseStats[2].value) + 25).toString();
          baseStats[3].value = (parseInt(baseStats[3].value) + 18).toString();
          baseStats[4].value = `₱${(dashboardData.totalRevenue * 1.5).toLocaleString()}`;
          break;
      }
      
      setDashboardData(prev => ({
        ...prev,
        stats: baseStats
      }));
    };

    if (dashboardData.memberships.length > 0) {
      updateStatsForTimeRange();
    }
  }, [timeRange, dashboardData.memberships.length]);

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const filteredMemberships = dashboardData.memberships.filter(membership => {
    const fullName = `${membership.firstName} ${membership.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) ||
           membership.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           membership.userType.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredBookings = dashboardData.studioBookings.filter(booking => {
    const matchesSearch = 
      booking.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.activityType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false;
    const matchesStatus = filterStatus === 'all' || booking.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const filteredSessions = dashboardData.coachSessions.filter(session => {
    const matchesSearch = session.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         session.serviceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'confirmed': 
      case 'completed': 
        return 'bg-green-500/20 text-green-700 border border-green-500/30';
      case 'pending': 
        return 'bg-yellow-500/20 text-yellow-700 border border-yellow-500/30';
      case 'expired':
      case 'cancelled': 
        return 'bg-red-500/20 text-red-700 border border-red-500/30';
      default: 
        return 'bg-gray-500/20 text-gray-700 border border-gray-500/30';
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDisplayDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-bold">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Welcome, {user.email}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={fetchDashboardData}
                className="p-2 bg-muted rounded-lg hover:bg-accent transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as 'today' | 'week' | 'month')}
                className="bg-muted border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
              <button className="relative p-2 bg-muted rounded-lg hover:bg-accent transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          {dashboardData.stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="bg-card rounded-xl p-6 border hover:border-primary/50 transition-all hover:scale-105 transform duration-200">
                <div className="flex justify-between items-start mb-4">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <span className={`text-sm font-semibold ${stat.trend === 'up' ? 'text-green-600' : 'text-destructive'}`}>
                    {stat.change}
                  </span>
                </div>
                <h3 className="text-muted-foreground text-sm mb-1 text-center">{stat.title}</h3>
                <p className="text-3xl font-bold text-center">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Main Content Tabs */}
        <div className="bg-card rounded-xl p-6 border mb-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('memberships')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'memberships' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Memberships
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'bookings' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Studio Bookings
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  activeTab === 'sessions' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                Coach Sessions
              </button>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                >
                  <option value="all">All Status</option>
                  {activeTab === 'memberships' ? (
                    <>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="pending">Pending</option>
                    </>
                  ) : (
                    <>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Memberships Tab Content */}
          {activeTab === 'memberships' && (
            <div className="space-y-4">
              {filteredMemberships.map((membership) => (
                <div key={membership.id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-lg bg-primary">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{membership.firstName} {membership.lastName}</p>
                      <p className="text-sm text-muted-foreground">{membership.userType} Membership</p>
                      <p className="text-xs text-primary">
                        {formatDate(membership.startDate)} - {formatDate(membership.expiryDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">{membership.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(membership.status)}`}>
                      {membership.status}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">₱{membership.monthlyPrice.toLocaleString()}/month</p>
                    <p className="text-xs text-muted-foreground">Ref: {membership.membershipId}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Studio Bookings Tab Content */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-lg bg-purple-500">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{booking.name}</p>
                      <p className="text-sm text-muted-foreground">{booking.activityType}</p>
                      <p className="text-xs text-primary">{booking.duration} hours</p>
                      <p className="text-xs text-muted-foreground">{booking.participants} participants</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">{formatDisplayDate(booking.date)}</p>
                    <p className="text-xs text-muted-foreground">{booking.timeSlot}</p>
                    <p className="text-sm font-semibold text-green-600 mt-1">₱{booking.totalPrice.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Coach Sessions Tab Content */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {filteredSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-lg bg-orange-500">
                      <Dumbbell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold">{session.name}</p>
                      <p className="text-sm text-muted-foreground">{session.serviceType}</p>
                      <p className="text-xs text-primary">{session.duration} hours</p>
                      <p className="text-xs text-muted-foreground">{session.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(session.status)}`}>
                      {session.status}
                    </span>
                    <p className="text-sm text-muted-foreground mt-1">{formatDisplayDate(session.date)}</p>
                    <p className="text-xs text-muted-foreground">{session.timeSlot}</p>
                    <p className="text-sm font-semibold text-green-600 mt-1">₱{session.totalPrice.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl p-6 border text-center">
            <h3 className="text-lg font-semibold mb-4">Total Members</h3>
            <p className="text-4xl font-bold text-primary">{dashboardData.totalMembers}</p>
            <p className="text-sm text-muted-foreground mt-2">Registered members in the system</p>
          </div>
          
          <div className="bg-card rounded-xl p-6 border text-center">
            <h3 className="text-lg font-semibold mb-4">Total Bookings</h3>
            <p className="text-4xl font-bold text-purple-600">{dashboardData.totalBookings}</p>
            <p className="text-sm text-muted-foreground mt-2">Studio & Coach bookings</p>
          </div>
          
          <div className="bg-card rounded-xl p-6 border text-center">
            <h3 className="text-lg font-semibold mb-4">Total Revenue</h3>
            <p className="text-4xl font-bold text-green-600">₱{dashboardData.totalRevenue.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-2">Revenue generated this period</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;