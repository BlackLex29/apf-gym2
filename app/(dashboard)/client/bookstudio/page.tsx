"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Chatbot from "@/components/Chatbot";
import Swal from "sweetalert2";

// Type definitions
type ActivityType = "modeling" | "dance" | "zumba";
type TimeSlot = string;
type BookingStatus = "pending" | "confirmed" | "cancelled";

interface AppointmentFormData {
  name: string;
  phone: string;
  activityType: ActivityType;
  date: string;
  timeSlot: TimeSlot;
  duration: number;
  participants: number;
  specialRequests: string;
}

interface BookingRecord extends AppointmentFormData {
  id?: string;
  totalPrice: number;
  status: BookingStatus;
  createdAt: Timestamp;
  bookingReference: string;
  userId: string;
  email: string;
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

// Available time slots - UP TO 10 PM
const TIME_SLOTS: TimeSlot[] = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", 
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", 
  "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM",
  "08:00 PM", "09:00 PM", "10:00 PM"
];

// Activity configurations with pricing
const ACTIVITIES = {
  modeling: {
    name: "Modeling Practice",
    maxParticipants: 10,
    durations: [1, 2, 3],
    pricePerHour: 350,
    icon: "📸",
  },
  dance: {
    name: "Dance Practice",
    maxParticipants: 15,
    durations: [1, 2, 3, 4],
    pricePerHour: 350,
    icon: "💃",
  },
  zumba: {
    name: "Zumba Class",
    maxParticipants: 25,
    durations: [1, 2],
    pricePerHour: 350,
    icon: "🎵",
  },
};

const BookStudioForm: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [formData, setFormData] = useState<AppointmentFormData>({
    name: "",
    phone: "",
    activityType: "dance",
    date: "",
    timeSlot: TIME_SLOTS[0],
    duration: 1,
    participants: 1,
    specialRequests: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [temporarilyReservedSlots, setTemporarilyReservedSlots] = useState<Set<string>>(new Set());

  // Load current user and their data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userDataFromFirestore = userDoc.data() as UserData;
            setUserData(userDataFromFirestore);

            setFormData((prev) => ({
              ...prev,
              name: `${userDataFromFirestore.firstName} ${userDataFromFirestore.lastName}`,
            }));
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
      setIsLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  // Calculate total price
  const calculateTotalPrice = (): number => {
    const activity = ACTIVITIES[formData.activityType];
    return activity.pricePerHour * formData.duration;
  };

  // REAL-TIME availability monitoring for selected date - 1 SLOT PER HOUR
  useEffect(() => {
    if (!formData.date) {
      setAvailableSlots(TIME_SLOTS);
      setBookedSlots(new Set());
      return;
    }

    setIsCheckingAvailability(true);

    const bookingsRef = collection(db, "bookings");
    const q = query(
      bookingsRef,
      where("date", "==", formData.date),
      where("status", "in", ["pending", "confirmed"])
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const newBookedSlots = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const booking = doc.data() as BookingRecord;
        // BINAGO: ISANG SLOT LANG PER BOOKING - hindi na base sa duration
        newBookedSlots.add(booking.timeSlot);
      });

      setBookedSlots(newBookedSlots);
      
      // Calculate available slots by filtering out booked ones
      const available = TIME_SLOTS.filter((slot) => !newBookedSlots.has(slot));
      
      // Remove temporarily reserved slots from available slots
      const finalAvailableSlots = available.filter(slot => 
        !temporarilyReservedSlots.has(slot)
      );
      
      setAvailableSlots(finalAvailableSlots);

      // If current selected slot is no longer available, reset to first available slot
      if (!finalAvailableSlots.includes(formData.timeSlot) && finalAvailableSlots.length > 0) {
        setFormData((prev) => ({ ...prev, timeSlot: finalAvailableSlots[0] }));
      } else if (finalAvailableSlots.length === 0) {
        setFormData((prev) => ({ ...prev, timeSlot: "" }));
      }

      setIsCheckingAvailability(false);
    }, (error) => {
      console.error("Error in real-time availability:", error);
      setIsCheckingAvailability(false);
    });

    return () => unsubscribe();
  }, [formData.date, temporarilyReservedSlots]);

  // BAGONG FUNCTION: Temporarily reserve slot when user selects a time
  const handleTimeSlotSelect = (timeSlot: string) => {
    // BINAGO: ISANG SLOT LANG ang irereserve
    const slotsToReserve = new Set<string>();
    slotsToReserve.add(timeSlot);
    
    setTemporarilyReservedSlots(slotsToReserve);
    setFormData((prev) => ({ ...prev, timeSlot }));
  };

  // Generate booking reference
  const generateBookingReference = (): string => {
    const prefix = "STUDIO";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  // Format phone number to 11 digits and prevent letters
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    return digits.slice(0, 11);
  };

  // Handle phone number input with validation
  const handlePhoneInput = (value: string) => {
    const formattedPhone = formatPhoneNumber(value);
    setFormData((prev) => ({
      ...prev,
      phone: formattedPhone,
    }));
  };

  // Handle paste event for phone number to prevent non-digit characters
  const handlePhonePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digitsOnly = pastedText.replace(/\D/g, "").slice(0, 11);
    setFormData((prev) => ({
      ...prev,
      phone: digitsOnly,
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === "phone") {
      handlePhoneInput(value);
    } else if (name === "timeSlot") {
      // Use the new function for time slot selection
      handleTimeSlotSelect(value);
    } else {
      const newValue =
        name === "duration" || name === "participants"
          ? parseInt(value)
          : value;

      setFormData((prev) => ({
        ...prev,
        [name]: newValue,
      }));
    }
  };

  // Show success SweetAlert
  const showSuccessAlert = (bookingReference: string, totalPrice: number, timeSlot: string, date: string) => {
    Swal.fire({
      title: '🎉 Booking Successful!',
      html: `
        <div class="text-left">
          <p class="mb-2"><strong>Booking Reference:</strong> ${bookingReference}</p>
          <p class="mb-2"><strong>Time Slot:</strong> ${timeSlot} on ${date}</p>
          <p class="mb-2"><strong>Duration:</strong> ${formData.duration} hour${formData.duration > 1 ? 's' : ''}</p>
          <p class="mb-2"><strong>Total Amount:</strong> ₱${totalPrice}</p>
          <p class="mb-2"><strong>Status:</strong> <span class="text-yellow-600">Pending Confirmation</span></p>
          <p class="text-sm text-gray-600 mt-3">We will contact you within 24 hours to confirm your booking.</p>
          <p class="text-sm text-green-600 mt-2">✅ Your booking will appear in your dashboard shortly.</p>
        </div>
      `,
      icon: 'success',
      confirmButtonText: 'View Dashboard',
      confirmButtonColor: '#10B981',
      customClass: {
        popup: 'rounded-lg',
        confirmButton: 'px-6 py-2 rounded-lg'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = "/client/dashboard";
      }
    });
  };

  // Show error SweetAlert
  const showErrorAlert = (message: string) => {
    Swal.fire({
      title: '❌ Error',
      text: message,
      icon: 'error',
      confirmButtonText: 'Try Again',
      confirmButtonColor: '#EF4444',
      customClass: {
        popup: 'rounded-lg',
        confirmButton: 'px-6 py-2 rounded-lg'
      }
    });
  };

  // Show login required SweetAlert
  const showLoginAlert = () => {
    Swal.fire({
      title: '🔐 Login Required',
      text: 'Please log in to book a studio session.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Go to Login',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#3B82F6',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'rounded-lg',
        confirmButton: 'px-6 py-2 rounded-lg',
        cancelButton: 'px-6 py-2 rounded-lg'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = "/login";
      }
    });
  };

  // Handle form submission - 1 SLOT PER HOUR
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      showLoginAlert();
      return;
    }

    if (formData.phone.length !== 11) {
      showErrorAlert("Please enter a valid 11-digit phone number");
      return;
    }

    if (!formData.phone.startsWith('09')) {
      showErrorAlert("Phone number must start with '09'");
      return;
    }

    if (!formData.date) {
      showErrorAlert("Please select a date");
      return;
    }

    if (!formData.timeSlot) {
      showErrorAlert("Please select an available time slot");
      return;
    }

    // Check if selected slot is still available
    if (bookedSlots.has(formData.timeSlot)) {
      showErrorAlert("Sorry, this time slot was just booked by another user. Please select another available slot.");
      // Clear temporary reservation
      setTemporarilyReservedSlots(new Set());
      return;
    }

    setIsSubmitting(true);

    try {
      const totalPrice = calculateTotalPrice();
      const bookingReference = generateBookingReference();

      const bookingData: Omit<BookingRecord, "id"> = {
        ...formData,
        totalPrice,
        status: "pending" as BookingStatus,
        createdAt: Timestamp.now(),
        bookingReference,
        userId: currentUser.uid,
        email: currentUser.email || userData?.email || "",
      };

      // Final availability check before saving
      const finalCheckQuery = query(
        collection(db, "bookings"),
        where("date", "==", formData.date),
        where("status", "in", ["pending", "confirmed"])
      );
      
      const finalCheckSnapshot = await getDocs(finalCheckQuery);
      const finalBookedSlots = new Set<string>();
      
      finalCheckSnapshot.forEach((doc) => {
        const booking = doc.data() as BookingRecord;
        // BINAGO: ISANG SLOT LANG ang iche-check
        finalBookedSlots.add(booking.timeSlot);
      });

      // Check if our selected slot is still available
      if (finalBookedSlots.has(formData.timeSlot)) {
        showErrorAlert("Sorry, this time slot was just booked by another user. Please select another available slot.");
        setTemporarilyReservedSlots(new Set());
        setIsSubmitting(false);
        return;
      }

      // Save to Firestore
      const docRef = await addDoc(collection(db, "bookings"), bookingData);

      // Show success alert
      showSuccessAlert(bookingReference, totalPrice, formData.timeSlot, formData.date);

      // Reset form and clear temporary reservations
      setFormData({
        name: userData ? `${userData.firstName} ${userData.lastName}` : "",
        phone: "",
        activityType: "dance",
        date: "",
        timeSlot: TIME_SLOTS[0],
        duration: 1,
        participants: 1,
        specialRequests: "",
      });
      setTemporarilyReservedSlots(new Set());

      console.log("✅ BOOKING SUCCESSFUL - 1 SLOT RESERVED:");
      console.log("Time Slot:", formData.timeSlot);
      console.log("Duration:", formData.duration, "hours");
      console.log("Booking Reference:", bookingReference);
      
    } catch (error) {
      console.error("Error saving booking:", error);
      showErrorAlert("Error booking appointment. Please try again.");
      // Clear temporary reservation on error
      setTemporarilyReservedSlots(new Set());
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split("T")[0];
  };

  const currentActivity = ACTIVITIES[formData.activityType];
  const totalPrice = calculateTotalPrice();

  // Show loading state while fetching user data
  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Loading your information...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if user is not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-card border rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold mb-4">Login Required</h1>
            <p className="text-muted-foreground mb-6">
              Please log in to book studio sessions and access your account.
            </p>
            <button
              onClick={() => (window.location.href = "/login")}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-card rounded-full border mb-4">
              <span className="text-2xl">🎭</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Studio Booking
            </h1>
            <p className="text-xl text-muted-foreground">
              Book our studio for your practice sessions -{" "}
              <span className="font-semibold text-green-600">
                ₱350 per hour
              </span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Available time slots: 8:00 AM - 10:00 PM • One slot per hour
            </p>

            {/* User Info Banner */}
            {userData && (
              <div className="mt-4 bg-primary/5 border border-primary/20 rounded-lg p-4 inline-block">
                <p className="text-sm text-foreground">
                  <strong>Welcome back, {userData.firstName}!</strong> Your name has been pre-filled.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Real-time Availability Indicator */}
          {formData.date && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <span className="text-blue-600 text-lg mr-2">🔄</span>
                <div>
                  <p className="font-medium text-blue-800">Real-time Availability</p>
                  <p className="text-sm text-blue-600">
                    {isCheckingAvailability 
                      ? "Checking latest availability..." 
                      : `${availableSlots.length} time slots available on ${formData.date}`
                    }
                  </p>
                  {temporarilyReservedSlots.size > 0 && (
                    <p className="text-sm text-orange-600 mt-1">
                      ⚠️ <strong>Selected time slot is temporarily reserved</strong> - complete your booking within 5 minutes
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Card */}
          <div className="bg-card border rounded-lg p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3">
                    <span className="text-primary text-sm font-semibold">
                      1
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Personal Information
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-foreground"
                    >
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                      placeholder="Enter your full name"
                    />
                    {userData && (
                      <p className="text-xs text-green-600">
                        ✓ Pre-filled from your account
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-foreground"
                    >
                      Phone Number * (11 digits)
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      onPaste={handlePhonePaste}
                      required
                      maxLength={11}
                      pattern="[0-9]*"
                      inputMode="numeric"
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                      placeholder="09XXXXXXXXX"
                      title="Please enter 11-digit phone number starting with 09"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        Format: 09XXXXXXXXX
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          formData.phone.length === 11
                            ? "text-green-600"
                            : formData.phone.length > 0
                            ? "text-red-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {formData.phone.length}/11 digits
                      </p>
                    </div>
                    {formData.phone.length > 0 && !formData.phone.startsWith('09') && (
                      <p className="text-xs text-red-600">
                        ❌ Phone number must start with 09
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Details */}
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3">
                    <span className="text-primary text-sm font-semibold">
                      2
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Activity Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Activity Type */}
                  <div className="space-y-2">
                    <label
                      htmlFor="activityType"
                      className="block text-sm font-medium text-foreground"
                    >
                      Activity Type *
                    </label>
                    <div className="relative">
                      <select
                        id="activityType"
                        name="activityType"
                        value={formData.activityType}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none transition-all duration-200 text-foreground bg-background"
                      >
                        {Object.entries(ACTIVITIES).map(([key, activity]) => (
                          <option
                            key={key}
                            value={key}
                            className="text-foreground"
                          >
                            {activity.icon} {activity.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </div>
                    </div>
                    <p className="text-sm text-green-600 font-medium">
                      ₱{currentActivity.pricePerHour} per hour
                    </p>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <label
                      htmlFor="date"
                      className="block text-sm font-medium text-foreground"
                    >
                      Preferred Date *
                    </label>
                    <input
                      type="date"
                      id="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      required
                      min={getMinDate()}
                      max={getMaxDate()}
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                    />
                    {isCheckingAvailability && (
                      <p className="text-sm text-yellow-600 flex items-center">
                        <span className="animate-spin mr-1">⟳</span> Checking
                        availability...
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <label
                      htmlFor="duration"
                      className="block text-sm font-medium text-foreground"
                    >
                      Duration (hours) *
                    </label>
                    <div className="relative">
                      <select
                        id="duration"
                        name="duration"
                        value={formData.duration}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none transition-all duration-200 text-foreground bg-background"
                      >
                        {currentActivity.durations.map((duration) => (
                          <option
                            key={duration}
                            value={duration}
                            className="text-foreground"
                          >
                            {duration} hour{duration > 1 ? "s" : ""} (₱
                            {duration * 350})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Time Slot - 1 SLOT PER HOUR */}
                  <div className="space-y-2">
                    <label
                      htmlFor="timeSlot"
                      className="block text-sm font-medium text-foreground"
                    >
                      Time Slot * (1 slot per hour)
                    </label>
                    <div className="relative">
                      <select
                        id="timeSlot"
                        name="timeSlot"
                        value={formData.timeSlot}
                        onChange={handleInputChange}
                        required
                        disabled={availableSlots.length === 0 && formData.date !== ""}
                        className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent appearance-none transition-all duration-200 disabled:bg-muted disabled:cursor-not-allowed text-foreground bg-background"
                      >
                        {formData.date ? (
                          availableSlots.length > 0 ? (
                            availableSlots.map((slot) => {
                              const isTemporarilyReserved = temporarilyReservedSlots.has(slot);
                              
                              return (
                                <option
                                  key={slot}
                                  value={slot}
                                  className="text-foreground"
                                  disabled={isTemporarilyReserved && slot !== formData.timeSlot}
                                >
                                  {slot}
                                  {isTemporarilyReserved && " 🔒 TEMPORARILY RESERVED"}
                                </option>
                              );
                            })
                          ) : (
                            <option value="" className="text-foreground">
                              No available time slots
                            </option>
                          )
                        ) : (
                          TIME_SLOTS.map((slot) => (
                            <option
                              key={slot}
                              value={slot}
                              className="text-foreground"
                            >
                              {slot}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          ></path>
                        </svg>
                      </div>
                    </div>
                    {formData.date && availableSlots.length > 0 && (
                      <p className="text-sm text-green-600 font-medium">
                        {availableSlots.length} time slots available • One slot per hour
                      </p>
                    )}
                    {formData.date && availableSlots.length === 0 && (
                      <p className="text-sm text-red-600">
                        No available time slots for this date
                      </p>
                    )}
                    {temporarilyReservedSlots.size > 0 && (
                      <div className="p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                        <p className="text-orange-800 font-medium">
                          🔒 Temporarily Reserved Time Slot:
                        </p>
                        <p className="text-orange-700">
                          {Array.from(temporarilyReservedSlots).join(', ')}
                        </p>
                        <p className="text-orange-600 mt-1">
                          Complete your booking to permanently reserve this time slot
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Participants */}
                  <div className="space-y-2">
                    <label
                      htmlFor="participants"
                      className="block text-sm font-medium text-foreground"
                    >
                      Number of Participants *
                    </label>
                    <input
                      type="number"
                      id="participants"
                      name="participants"
                      value={formData.participants}
                      onChange={handleInputChange}
                      required
                      min="1"
                      max={currentActivity.maxParticipants}
                      className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                    />
                    <p className="text-sm text-muted-foreground">
                      Max: {currentActivity.maxParticipants} participants
                    </p>
                  </div>
                </div>

                {/* Price Summary */}
                <div className="mt-6 p-4 bg-muted rounded-lg border">
                  <h4 className="font-semibold text-foreground mb-3">
                    Price Summary
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {formData.duration} hour
                        {formData.duration > 1 ? "s" : ""} × ₱350
                      </span>
                      <span className="font-medium">₱{totalPrice}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-semibold text-foreground">
                        Total
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        ₱{totalPrice}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3">
                    <span className="text-primary text-sm font-semibold">
                      3
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Additional Information
                  </h2>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="specialRequests"
                    className="block text-sm font-medium text-foreground"
                  >
                    Special Requests or Equipment Needs
                  </label>
                  <textarea
                    id="specialRequests"
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Any special equipment, setup requirements, or additional notes..."
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (formData.date && availableSlots.length === 0) ||
                    formData.phone.length !== 11 ||
                    !formData.phone.startsWith('09') ||
                    !formData.timeSlot
                  }
                  className="w-full lg:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transform hover:scale-105 transition-all duration-200 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:transform-none text-lg"
                >
                  {isSubmitting ? (
                    <div className="flex items-center justify-center">
                      <span className="animate-spin mr-2">⟳</span>
                      Processing Booking...
                    </div>
                  ) : (
                    `Book Now - ₱${totalPrice}`
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Need help? Contact us at{" "}
              <span className="text-primary">support@gymschedpro.com</span> or
              call <span className="text-primary">+63 917 123 4567</span>
            </p>
            <p className="mt-2 text-xs">
              💡 <strong>One Slot Per Hour:</strong> Each booking reserves one time slot only, regardless of duration
            </p>
          </div>
        </div>
      </div>

      {/* Chatbot Component */}
      <Chatbot />
    </div>
  );
};

export default BookStudioForm;