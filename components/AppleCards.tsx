"use client";
import { Carousel, Card } from "@/components/ui/apple-cards-carousel";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebaseConfig";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import {
  Calendar,
  DollarSign,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  PlayCircle,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import { useState, useEffect } from "react";

interface BookingSession {
  date: string;
  time: string;
  duration: number;
}

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: "gym" | "karate" | "boxing" | "zumba";
  yearsOfTeaching: number;
  images: string[];
  gymMotto: string;
  status: "active" | "inactive";
  dateCreated: string;
  authUid: string;
}

interface CoachSchedule {
  coachId: string;
  availableSlots: string[]; // Array of date strings in "YYYY-MM-DD" format
}

interface ClientBooking {
  id: string;
  coachId: string;
  coachName: string;
  clientEmail: string;
  sessions: BookingSession[];
  totalSessions: number;
  totalPrice: number;
  paymentMethod: "cash" | "online";
  status:
    | "pending_confirmation"
    | "pending_payment"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "in_progress";
  createdAt: {
    toDate: () => Date;
  };
  approvedBy?: string;
  startedAt?: {
    toDate: () => Date;
  };
  completedAt?: {
    toDate: () => Date;
  };
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

const getOptimizedImageUrl = (
  imageUrl: string,
  width = 1200,
  height = 900
): string => {
  if (!imageUrl || !imageUrl.includes("cloudinary.com")) {
    return "https://via.placeholder.com/1200x900.png?text=No+Image";
  }
  const parts = imageUrl.split("/upload/");
  if (parts.length < 2) return imageUrl;
  return `${parts[0]}/upload/c_fill,w_${width},h_${height},q_auto,f_auto,g_auto/${parts[1]}`;
};

// Format currency function with proper peso sign
const formatCurrency = (amount: number): string => {
  return `₱${amount.toLocaleString('en-PH')}`;
};

const CoachContent = ({ coach }: { coach: Coach }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth()
  );
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<BookingSession[]>(
    []
  );
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    "cash" | "online"
  >("cash"); // Changed default to "cash"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [coachSchedules, setCoachSchedules] = useState<CoachSchedule[]>([]);
  const [bookedSlots, setBookedSlots] = useState<
    { date: string; time: string }[]
  >([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Load current user and their data
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
      setIsLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch coach schedules
  useEffect(() => {
    const q = query(collection(db, "coachSchedules"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schedules: CoachSchedule[] = snapshot.docs.map((doc) => ({
        coachId: doc.id,
        availableSlots: doc.data().availableSlots || [],
      }));
      setCoachSchedules(schedules);
    });
    return () => unsubscribe();
  }, []);

  // Fetch all bookings for this coach to check availability
  useEffect(() => {
    const q = query(
      collection(db, "bookings"),
      where("coachId", "==", coach.id),
      where("status", "in", [
        "pending_confirmation",
        "confirmed",
        "in_progress",
      ])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const slots: { date: string; time: string }[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.sessions) {
          data.sessions.forEach((session: BookingSession) => {
            slots.push({ date: session.date, time: session.time });
          });
        }
      });
      setBookedSlots(slots);
    });
    return () => unsubscribe();
  }, [coach.id]);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month, 1).toLocaleString("default", {
      month: "long",
    });
  };

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();

  // Updated time slots based on requirements
  const timeSlots = [
    { label: "6:00 AM - 8:00 AM", start: "06:00", end: "08:00" },
    { label: "9:00 AM - 11:00 AM", start: "09:00", end: "11:00" },
    { label: "12:00 PM - 2:00 PM", start: "12:00", end: "14:00" },
    { label: "3:00 PM - 5:00 PM", start: "15:00", end: "17:00" },
    { label: "6:00 PM - 8:00 PM", start: "18:00", end: "20:00" },
    { label: "9:00 PM - 10:00 PM", start: "21:00", end: "22:00" },
  ];

  // Check if a specific date is available for the coach
  const isDateAvailable = (day: number): boolean => {
    if (coach.specialty === "karate") {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const coachSchedule = coachSchedules.find(
        (schedule) => schedule.coachId === coach.id
      );
      return coachSchedule
        ? coachSchedule.availableSlots.includes(dateStr)
        : false;
    }
    return true; // Gym coaches are always available
  };

  const handleDaySelect = (day: number) => {
    const today = new Date();
    const selectedDate = new Date(selectedYear, selectedMonth, day);
    const isPast =
      selectedDate <
      new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (!isPast && (coach.specialty === "gym" || isDateAvailable(day))) {
      setSelectedDay(day);
      setSelectedTimeSlot(null); // Reset time slot when day changes
      setSelectedSessions([]); // Clear all sessions when day changes
    }
  };

  const handleSessionSelect = (timeSlot: (typeof timeSlots)[0]) => {
    if (selectedDay === null) {
      alert("Please select a day first");
      return;
    }

    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;

    // Check if this time slot is already booked
    const isBooked = bookedSlots.some(
      (slot) => slot.date === dateStr && slot.time === timeSlot.label
    );

    if (isBooked) {
      alert("This time slot is already booked. Please choose another time.");
      return;
    }

    // Clear previous selection and set new one
    setSelectedTimeSlot(timeSlot.label);

    const session: BookingSession = {
      date: dateStr,
      time: timeSlot.label,
      duration: 2, // Fixed 2-hour sessions as per the time slots
    };

    // Only allow one session per booking
    setSelectedSessions([session]);
  };

  const isSessionSelected = (timeSlot: (typeof timeSlots)[0]) => {
    if (selectedDay === null) return false;
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
    return selectedSessions.some(
      (session) => session.date === dateStr && session.time === timeSlot.label
    );
  };

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(selectedYear, selectedMonth + increment, 1);
    setSelectedMonth(newDate.getMonth());
    setSelectedYear(newDate.getFullYear());
    setSelectedDay(null);
    setSelectedTimeSlot(null);
    setSelectedSessions([]);
  };

  const calculateTotalSessions = () => {
    return selectedSessions.length;
  };

  const calculateTotalPrice = () => {
    const sessionPrice = coach.specialty === "gym" ? 350 : 250;
    return calculateTotalSessions() * sessionPrice;
  };

  const handleSubmitBooking = async () => {
    if (selectedSessions.length === 0) {
      alert("Please select at least one session");
      return;
    }

    // Get current user's email
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      alert("You must be logged in to book a session");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "bookings"), {
        coachId: coach.id,
        coachName: coach.name,
        coachEmail: coach.email,
        clientEmail: currentUser.email,
        clientUid: currentUser.uid,
        clientName: userData
          ? `${userData.firstName} ${userData.lastName}`
          : currentUser.email,
        clientPhone: userData?.phone || "",
        sessions: selectedSessions,
        totalSessions: calculateTotalSessions(),
        totalPrice: calculateTotalPrice(),
        paymentMethod: selectedPaymentMethod,
        status:
          selectedPaymentMethod === "online"
            ? "pending_payment"
            : "pending_confirmation",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setBookingSubmitted(true);
      setSelectedSessions([]);
      setSelectedDay(null);
      setSelectedTimeSlot(null);

      alert(
        "Booking submitted successfully! The coach will contact you to confirm the sessions."
      );
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Failed to submit booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOnlinePayment = async () => {
    await handleSubmitBooking();
  };

  // Show login prompt if user is not logged in
  if (!currentUser) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <UserIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          Login Required
        </h3>
        <p className="text-muted-foreground mb-4">
          Please log in to book coaching sessions with {coach.name}.
        </p>
        <button
          onClick={() => (window.location.href = "/login")}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (bookingSubmitted) {
    return (
      <div className="bg-card border rounded-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Booking Submitted!
        </h3>
        <p className="text-muted-foreground">
          Your session request has been sent to {coach.name}. They will contact
          you shortly to confirm.
        </p>
        <button
          onClick={() => setBookingSubmitted(false)}
          className="mt-6 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition"
        >
          Book More Sessions
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      {/* User Info Banner */}
      {userData && (
        <div className="mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm text-foreground">
            <strong>Welcome back, {userData.firstName}!</strong> Your
            information will be used for this booking.
          </p>
        </div>
      )}

      <div className="text-center mb-6">
        <p className="text-muted-foreground text-lg font-medium italic max-w-4xl mx-auto leading-relaxed mb-6">
          {coach.gymMotto ||
            "Dedicated to helping you become your strongest self."}
        </p>

        <div className="flex justify-center gap-8 mb-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">
              {coach.yearsOfTeaching}
            </p>
            <p className="text-muted-foreground">Years Experience</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">
              {coach.specialty.charAt(0).toUpperCase() +
                coach.specialty.slice(1)}
            </p>
            <p className="text-muted-foreground">Specialty</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">
              {formatCurrency(coach.specialty === "gym" ? 350 : 250)}
            </p>
            <p className="text-muted-foreground">Per Session</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Mail className="w-4 h-4 text-primary" />
            <a
              href={`mailto:${coach.email}`}
              className="hover:text-primary transition-colors underline-offset-4 hover:underline text-sm"
            >
              {coach.email}
            </a>
          </div>
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Phone className="w-4 h-4 text-primary" />
            <a
              href={`tel:${coach.phone}`}
              className="hover:text-primary transition-colors underline-offset-4 hover:underline text-sm"
            >
              {coach.phone || "Not provided"}
            </a>
          </div>
        </div>

        {coach.specialty === "karate" && (
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg mb-4">
            <p className="text-blue-800 dark:text-blue-300 text-sm">
              <strong>Note:</strong> This karate coach sets their own schedule.
              Only available dates are shown below.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-xl font-bold text-foreground mb-6 text-center">
          Book Sessions for {getMonthName(selectedMonth)} {selectedYear}
        </h3>

        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition"
          >
            Previous
          </button>
          <span className="text-lg font-semibold">
            {getMonthName(selectedMonth)} {selectedYear}
          </span>
          <button
            onClick={() => handleMonthChange(1)}
            className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition"
          >
            Next
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3 text-center">
            Step 1: Select a day{" "}
            {coach.specialty === "karate" &&
              "(Only available dates are selectable)"}
          </p>
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="h-12" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const today = new Date();
              const isPast =
                new Date(selectedYear, selectedMonth, day) <
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate()
                );
              const isSelected = selectedDay === day;
              const isAvailable =
                coach.specialty === "gym" || isDateAvailable(day);

              return (
                <button
                  key={day}
                  onClick={() => handleDaySelect(day)}
                  disabled={isPast || !isAvailable}
                  className={`h-12 border rounded-lg flex items-center justify-center text-sm font-medium transition ${
                    isPast
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : !isAvailable
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border cursor-pointer hover:bg-primary/10"
                  }`}
                  title={
                    !isAvailable && coach.specialty === "karate"
                      ? "No scheduled appointments available"
                      : ""
                  }
                >
                  {day}
                  {!isAvailable && coach.specialty === "karate" && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>

          {coach.specialty === "karate" && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                Red dot indicates unavailable dates. Coach sets their own
                schedule.
              </p>
            </div>
          )}
        </div>

        {selectedDay && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Step 2: Select ONE time slot for {getMonthName(selectedMonth)}{" "}
              {selectedDay}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {timeSlots.map((timeSlot) => (
                <button
                  key={timeSlot.label}
                  className={`p-4 border rounded-lg text-left transition ${
                    isSessionSelected(timeSlot)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-primary/10"
                  }`}
                  onClick={() => handleSessionSelect(timeSlot)}
                >
                  <div className="font-medium text-sm">{timeSlot.label}</div>
                  <div className="text-xs opacity-80 mt-1">
                    {formatCurrency(coach.specialty === "gym" ? 350 : 250)} per
                    session
                  </div>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3 text-center">
              ⓘ You can only select one time slot per booking
            </p>
          </div>
        )}

        {selectedSessions.length > 0 && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-foreground mb-3">
              Selected Session
            </h4>
            <div className="space-y-2 mb-3">
              {selectedSessions.map((session, index) => (
                <div
                  key={index}
                  className="text-sm text-muted-foreground flex justify-between items-center bg-background p-3 rounded"
                >
                  <div>
                    <span className="font-medium">{session.date}</span>
                    <br />
                    <span>{session.time}</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(coach.specialty === "gym" ? 350 : 250)}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Sessions:</span>
                <span className="font-semibold">1 session</span>
              </div>
              <div className="flex justify-between">
                <span>Total Price:</span>
                <span className="font-bold text-orange-500 text-lg">
                  {formatCurrency(calculateTotalPrice())}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="font-semibold text-foreground mb-3">Payment Method</h4>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => setSelectedPaymentMethod("cash")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition ${
                selectedPaymentMethod === "cash"
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-background border-border hover:bg-green-50 dark:hover:bg-green-900/20"
              }`}
            >
              < div className="w-5 h-5" />
              <span className="font-medium"> ₱ Pay now</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmitBooking} // Always use handleSubmitBooking since we only have cash payment
          disabled={isSubmitting || selectedSessions.length === 0}
          className={`w-full py-4 rounded-lg font-semibold transition text-lg ${
            isSubmitting || selectedSessions.length === 0
              ? "bg-muted cursor-not-allowed text-muted-foreground"
              : "bg-primary hover:bg-primary/90 shadow-lg text-primary-foreground"
          }`}
        >
          {isSubmitting
            ? "Processing..."
            : selectedSessions.length === 0
              ? "Select a Session to Book"
              : `Book Session - ${formatCurrency(calculateTotalPrice())}`}
        </button>
      </div>
    </div>
  );
};

// Booking Status Component
const BookingStatusSection = () => {
  const [clientBookings, setClientBookings] = useState<ClientBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
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
        setLoading(false);
        setClientBookings([]);
        return;
      }

      // Query bookings for the current user
      const q = query(
        collection(db, "bookings"),
        where("clientEmail", "==", user.email),
        orderBy("createdAt", "desc")
      );

      const unsubscribeBookings = onSnapshot(
        q,
        (snapshot) => {
          const bookingsData: ClientBooking[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.createdAt) {
              bookingsData.push({
                id: doc.id,
                ...data,
              } as ClientBooking);
            }
          });

          setClientBookings(bookingsData);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching bookings:", error);
          setLoading(false);
        }
      );

      return () => unsubscribeBookings();
    });

    return () => unsubscribeAuth();
  }, []);

  const getStatusColor = (status: ClientBooking["status"]): string => {
    switch (status) {
      case "pending_confirmation":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending_payment":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "confirmed":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "in_progress":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: ClientBooking["status"]) => {
    switch (status) {
      case "pending_confirmation":
      case "pending_payment":
        return <Clock className="w-5 h-5" />;
      case "confirmed":
        return <CheckCircle className="w-5 h-5" />;
      case "in_progress":
        return <PlayCircle className="w-5 h-5" />;
      case "completed":
        return <CheckCircle className="w-5 h-5" />;
      case "cancelled":
        return <Clock className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusMessage = (booking: ClientBooking): string => {
    switch (booking.status) {
      case "pending_confirmation":
        return "Waiting for coach to confirm your booking";
      case "pending_payment":
        return "Please complete your payment to confirm booking";
      case "confirmed":
        return "Your booking is confirmed! Get ready for your session";
      case "in_progress":
        return "Session in progress - Head to the gym now!";
      case "completed":
        return "Session completed successfully";
      case "cancelled":
        return "Booking has been cancelled";
      default:
        return "Processing your booking";
    }
  };

  const formatSessionDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (!currentUser) {
    return (
      <div className="w-full py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <UserIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Login Required
            </h3>
            <p className="text-muted-foreground mb-6">
              Please log in to view your booking status.
            </p>
            <button
              onClick={() => (window.location.href = "/login")}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full py-16">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">
              Loading your bookings...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-16">
      <div className="container mx-auto px-4">
        {/* User Welcome Banner */}
        {userData && (
          <div className="text-center mb-8">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 inline-block">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welcome back, {userData.firstName}!
              </h2>
              <p className="text-muted-foreground">
                Here&#39;s your current coaching session status
              </p>
            </div>
          </div>
        )}

        <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-4">
          Your Booking Status
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Track your coaching sessions and get real-time updates on your
          bookings
        </p>

        {clientBookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No Bookings Yet
            </h3>
            <p className="text-muted-foreground mb-6">
              Book your first coaching session to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-card border rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-foreground">
                      {booking.coachName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {booking.totalSessions} session
                      {booking.totalSessions !== 1 ? "s" : ""} • {formatCurrency(booking.totalPrice)}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}
                  >
                    {getStatusIcon(booking.status)}
                    <span className="capitalize">
                      {booking.status.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Sessions */}
                <div className="mb-4">
                  <h4 className="font-semibold text-foreground mb-2 text-sm">
                    UPCOMING SESSIONS:
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {booking.sessions.slice(0, 3).map((session, index) => (
                      <div
                        key={index}
                        className="text-sm bg-muted p-3 rounded-lg"
                      >
                        <div className="font-medium text-foreground">
                          {formatSessionDate(session.date)}
                        </div>
                        <div className="text-muted-foreground">
                          {session.time}
                        </div>
                      </div>
                    ))}
                    {booking.sessions.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{booking.sessions.length - 3} more sessions
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Message */}
                <div className="mb-4">
                  <div className="text-sm text-muted-foreground">
                    {getStatusMessage(booking)}
                  </div>
                </div>

                {/* Action Button */}
                {booking.status === "in_progress" && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        ACTION REQUIRED
                      </span>
                    </div>
                    <p className="text-green-600 dark:text-green-400 text-sm">
                      Your session has started! Please proceed to the gym and
                      meet your coach at the designated area.
                    </p>
                  </div>
                )}

                {booking.status === "confirmed" && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold text-sm">
                        NEXT SESSION
                      </span>
                    </div>
                    {booking.sessions.length > 0 && (
                      <p className="text-blue-600 dark:text-blue-400 text-sm">
                        Next session:{" "}
                        {formatSessionDate(booking.sessions[0].date)} at{" "}
                        {booking.sessions[0].time}
                      </p>
                    )}
                  </div>
                )}

                {/* Booking Date */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Booked on{" "}
                    {booking.createdAt?.toDate().toLocaleDateString("en-PH") ||
                      "Date not available"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export function CoachesCarousel() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentImageIndices, setCurrentImageIndices] = useState<{
    [key: string]: number;
  }>({});

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "coach"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coachesData: Coach[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "Unknown Coach",
          email: data.email || "",
          phone: data.phone || "",
          specialty: data.specialty || "gym",
          yearsOfTeaching: data.yearsOfTeaching || 0,
          images: data.images || [],
          gymMotto: data.gymMotto || "",
          status: data.status || "active",
          dateCreated: data.createdAt || "",
          authUid: data.authUid || "",
        } as Coach;
      });
      setCoaches(coachesData);

      const indices: { [key: string]: number } = {};
      coachesData.forEach((coach) => {
        indices[coach.id] = 0;
      });
      setCurrentImageIndices(indices);

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (coaches.length === 0) return;

    const interval = setInterval(() => {
      setCurrentImageIndices((prev) => {
        const updated = { ...prev };
        coaches.forEach((coach) => {
          if (coach.images && coach.images.length > 1) {
            updated[coach.id] =
              ((prev[coach.id] || 0) + 1) % coach.images.length;
          }
        });
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [coaches]);

  if (loading) {
    return (
      <div className="w-full py-20 flex items-center justify-center">
        <p className="text-2xl text-muted-foreground">
          Loading elite coaches...
        </p>
      </div>
    );
  }

  if (coaches.length === 0) {
    return (
      <div className="w-full py-20 text-center">
        <p className="text-3xl font-bold text-muted-foreground">
          No coaches available yet.
        </p>
        <p className="text-muted-foreground mt-4">
          Add your first coach from the management panel!
        </p>
      </div>
    );
  }

  const cards = coaches.map((coach, index) => {
    const currentIndex = currentImageIndices[coach.id] || 0;
    const primaryImage = coach.images?.[currentIndex] || null;

    return (
      <Card
        key={coach.id}
        card={{
          category: coach.specialty.toUpperCase(),
          title: coach.name,
          src: primaryImage
            ? getOptimizedImageUrl(primaryImage)
            : "https://via.placeholder.com/1200x900.png?text=Coach",
          content: <CoachContent coach={coach} />,
        }}
        index={index}
        layout={true}
      />
    );
  });

  return (
    <>
      <div className="w-full py-20">
        <h2 className="container mx-auto px-4 text-3xl md:text-5xl font-bold text-foreground text-center mb-16">
          Meet Our Elite Coaches
        </h2>
        <Carousel items={cards} autoplay={true} autoplayInterval={3000} />
      </div>

      {/* Booking Status Section */}
      <BookingStatusSection />
    </>
  );
}