"use client";
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Chatbot from "@/components/Chatbot";

// Type definitions
type MembershipStatus = 'active' | 'pending' | 'expired' | 'cancelled';
type UserType = 'regular' | 'student';

interface Membership {
  id: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userType: UserType;
  monthlyPrice: number;
  startDate: Timestamp;
  expiryDate: Timestamp;
  status: MembershipStatus;
  paymentMethod: string;
  studentId?: string;
  createdAt: Timestamp;
}

interface Booking {
  id: string;
  bookingReference: string;
  activityType: string;
  date: string;
  timeSlot: string;
  duration: number;
  totalPrice: number;
  status: string;
  createdAt: Timestamp;
}

const ClientDashboard: React.FC = () => {
  const [activeMembership, setActiveMembership] = useState<Membership | null>(null);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expirationWarning, setExpirationWarning] = useState<string>('');

  // Calculate days remaining
  const calculateDaysRemaining = (expiryDate: Timestamp): number => {
    const now = new Date();
    const expiry = expiryDate.toDate();
    const diffTime = expiry.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 ? daysRemaining : 0;
  };

  // Check expiration warning
  const checkExpirationWarning = (membership: Membership) => {
    const daysRemaining = calculateDaysRemaining(membership.expiryDate);
    
    if (daysRemaining <= 0) {
      setExpirationWarning('❌ YOUR MEMBERSHIP HAS EXPIRED! Please renew to continue accessing gym facilities.');
    } else if (daysRemaining <= 3) {
      setExpirationWarning(`⚠️ URGENT: Your membership expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}! Renew now to avoid interruption.`);
    } else if (daysRemaining <= 7) {
      setExpirationWarning(`📅 Reminder: Your membership expires in ${daysRemaining} days. Consider renewing soon.`);
    } else if (daysRemaining <= 15) {
      setExpirationWarning(`ℹ️ Your membership has ${daysRemaining} days remaining. Plan your renewal.`);
    }
  };

  // Update membership status in Firestore
  const updateMembershipStatus = async (membershipId: string, status: MembershipStatus) => {
    try {
      const membershipRef = doc(db, 'monthlyMemberships', membershipId);
      await updateDoc(membershipRef, {
        status: status
      });
      
      setActiveMembership(prev => prev ? { ...prev, status } : null);
    } catch (error) {
      console.error('Error updating membership status:', error);
    }
  };

  // Calculate progress percentage for membership
  const calculateMembershipProgress = (startDate: Timestamp, expiryDate: Timestamp): number => {
    const start = startDate.toDate().getTime();
    const expiry = expiryDate.toDate().getTime();
    const now = new Date().getTime();
    
    const totalDuration = expiry - start;
    const elapsed = now - start;
    
    const progress = (elapsed / totalDuration) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  // Format date for display
  const formatDate = (timestamp: Timestamp): string => {
    return timestamp.toDate().toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get expiration status color
  const getExpirationColor = (daysRemaining: number): string => {
    if (daysRemaining <= 0) return '#dc3545'; // Red for expired
    if (daysRemaining <= 3) return '#ffc107'; // Yellow for urgent
    if (daysRemaining <= 7) return '#fd7e14'; // Orange for warning
    return '#28a745'; // Green for good
  };

  // Fetch client data automatically
  const fetchClientData = async () => {
    setLoading(true);
    setExpirationWarning('');
    
    try {
      // Dito ay kailangan mong palitan ang email na ito 
      // base sa authenticated user o kung paano mo kukunin ang current user
      const userEmail = "user@example.com"; // PALITAN ITO NG ACTUAL USER EMAIL
      
      console.log('Fetching data for email:', userEmail);
      
      // Fetch active membership
      const membershipsRef = collection(db, 'monthlyMemberships');
      const membershipQuery = query(
        membershipsRef,
        where('email', '==', userEmail.trim().toLowerCase())
      );
      
      const membershipSnapshot = await getDocs(membershipQuery);
      const memberships: Membership[] = [];
      
      membershipSnapshot.forEach((doc) => {
        console.log('Found membership:', doc.data());
        memberships.push({ id: doc.id, ...doc.data() } as Membership);
      });

      // Get the most recent active membership
      const activeMembership = memberships
        .filter(m => m.status === 'active')
        .sort((a, b) => b.expiryDate.toMillis() - a.expiryDate.toMillis())[0] || null;

      console.log('Active membership:', activeMembership);
      setActiveMembership(activeMembership);

      // Check for expiration warning
      if (activeMembership) {
        checkExpirationWarning(activeMembership);
      }

      // Fetch recent bookings
      const bookingsRef = collection(db, 'bookings');
      const bookingsQuery = query(
        bookingsRef,
        where('email', '==', userEmail.trim().toLowerCase())
      );
      
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookings: Booking[] = [];
      
      bookingsSnapshot.forEach((doc) => {
        console.log('Found booking:', doc.data());
        bookings.push({ id: doc.id, ...doc.data() } as Booking);
      });

      // Sort by date (most recent first) and get confirmed/active bookings
      const sortedBookings = bookings
        .filter(booking => ['confirmed', 'active', 'completed'].includes(booking.status))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      console.log('Recent bookings:', sortedBookings);
      setRecentBookings(sortedBookings);

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check expiration on component mount
  useEffect(() => {
    fetchClientData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check membership expiration periodically
  useEffect(() => {
    const checkMembershipExpiration = () => {
      if (activeMembership && activeMembership.status === 'active') {
        const now = new Date();
        const expiryDate = activeMembership.expiryDate.toDate();
        
        if (now > expiryDate) {
          updateMembershipStatus(activeMembership.id, 'expired');
          setExpirationWarning('❌ YOUR MEMBERSHIP HAS EXPIRED! Please renew to continue accessing gym facilities.');
        }
      }
    };

    if (activeMembership) {
      checkMembershipExpiration();
      // Check every hour for expiration
      const interval = setInterval(checkMembershipExpiration, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [activeMembership]);

  // Show loading state
  if (loading) {
    return (
      <div className="client-dashboard">
        <div className="dashboard-header">
          <h1>🏋️ Client Dashboard</h1>
          <p>Manage your membership and studio bookings</p>
        </div>
        
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p className="loading-text">Loading your dashboard...</p>
          <p className="loading-subtext">Please wait while we fetch your data</p>
        </div>

        <style jsx>{`
          .client-dashboard {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .dashboard-header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 2rem;
            border-bottom: 3px solid #007bff;
          }

          .dashboard-header h1 {
            color: #333;
            margin-bottom: 0.5rem;
            font-size: 2.5rem;
          }

          .dashboard-header p {
            color: #666;
            font-size: 1.2rem;
            margin-bottom: 2rem;
          }

          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 50vh;
            text-align: center;
          }

          .loading-spinner-large {
            width: 80px;
            height: 80px;
            border: 6px solid #f3f3f3;
            border-top: 6px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 2rem;
          }

          .loading-text {
            font-size: 1.5rem;
            color: #333;
            margin-bottom: 0.5rem;
            font-weight: 600;
          }

          .loading-subtext {
            font-size: 1rem;
            color: #666;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="client-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>🏋️ Client Dashboard</h1>
        <p>Welcome back! Here&apos;s your membership and booking information</p>
      </div>

      {/* Expiration Warning Banner */}
      {expirationWarning && (
        <div className={`expiration-warning ${
          expirationWarning.includes('❌') ? 'expired' :
          expirationWarning.includes('⚠️') ? 'urgent' :
          expirationWarning.includes('📅') ? 'warning' : 'info'
        }`}>
          <div className="warning-content">
            <span className="warning-icon">
              {expirationWarning.includes('❌') ? '❌' :
               expirationWarning.includes('⚠️') ? '⚠️' :
               expirationWarning.includes('📅') ? '📅' : 'ℹ️'}
            </span>
            <span className="warning-text">{expirationWarning}</span>
          </div>
          {activeMembership && (
            <button className="renew-now-btn">
              Renew Now
            </button>
          )}
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Membership Status Card */}
        <div className="dashboard-card membership-card">
          <div className="card-header">
            <h2>📊 Membership Status</h2>
            {activeMembership && (
              <span className={`status-badge ${activeMembership.status}`}>
                {activeMembership.status.toUpperCase()}
              </span>
            )}
          </div>

          {activeMembership ? (
            <div className="membership-content">
              <div className="membership-info">
                <div className="info-row">
                  <span className="label">Membership ID:</span>
                  <span className="value">{activeMembership.membershipId}</span>
                </div>
                <div className="info-row">
                  <span className="label">Name:</span>
                  <span className="value">{activeMembership.firstName} {activeMembership.lastName}</span>
                </div>
                <div className="info-row">
                  <span className="label">Membership Type:</span>
                  <span className="value">
                    {activeMembership.userType === 'regular' ? 'Regular' : 'Student'} 
                    {activeMembership.userType === 'student' && activeMembership.studentId && 
                      ` (ID: ${activeMembership.studentId})`
                    }
                  </span>
                </div>
                <div className="info-row">
                  <span className="label">Monthly Fee:</span>
                  <span className="value price">₱{activeMembership.monthlyPrice.toLocaleString()}</span>
                </div>
                <div className="info-row">
                  <span className="label">Start Date:</span>
                  <span className="value">{formatDate(activeMembership.startDate)}</span>
                </div>
                <div className="info-row">
                  <span className="label">Expiry Date:</span>
                  <span className="value expiry-date" style={{ 
                    color: getExpirationColor(calculateDaysRemaining(activeMembership.expiryDate))
                  }}>
                    {formatDate(activeMembership.expiryDate)}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-section">
                <div className="progress-header">
                  <span>Membership Progress</span>
                  <span 
                    className="days-remaining"
                    style={{ 
                      backgroundColor: getExpirationColor(calculateDaysRemaining(activeMembership.expiryDate))
                    }}
                  >
                    {calculateDaysRemaining(activeMembership.expiryDate)} days remaining
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${calculateMembershipProgress(activeMembership.startDate, activeMembership.expiryDate)}%`,
                      backgroundColor: getExpirationColor(calculateDaysRemaining(activeMembership.expiryDate))
                    }}
                  ></div>
                </div>
                <div className="progress-dates">
                  <span>{formatDate(activeMembership.startDate)}</span>
                  <span>{formatDate(activeMembership.expiryDate)}</span>
                </div>
              </div>

              {/* Expiration Countdown */}
              <div className="expiration-countdown">
                <h3>⏰ Membership Countdown</h3>
                <div className="countdown-grid">
                  <div className="countdown-item">
                    <div className="countdown-value">{calculateDaysRemaining(activeMembership.expiryDate)}</div>
                    <div className="countdown-label">Days</div>
                  </div>
                  <div className="countdown-item">
                    <div className="countdown-value">
                      {Math.ceil((calculateDaysRemaining(activeMembership.expiryDate) * 24) % 24)}
                    </div>
                    <div className="countdown-label">Hours</div>
                  </div>
                  <div className="countdown-item">
                    <div className="countdown-value">
                      {Math.ceil((calculateDaysRemaining(activeMembership.expiryDate) * 24 * 60) % 60)}
                    </div>
                    <div className="countdown-label">Minutes</div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <h3>Quick Actions</h3>
                <div className="action-buttons">
                  <button className="action-btn renew-btn">
                    🔄 Renew Membership
                  </button>
                  <button className="action-btn upgrade-btn">
                    ⬆️ Upgrade Plan
                  </button>
                  <button className="action-btn details-btn">
                    📋 View Details
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-membership">
              <div className="no-data-icon">🏋️</div>
              <h3>No Active Membership</h3>
              <p>You don&apos;t have an active gym membership yet.</p>
              <button className="cta-button">
                Get Started with Monthly Membership
              </button>
            </div>
          )}
        </div>

        {/* Recent Bookings Card */}
        <div className="dashboard-card bookings-card">
          <div className="card-header">
            <h2>📅 Studio Bookings</h2>
            <span className="bookings-count">{recentBookings.length} sessions</span>
          </div>

          {recentBookings.length > 0 ? (
            <div className="bookings-list">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="booking-item">
                  <div className="booking-header">
                    <span className="activity-type">{booking.activityType}</span>
                    <span className={`booking-status ${booking.status.toLowerCase()}`}>
                      {booking.status}
                    </span>
                  </div>
                  <div className="booking-details">
                    <div className="booking-date">
                      <strong>Date:</strong> {new Date(booking.date).toLocaleDateString('en-PH')}
                    </div>
                    <div className="booking-time">
                      <strong>Time:</strong> {booking.timeSlot} ({booking.duration} hour{booking.duration > 1 ? 's' : ''})
                    </div>
                    <div className="booking-price">
                      <strong>Amount:</strong> ₱{booking.totalPrice.toLocaleString()}
                    </div>
                  </div>
                  <div className="booking-reference">
                    Ref: {booking.bookingReference}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-bookings">
              <div className="no-data-icon">📅</div>
              <h3>No Studio Bookings</h3>
              <p>You haven&apos;t made any studio bookings yet.</p>
              <button className="cta-button secondary">
                Book a Studio Session
              </button>
            </div>
          )}
        </div>

        {/* Quick Stats Card */}
        <div className="dashboard-card stats-card">
          <div className="card-header">
            <h2>📈 Quick Stats</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-icon">🏋️</div>
              <div className="stat-info">
                <div 
                  className="stat-value"
                  style={{ color: getExpirationColor(activeMembership ? calculateDaysRemaining(activeMembership.expiryDate) : 0) }}
                >
                  {activeMembership ? calculateDaysRemaining(activeMembership.expiryDate) : 0}
                </div>
                <div className="stat-label">Days Remaining</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">💪</div>
              <div className="stat-info">
                <div className="stat-value">{recentBookings.length}</div>
                <div className="stat-label">Studio Sessions</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">💰</div>
              <div className="stat-info">
                <div className="stat-value">
                  ₱{activeMembership?.monthlyPrice.toLocaleString() || 0}
                </div>
                <div className="stat-label">Monthly Fee</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">⭐</div>
              <div className="stat-info">
                <div className="stat-value">
                  {activeMembership?.userType === 'student' ? 'Student' : 'Regular'}
                </div>
                <div className="stat-label">Plan Type</div>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Sessions Card */}
        <div className="dashboard-card upcoming-card">
          <div className="card-header">
            <h2>🕐 Upcoming Sessions</h2>
          </div>
          <div className="upcoming-sessions">
            {recentBookings
              .filter(booking => {
                const bookingDate = new Date(booking.date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return bookingDate >= today && booking.status === 'confirmed';
              })
              .slice(0, 3)
              .map((booking) => (
                <div key={booking.id} className="upcoming-item">
                  <div className="upcoming-date">
                    {new Date(booking.date).toLocaleDateString('en-PH', { 
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="upcoming-details">
                    <div className="upcoming-activity">{booking.activityType}</div>
                    <div className="upcoming-time">{booking.timeSlot}</div>
                  </div>
                  <button className="upcoming-action">
                    View
                  </button>
                </div>
              ))
            }
            {recentBookings.filter(booking => {
              const bookingDate = new Date(booking.date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return bookingDate >= today && booking.status === 'confirmed';
            }).length === 0 && (
              <div className="no-upcoming">
                <p>No upcoming studio sessions</p>
                <button className="cta-button secondary">
                  Book Studio Session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chatbot Component */}
      <Chatbot />

      <style jsx>{`
        .client-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .dashboard-header {
          text-align: center;
          margin-bottom: 3rem;
          padding-bottom: 2rem;
          border-bottom: 3px solid #007bff;
        }

        .dashboard-header h1 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 2.5rem;
        }

        .dashboard-header p {
          color: #666;
          font-size: 1.2rem;
          margin-bottom: 2rem;
        }

        /* Expiration Warning Styles */
        .expiration-warning {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          margin-bottom: 2rem;
          font-weight: 600;
        }

        .expiration-warning.expired {
          background: #f8d7da;
          color: #721c24;
          border: 2px solid #f5c6cb;
        }

        .expiration-warning.urgent {
          background: #fff3cd;
          color: #856404;
          border: 2px solid #ffeaa7;
        }

        .expiration-warning.warning {
          background: #ffe5d0;
          color: #fd7e14;
          border: 2px solid #ffc107;
        }

        .expiration-warning.info {
          background: #d1ecf1;
          color: #0c5460;
          border: 2px solid #bee5eb;
        }

        .warning-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .warning-icon {
          font-size: 1.2rem;
        }

        .warning-text {
          font-size: 1rem;
        }

        .renew-now-btn {
          background: #dc3545;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
          white-space: nowrap;
        }

        .renew-now-btn:hover {
          background: #c82333;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          grid-template-rows: auto auto;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .dashboard-card {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 2px solid #e9ecef;
        }

        .membership-card {
          grid-column: 1;
          grid-row: 1;
        }

        .bookings-card {
          grid-column: 2;
          grid-row: 1;
        }

        .stats-card {
          grid-column: 1;
          grid-row: 2;
        }

        .upcoming-card {
          grid-column: 2;
          grid-row: 2;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e9ecef;
        }

        .card-header h2 {
          color: #333;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .status-badge {
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .status-badge.active {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.pending {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.expired {
          background: #f8d7da;
          color: #721c24;
        }

        .bookings-count {
          background: #007bff;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 15px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        /* Membership Card Styles */
        .membership-content {
          space-y: 2rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #f8f9fa;
        }

        .info-row .label {
          font-weight: 600;
          color: #555;
        }

        .info-row .value {
          color: #333;
        }

        .info-row .price {
          color: #28a745;
          font-weight: bold;
        }

        .info-row .expiry-date {
          font-weight: bold;
        }

        .progress-section {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .days-remaining {
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 15px;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .progress-bar {
          width: 100%;
          height: 10px;
          background: #e9ecef;
          border-radius: 5px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .progress-dates {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: #666;
        }

        /* Expiration Countdown */
        .expiration-countdown {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          text-align: center;
        }

        .expiration-countdown h3 {
          margin-bottom: 1rem;
          color: #333;
        }

        .countdown-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .countdown-item {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .countdown-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #007bff;
        }

        .countdown-label {
          font-size: 0.875rem;
          color: #666;
          margin-top: 0.25rem;
        }

        .quick-actions {
          margin-top: 1.5rem;
        }

        .quick-actions h3 {
          margin-bottom: 1rem;
          color: #333;
        }

        .action-buttons {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.75rem 1rem;
          border: 2px solid #007bff;
          background: white;
          color: #007bff;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
          flex: 1;
          min-width: 120px;
        }

        .action-btn:hover {
          background: #007bff;
          color: white;
        }

        /* No Data States */
        .no-membership,
        .no-bookings,
        .no-upcoming {
          text-align: center;
          padding: 2rem;
          color: #666;
        }

        .no-data-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .cta-button {
          background: #007bff;
          color: white;
          padding: 1rem 2rem;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 1rem;
        }

        .cta-button.secondary {
          background: #6c757d;
        }

        .cta-button:hover {
          opacity: 0.9;
        }

        /* Bookings List */
        .bookings-list {
          space-y: 1rem;
        }

        .booking-item {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }

        .booking-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .activity-type {
          font-weight: 600;
          color: #333;
          text-transform: capitalize;
        }

        .booking-status {
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .booking-status.confirmed {
          background: #d4edda;
          color: #155724;
        }

        .booking-status.active {
          background: #d1ecf1;
          color: #0c5460;
        }

        .booking-status.completed {
          background: #e2e3e5;
          color: #383d41;
        }

        .booking-details {
          font-size: 0.9rem;
          color: #555;
          margin-bottom: 0.5rem;
        }

        .booking-reference {
          font-size: 0.8rem;
          color: #999;
          font-family: monospace;
        }

        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .stat-icon {
          font-size: 2rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .stat-label {
          color: #666;
          font-size: 0.9rem;
        }

        /* Upcoming Sessions */
        .upcoming-sessions {
          space-y: 1rem;
        }

        .upcoming-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .upcoming-date {
          background: #007bff;
          color: white;
          padding: 0.5rem;
          border-radius: 6px;
          text-align: center;
          min-width: 80px;
          font-weight: 600;
        }

        .upcoming-details {
          flex: 1;
        }

        .upcoming-activity {
          font-weight: 600;
          color: #333;
        }

        .upcoming-time {
          color: #666;
          font-size: 0.9rem;
        }

        .upcoming-action {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .client-dashboard {
            padding: 1rem;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }

          .membership-card,
          .bookings-card,
          .stats-card,
          .upcoming-card {
            grid-column: 1;
          }

          .membership-card { grid-row: 1; }
          .bookings-card { grid-row: 2; }
          .stats-card { grid-row: 3; }
          .upcoming-card { grid-row: 4; }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .action-buttons {
            flex-direction: column;
          }

          .info-row {
            flex-direction: column;
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ClientDashboard;