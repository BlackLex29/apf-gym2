
"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  updateDoc,
  doc,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Chatbot from "@/components/Chatbot";
import BookStudioForm from "../bookstudio/page";
import MonthlyMembershipForm from "../monthly/page";

// Type definitions
type MembershipStatus =
  | "active"
  | "pending"
  | "expired"
  | "cancelled"
  | "payment_pending";
type UserType = "regular" | "student";
type ActivityType = "modeling" | "dance" | "zumba";
type BookingStatus = "pending" | "confirmed" | "cancelled";

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

interface StudioBooking {
  id: string;
  bookingReference: string;
  activityType: ActivityType;
  date: string;
  timeSlot: string;
  duration: number;
  totalPrice: number;
  status: BookingStatus;
  createdAt: Timestamp;
  name: string;
  phone: string;
  participants: number;
  specialRequests: string;
}

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "admin" | "owner" | "client";
  emailVerified: boolean;
  createdAt: string;
}

// Props interfaces for tab components
interface OverviewTabProps {
  activeMembership: Membership | null;
  recentBookings: StudioBooking[];
  formatDate: (timestamp: Timestamp) => string;
  calculateDaysRemaining: (expiryDate: Timestamp) => number;
  calculateMembershipProgress: (
    startDate: Timestamp,
    expiryDate: Timestamp
  ) => number;
}

interface StatsTabProps {
  activeMembership: Membership | null;
  recentBookings: StudioBooking[];
  calculateDaysRemaining: (expiryDate: Timestamp) => number;
}

const ClientDashboard: React.FC = () => {
  const [activeMembership, setActiveMembership] = useState<Membership | null>(
    null
  );
  const [recentBookings, setRecentBookings] = useState<StudioBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expirationWarning, setExpirationWarning] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "studio" | "membership" | "bookings"
  >("overview");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  // Calculate days remaining
  const calculateDaysRemaining = useCallback(
    (expiryDate: Timestamp): number => {
      const now = new Date();
      const expiry = expiryDate.toDate();
      const diffTime = expiry.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return daysRemaining > 0 ? daysRemaining : 0;
    },
    []
  );

  // Check expiration warning
  const checkExpirationWarning = useCallback(
    (membership: Membership) => {
      const daysRemaining = calculateDaysRemaining(membership.expiryDate);

      if (daysRemaining <= 0) {
        setExpirationWarning(
          "❌ YOUR MEMBERSHIP HAS EXPIRED! Please renew to continue accessing gym facilities."
        );
      } else if (daysRemaining <= 3) {
        setExpirationWarning(
          `⚠️ URGENT: Your membership expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}! Renew now to avoid interruption.`
        );
      } else if (daysRemaining <= 7) {
        setExpirationWarning(
          `📅 Reminder: Your membership expires in ${daysRemaining} days. Consider renewing soon.`
        );
      } else if (daysRemaining <= 15) {
        setExpirationWarning(
          `ℹ️ Your membership has ${daysRemaining} days remaining. Plan your renewal.`
        );
      }
    },
    [calculateDaysRemaining]
  );

  // Update membership status in Firestore
  const updateMembershipStatus = async (
    membershipId: string,
    status: MembershipStatus
  ) => {
    try {
      const membershipRef = doc(db, "monthlyMemberships", membershipId);
      await updateDoc(membershipRef, {
        status: status,
      });

      setActiveMembership((prev) => (prev ? { ...prev, status } : null));
    } catch (error) {
      console.error("Error updating membership status:", error);
    }
  };

  // Calculate progress percentage for membership
  const calculateMembershipProgress = useCallback(
    (startDate: Timestamp, expiryDate: Timestamp): number => {
      const start = startDate.toDate().getTime();
      const expiry = expiryDate.toDate().getTime();
      const now = new Date().getTime();

      const totalDuration = expiry - start;
      const elapsed = now - start;

      const progress = (elapsed / totalDuration) * 100;
      return Math.min(Math.max(progress, 0), 100);
    },
    []
  );

  // Format date for display
  const formatDate = useCallback((timestamp: Timestamp): string => {
    return timestamp.toDate().toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Fetch client data automatically
  const fetchClientData = useCallback(async () => {
    setLoading(true);
    setExpirationWarning("");

    try {
      if (!currentUser?.email) {
        console.log("No user email available");
        setLoading(false);
        return;
      }

      const userEmail = currentUser.email;

      // Fetch active membership
      const membershipsRef = collection(db, "monthlyMemberships");
      const membershipQuery = query(
        membershipsRef,
        where("email", "==", userEmail.trim().toLowerCase())
      );

      const membershipSnapshot = await getDocs(membershipQuery);
      const memberships: Membership[] = [];

      membershipSnapshot.forEach((doc) => {
        memberships.push({ id: doc.id, ...doc.data() } as Membership);
      });

      // Get the most recent active membership
      const activeMembership =
        memberships
          .filter((m) => m.status === "active")
          .sort(
            (a, b) => b.expiryDate.toMillis() - a.expiryDate.toMillis()
          )[0] || null;

      setActiveMembership(activeMembership);

      // Check for expiration warning
      if (activeMembership) {
        checkExpirationWarning(activeMembership);
      }

      // Fetch recent studio bookings
      const bookingsRef = collection(db, "bookings");
      const bookingsQuery = query(
        bookingsRef,
        where("email", "==", userEmail.trim().toLowerCase()),
        orderBy("createdAt", "desc")
      );

      const bookingsSnapshot = await getDocs(bookingsQuery);
      const bookings: StudioBooking[] = [];

      bookingsSnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include studio bookings (not coach bookings)
        if (
          data.activityType &&
          ["modeling", "dance", "zumba"].includes(data.activityType)
        ) {
          bookings.push({ id: doc.id, ...data } as StudioBooking);
        }
      });

      // Sort by date (most recent first) and get confirmed/active bookings
      const sortedBookings = bookings
        .filter((booking) => booking.status === "confirmed")
        .slice(0, 5);

      setRecentBookings(sortedBookings);
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUser, checkExpirationWarning]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userDataFromFirestore = userDoc.data() as UserData;
            setUserData(userDataFromFirestore);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load data when user changes
  useEffect(() => {
    if (currentUser) {
      fetchClientData();
    }
  }, [currentUser, fetchClientData]);

  // Check membership expiration periodically
  useEffect(() => {
    const checkMembershipExpiration = () => {
      if (activeMembership && activeMembership.status === "active") {
        const now = new Date();
        const expiryDate = activeMembership.expiryDate.toDate();

        if (now > expiryDate) {
          updateMembershipStatus(activeMembership.id, "expired");
          setExpirationWarning(
            "❌ YOUR MEMBERSHIP HAS EXPIRED! Please renew to continue accessing gym facilities."
          );
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading your dashboard...</p>
          <p className="text-sm text-muted-foreground">
            Please wait while we fetch your data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-center">
            🏋️ Client Dashboard
          </h1>
          <p className="text-xl text-center text-muted-foreground mt-2">
            Welcome back{userData ? `, ${userData.firstName}` : ""}! Manage your
            fitness journey
          </p>

          {/* Navigation Tabs */}
          <div className="flex justify-center mt-6">
            <div className="bg-muted rounded-lg p-1 flex flex-wrap justify-center gap-1">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                  activeTab === "overview"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab("studio")}
                className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                  activeTab === "studio"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🎭 Book Studio
              </button>
              <button
                onClick={() => setActiveTab("membership")}
                className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                  activeTab === "membership"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                💳 Membership
              </button>
              <button
                onClick={() => setActiveTab("bookings")}
                className={`px-4 py-2 rounded-md font-medium transition-colors text-sm ${
                  activeTab === "bookings"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📅 My Bookings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expiration Warning Banner */}
      {expirationWarning && activeTab === "overview" && (
        <div
          className={`border-l-4 ${
            expirationWarning.includes("❌")
              ? "border-destructive bg-destructive/10"
              : expirationWarning.includes("⚠️")
                ? "border-yellow-500 bg-yellow-50"
                : expirationWarning.includes("📅")
                  ? "border-orange-500 bg-orange-50"
                  : "border-blue-500 bg-blue-50"
          }`}
        >
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>
                {expirationWarning.includes("❌")
                  ? "❌"
                  : expirationWarning.includes("⚠️")
                    ? "⚠️"
                    : expirationWarning.includes("📅")
                      ? "📅"
                      : "ℹ️"}
              </span>
              <span className="font-semibold">{expirationWarning}</span>
            </div>
            {activeMembership && (
              <button
                onClick={() => setActiveTab("membership")}
                className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md font-semibold hover:bg-destructive/90 transition-colors"
              >
                Renew Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === "overview" && (
          <OverviewTab
            activeMembership={activeMembership}
            recentBookings={recentBookings}
            formatDate={formatDate}
            calculateDaysRemaining={calculateDaysRemaining}
            calculateMembershipProgress={calculateMembershipProgress}
          />
        )}

        {activeTab === "studio" && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">🎭 Studio Booking</h2>
              <p className="text-muted-foreground">
                Book our studio for your practice sessions
              </p>
            </div>
            <BookStudioForm />
          </div>
        )}

        {activeTab === "membership" && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">💳 Gym Membership</h2>
              <p className="text-muted-foreground">
                Join our gym community with monthly membership
              </p>
            </div>
            <MonthlyMembershipForm />
          </div>
        )}

        {activeTab === "bookings" && (
          <BookingsTab
            recentBookings={recentBookings}
            activeMembership={activeMembership}
            formatDate={formatDate}
          />
        )}
      </div>

      {/* Chatbot Component */}
      <Chatbot />
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<OverviewTabProps> = ({
  activeMembership,
  recentBookings,
  formatDate,
  calculateDaysRemaining,
  calculateMembershipProgress,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Membership Status */}
      <div className="lg:col-span-2 space-y-8">
        {/* Membership Status Card */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold">📊 Membership Status</h2>
            {activeMembership && (
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  activeMembership.status === "active"
                    ? "bg-green-100 text-green-800"
                    : activeMembership.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {activeMembership.status.toUpperCase()}
              </span>
            )}
          </div>

          {activeMembership ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Membership ID
                  </label>
                  <p className="font-semibold">
                    {activeMembership.membershipId}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Name
                  </label>
                  <p className="font-semibold">
                    {activeMembership.firstName} {activeMembership.lastName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Membership Type
                  </label>
                  <p className="font-semibold">
                    {activeMembership.userType === "regular"
                      ? "Regular"
                      : "Student"}
                    {activeMembership.userType === "student" &&
                      activeMembership.studentId &&
                      ` (ID: ${activeMembership.studentId})`}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Monthly Fee
                  </label>
                  <p className="font-semibold text-green-600">
                    ₱{activeMembership.monthlyPrice.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Start Date
                  </label>
                  <p className="font-semibold">
                    {formatDate(activeMembership.startDate)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Expiry Date
                  </label>
                  <p className="font-semibold">
                    {formatDate(activeMembership.expiryDate)}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">Membership Progress</span>
                  <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
                    {calculateDaysRemaining(activeMembership.expiryDate)} days
                    remaining
                  </span>
                </div>
                <div className="w-full bg-background rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${calculateMembershipProgress(activeMembership.startDate, activeMembership.expiryDate)}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground mt-2">
                  <span>{formatDate(activeMembership.startDate)}</span>
                  <span>{formatDate(activeMembership.expiryDate)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🏋️</div>
              <h3 className="text-xl font-semibold mb-2">
                No Active Membership
              </h3>
              <p className="text-muted-foreground mb-4">
                You don&apos;t have an active gym membership yet.
              </p>
              <button className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors">
                Get Started with Monthly Membership
              </button>
            </div>
          )}
        </div>

        {/* Stats Card */}
        <StatsTab
          activeMembership={activeMembership}
          recentBookings={recentBookings}
          calculateDaysRemaining={calculateDaysRemaining}
        />
      </div>

      {/* Right Column - Bookings and Upcoming Sessions */}
      <div className="space-y-8">
        {/* Recent Bookings Card */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold">📅 Studio Bookings</h2>
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-semibold">
              {recentBookings.length} sessions
            </span>
          </div>

          {recentBookings.length > 0 ? (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-muted p-4 rounded-lg border-l-4 border-primary"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold capitalize">
                      {booking.activityType}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        booking.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : booking.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <strong>Date:</strong>{" "}
                      {new Date(booking.date).toLocaleDateString("en-PH")}
                    </div>
                    <div>
                      <strong>Time:</strong> {booking.timeSlot} (
                      {booking.duration} hour
                      {booking.duration > 1 ? "s" : ""})
                    </div>
                    <div>
                      <strong>Amount:</strong> ₱
                      {booking.totalPrice.toLocaleString()}
                    </div>
                    <div>
                      <strong>Participants:</strong> {booking.participants}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 font-mono">
                    Ref: {booking.bookingReference}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2">No Studio Bookings</h3>
              <p className="text-muted-foreground mb-4">
                You haven&apos;t made any studio bookings yet.
              </p>
              <button className="bg-muted text-foreground px-6 py-3 rounded-md font-semibold hover:bg-muted/80 transition-colors">
                Book a Studio Session
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold">⚡ Quick Actions</h2>
          </div>
          <div className="space-y-3">
            <button className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors text-left flex items-center gap-3">
              <span className="text-xl">🎭</span>
              Book Studio Session
            </button>
            <button className="w-full bg-green-600 text-white px-4 py-3 rounded-md font-semibold hover:bg-green-700 transition-colors text-left flex items-center gap-3">
              <span className="text-xl">💳</span>
              Renew Membership
            </button>
            <button className="w-full bg-blue-600 text-white px-4 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors text-left flex items-center gap-3">
              <span className="text-xl">📅</span>
              View All Bookings
            </button>
            <button className="w-full bg-orange-600 text-white px-4 py-3 rounded-md font-semibold hover:bg-orange-700 transition-colors text-left flex items-center gap-3">
              <span className="text-xl">👤</span>
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stats Tab Component
const StatsTab: React.FC<StatsTabProps> = ({
  activeMembership,
  recentBookings,
  calculateDaysRemaining,
}) => {
  const totalSpent = recentBookings.reduce(
    (sum, booking) => sum + booking.totalPrice,
    0
  );
  const hoursBooked = recentBookings.reduce(
    (sum, booking) => sum + booking.duration,
    0
  );

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex justify-between items-center mb-6 pb-4 border-b">
        <h2 className="text-2xl font-bold">📈 Your Fitness Stats</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted p-4 rounded-lg text-center">
          <div className="text-2xl mb-2">🏋️</div>
          <div className="text-2xl font-bold">
            {activeMembership
              ? calculateDaysRemaining(activeMembership.expiryDate)
              : 0}
          </div>
          <div className="text-sm text-muted-foreground">Days Remaining</div>
        </div>
        <div className="bg-muted p-4 rounded-lg text-center">
          <div className="text-2xl mb-2">💪</div>
          <div className="text-2xl font-bold">{recentBookings.length}</div>
          <div className="text-sm text-muted-foreground">Studio Sessions</div>
        </div>
        <div className="bg-muted p-4 rounded-lg text-center">
          <div className="text-2xl mb-2">⏱️</div>
          <div className="text-2xl font-bold">{hoursBooked}</div>
          <div className="text-sm text-muted-foreground">Hours Booked</div>
        </div>
        <div className="bg-muted p-4 rounded-lg text-center">
          <div className="text-2xl mb-2">💰</div>
          <div className="text-2xl font-bold">₱{totalSpent}</div>
          <div className="text-sm text-muted-foreground">Total Spent</div>
        </div>
      </div>
    </div>
  );
};

// Bookings Tab Component
interface BookingsTabProps {
  recentBookings: StudioBooking[];
  activeMembership: Membership | null;
  formatDate: (timestamp: Timestamp) => string;
}

const BookingsTab: React.FC<BookingsTabProps> = ({
  recentBookings,
  activeMembership,
  formatDate,
}) => {
  const upcomingBookings = recentBookings.filter(
    (booking) => new Date(booking.date) >= new Date()
  );

  const pastBookings = recentBookings.filter(
    (booking) => new Date(booking.date) < new Date()
  );

  return (
    <div className="space-y-8">
      {/* User Info Banner */}
      {activeMembership && (
        <div className="text-center">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 inline-block">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Your Booking History
            </h2>
            <p className="text-muted-foreground">
              Track all your studio sessions and memberships
            </p>
          </div>
        </div>
      )}

      {/* Upcoming Bookings */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">🕐 Upcoming Sessions</h2>

        {upcomingBookings.length > 0 ? (
          <div className="space-y-4">
            {upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between bg-muted p-4 rounded-lg border-l-4 border-green-500"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-primary text-primary-foreground px-3 py-2 rounded text-center min-w-16">
                    <div className="text-sm font-bold">
                      {new Date(booking.date).toLocaleDateString("en-PH", {
                        day: "numeric",
                      })}
                    </div>
                    <div className="text-xs">
                      {new Date(booking.date).toLocaleDateString("en-PH", {
                        month: "short",
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold capitalize text-lg">
                      {booking.activityType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {booking.timeSlot} • {booking.duration} hour
                      {booking.duration > 1 ? "s" : ""}
                    </div>
                    <div className="text-sm">
                      <strong>Participants:</strong> {booking.participants} •{" "}
                      <strong>Amount:</strong> ₱{booking.totalPrice}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      booking.status === "confirmed"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {booking.status.toUpperCase()}
                  </span>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {booking.bookingReference}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold mb-2">No Upcoming Sessions</h3>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any upcoming studio sessions.
            </p>
            <button className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-semibold hover:bg-primary/90 transition-colors">
              Book a Session Now
            </button>
          </div>
        )}
      </div>

      {/* Past Bookings */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6">📋 Past Sessions</h2>

        {pastBookings.length > 0 ? (
          <div className="space-y-3">
            {pastBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground min-w-24">
                    {new Date(booking.date).toLocaleDateString("en-PH")}
                  </div>
                  <div>
                    <div className="font-medium capitalize">
                      {booking.activityType}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {booking.timeSlot} • ₱{booking.totalPrice}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    booking.status === "confirmed"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🕒</div>
            <h3 className="text-xl font-semibold mb-2">No Past Sessions</h3>
            <p className="text-muted-foreground">
              Your past studio sessions will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
