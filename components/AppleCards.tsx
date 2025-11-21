"use client"
import { Carousel, Card } from "@/components/ui/apple-cards-carousel"
import { auth } from "@/lib/firebase"
import { db } from "@/lib/firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "firebase/firestore"
import { Calendar, CreditCard, DollarSign, Mail, Phone, Clock, CheckCircle, PlayCircle, MapPin } from "lucide-react"
import { useState, useEffect } from "react"

interface BookingSession {
  date: string
  time: string
  duration: number
}

interface Coach {
  id: string
  name: string
  email: string
  phone: string
  specialty: "gym" | "karate" | "boxing" | "zumba"
  yearsOfTeaching: number
  images: string[]
  gymMotto: string
  status: "active" | "inactive"
  dateCreated: string
  authUid: string
}

interface CoachSchedule {
  coachId: string
  availableSlots: string[] // Array of date strings in "YYYY-MM-DD" format
}

interface ClientBooking {
  id: string
  coachId: string
  coachName: string
  clientEmail: string
  sessions: BookingSession[]
  totalSessions: number
  totalPrice: number
  paymentMethod: "cash" | "online"
  status: "pending_confirmation" | "pending_payment" | "confirmed" | "cancelled" | "completed" | "in_progress"
  createdAt: {
    toDate: () => Date
  }
  approvedBy?: string
  startedAt?: {
    toDate: () => Date
  }
  completedAt?: {
    toDate: () => Date
  }
}

const getOptimizedImageUrl = (imageUrl: string, width = 1200, height = 900): string => {
  if (!imageUrl || !imageUrl.includes("cloudinary.com")) {
    return "https://via.placeholder.com/1200x900.png?text=No+Image"
  }
  const parts = imageUrl.split("/upload/")
  if (parts.length < 2) return imageUrl
  return `${parts[0]}/upload/c_fill,w_${width},h_${height},q_auto,f_auto,g_auto/${parts[1]}`
}

const CoachContent = ({ coach }: { coach: Coach }) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedSessions, setSelectedSessions] = useState<BookingSession[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cash" | "online">("online")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSubmitted, setBookingSubmitted] = useState(false)
  const [coachSchedules, setCoachSchedules] = useState<CoachSchedule[]>([])

  // Fetch coach schedules
  useEffect(() => {
    const q = query(collection(db, "coachSchedules"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schedules: CoachSchedule[] = snapshot.docs.map((doc) => ({
        coachId: doc.id,
        availableSlots: doc.data().availableSlots || []
      }))
      setCoachSchedules(schedules)
    })
    return () => unsubscribe()
  }, [])

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getMonthName = (month: number) => {
    return new Date(2000, month, 1).toLocaleString('default', { month: 'long' })
  }

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay()

  // Updated time slots based on requirements
  const timeSlots = [
    { label: "6:00 AM - 8:00 AM", start: "06:00", end: "08:00" },
    { label: "9:00 AM - 11:00 AM", start: "09:00", end: "11:00" },
    { label: "12:00 PM - 2:00 PM", start: "12:00", end: "14:00" },
    { label: "3:00 PM - 5:00 PM", start: "15:00", end: "17:00" },
    { label: "6:00 PM - 8:00 PM", start: "18:00", end: "20:00" },
    { label: "9:00 PM - 10:00 PM", start: "21:00", end: "22:00" }
  ]

  // Check if a specific date is available for the coach
  const isDateAvailable = (day: number): boolean => {
    if (coach.specialty === "karate") {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const coachSchedule = coachSchedules.find(schedule => schedule.coachId === coach.id)
      return coachSchedule ? coachSchedule.availableSlots.includes(dateStr) : false
    }
    return true // Gym coaches are always available
  }

  const handleDaySelect = (day: number) => {
    const today = new Date()
    const selectedDate = new Date(selectedYear, selectedMonth, day)
    const isPast = selectedDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
    
    if (!isPast && (coach.specialty === "gym" || isDateAvailable(day))) {
      setSelectedDay(day)
    }
  }

  const handleSessionSelect = (timeSlot: typeof timeSlots[0]) => {
    if (selectedDay === null) {
      alert("Please select a day first")
      return
    }

    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    
    const session: BookingSession = {
      date: dateStr,
      time: timeSlot.label,
      duration: 2 // Fixed 2-hour sessions as per the time slots
    }

    const existingIndex = selectedSessions.findIndex(
      s => s.date === dateStr && s.time === timeSlot.label
    )

    if (existingIndex > -1) {
      setSelectedSessions(prev => prev.filter((_, index) => index !== existingIndex))
    } else {
      setSelectedSessions(prev => [...prev, session])
    }
  }

  const isSessionSelected = (timeSlot: typeof timeSlots[0]) => {
    if (selectedDay === null) return false
    const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    return selectedSessions.some(session => 
      session.date === dateStr && session.time === timeSlot.label
    )
  }

  const handleMonthChange = (increment: number) => {
    const newDate = new Date(selectedYear, selectedMonth + increment, 1)
    setSelectedMonth(newDate.getMonth())
    setSelectedYear(newDate.getFullYear())
    setSelectedDay(null)
  }

  const calculateTotalSessions = () => {
    return selectedSessions.length
  }

  const calculateTotalPrice = () => {
    const sessionPrice = coach.specialty === "gym" ? 350 : 250
    return calculateTotalSessions() * sessionPrice
  }

const handleSubmitBooking = async () => {
  if (selectedSessions.length === 0) {
    alert("Please select at least one session")
    return
  }

  // Get current user's email
  const currentUser = auth.currentUser
  if (!currentUser?.email) {
    alert("You must be logged in to book a session")
    return
  }

  setIsSubmitting(true)
  try {
    await addDoc(collection(db, "bookings"), {
      coachId: coach.id,
      coachName: coach.name,
      coachEmail: coach.email,
      clientEmail: currentUser.email, // ✅ Add the actual client email
      clientUid: currentUser.uid, // Optional: also store the UID
      sessions: selectedSessions,
      totalSessions: calculateTotalSessions(),
      totalPrice: calculateTotalPrice(),
      paymentMethod: selectedPaymentMethod,
      status: selectedPaymentMethod === "online" ? "pending_payment" : "pending_confirmation",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    setBookingSubmitted(true)
    setSelectedSessions([])
    setSelectedDay(null)
    
    alert("Booking submitted successfully! The coach will contact you to confirm the sessions.")
    
  } catch (error) {
    console.error("Error submitting booking:", error)
    alert("Failed to submit booking. Please try again.")
  } finally {
    setIsSubmitting(false)
  }
}

  const handleOnlinePayment = async () => {
    await handleSubmitBooking()
  }

  if (bookingSubmitted) {
    return (
      <div className="bg-[#F5F5F7] dark:bg-neutral-800 p-8 md:p-14 rounded-3xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-neutral-800 dark:text-white mb-2">
            Booking Submitted!
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400">
            Your session request has been sent to {coach.name}. They will contact you shortly to confirm.
          </p>
          <button
            onClick={() => setBookingSubmitted(false)}
            className="mt-6 px-6 py-3 bg-orange-500 text-white font-semibold rounded-full hover:bg-orange-600 transition"
          >
            Book More Sessions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#F5F5F7] dark:bg-neutral-800 p-6 md:p-10 rounded-3xl">
      <div className="text-center mb-8">
        <p className="text-neutral-600 dark:text-neutral-400 text-lg md:text-xl font-medium italic max-w-4xl mx-auto leading-relaxed mb-6">
          {coach.gymMotto || "Dedicated to helping you become your strongest self."}
        </p>
        
        <div className="flex justify-center gap-8 mb-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-neutral-800 dark:text-white">
              {coach.yearsOfTeaching}
            </p>
            <p className="text-neutral-500">Years Experience</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-500">
              {coach.specialty.charAt(0).toUpperCase() + coach.specialty.slice(1)}
            </p>
            <p className="text-neutral-500">Specialty</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">
              {coach.specialty === "gym" ? "350" : "250"} PHP
            </p>
            <p className="text-neutral-500">Per Session</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center gap-3 text-neutral-700 dark:text-neutral-300">
            <Mail className="w-4 h-4 text-orange-500" />
            <a
              href={`mailto:${coach.email}`}
              className="hover:text-orange-500 transition-colors underline-offset-4 hover:underline text-sm"
            >
              {coach.email}
            </a>
          </div>
          <div className="flex items-center justify-center gap-3 text-neutral-700 dark:text-neutral-300">
            <Phone className="w-4 h-4 text-orange-500" />
            <a
              href={`tel:${coach.phone}`}
              className="hover:text-orange-500 transition-colors underline-offset-4 hover:underline text-sm"
            >
              {coach.phone || "Not provided"}
            </a>
          </div>
        </div>

        {coach.specialty === "karate" && (
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg mb-4">
            <p className="text-blue-800 dark:text-blue-300 text-sm">
              <strong>Note:</strong> This karate coach sets their own schedule. Only available dates are shown below.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-300 dark:border-neutral-600 pt-8">
        <h3 className="text-xl font-bold text-neutral-800 dark:text-white mb-6 text-center">
          Book Sessions for {getMonthName(selectedMonth)} {selectedYear}
        </h3>

        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => handleMonthChange(-1)}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition"
          >
            Previous
          </button>
          <span className="text-lg font-semibold">
            {getMonthName(selectedMonth)} {selectedYear}
          </span>
          <button
            onClick={() => handleMonthChange(1)}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition"
          >
            Next
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 text-center">
            Step 1: Select a day {coach.specialty === "karate" && "(Only available dates are selectable)"}
          </p>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-neutral-600 dark:text-neutral-400 py-2">
                {day}
              </div>
            ))}
            
            {Array.from({ length: firstDayOfMonth }).map((_, index) => (
              <div key={`empty-${index}`} className="h-12" />
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1
              const today = new Date()
              const isPast = new Date(selectedYear, selectedMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isSelected = selectedDay === day
              const isAvailable = coach.specialty === "gym" || isDateAvailable(day)
              
              return (
                <button
                  key={day}
                  onClick={() => handleDaySelect(day)}
                  disabled={isPast || !isAvailable}
                  className={`h-12 border rounded-lg flex items-center justify-center text-sm font-medium transition ${
                    isPast 
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                      : !isAvailable
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                      : isSelected
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  }`}
                  title={!isAvailable && coach.specialty === "karate" ? "No scheduled appointments available" : ""}
                >
                  {day}
                  {!isAvailable && coach.specialty === "karate" && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
              )
            })}
          </div>

          {coach.specialty === "karate" && (
            <div className="mt-4 text-center">
              <p className="text-sm text-neutral-500">
                Red dot indicates unavailable dates. Coach sets their own schedule.
              </p>
            </div>
          )}
        </div>

        {selectedDay && (
          <div className="mb-6">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3 text-center">
              Step 2: Select time slots for {getMonthName(selectedMonth)} {selectedDay}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {timeSlots.map((timeSlot) => (
                <button
                  key={timeSlot.label}
                  className={`p-4 border rounded-lg text-left transition ${
                    isSessionSelected(timeSlot)
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                  }`}
                  onClick={() => handleSessionSelect(timeSlot)}
                >
                  <div className="font-medium text-sm">
                    {timeSlot.label}
                  </div>
                  <div className="text-xs opacity-80 mt-1">
                    {coach.specialty === "gym" ? "350 PHP" : "250 PHP"} per session
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSessions.length > 0 && (
          <div className="mb-6 p-4 bg-neutral-100 dark:bg-neutral-700 rounded-lg">
            <h4 className="font-semibold text-neutral-800 dark:text-white mb-3">
              Selected Sessions ({selectedSessions.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
              {selectedSessions.map((session, index) => (
                <div key={index} className="text-sm text-neutral-600 dark:text-neutral-400 flex justify-between items-center bg-white dark:bg-neutral-800 p-2 rounded">
                  <div>
                    <span className="font-medium">{session.date}</span>
                    <br />
                    <span>{session.time}</span>
                  </div>
                  <span className="font-medium">{coach.specialty === "gym" ? "350" : "250"} PHP</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-neutral-300 dark:border-neutral-600 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Sessions:</span>
                <span className="font-semibold">{calculateTotalSessions()} sessions</span>
              </div>
              <div className="flex justify-between">
                <span>Total Price:</span>
                <span className="font-bold text-orange-500 text-lg">{calculateTotalPrice()} PHP</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="font-semibold text-neutral-800 dark:text-white mb-3">Payment Method</h4>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedPaymentMethod('online')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition ${
                selectedPaymentMethod === 'online'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">Online Payment</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('cash')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition ${
                selectedPaymentMethod === 'cash'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 hover:bg-green-50 dark:hover:bg-green-900/20'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              <span className="font-medium">Pay with Cash</span>
            </button>
          </div>
        </div>

        <button
          onClick={selectedPaymentMethod === 'online' ? handleOnlinePayment : handleSubmitBooking}
          disabled={isSubmitting || selectedSessions.length === 0}
          className={`w-full py-4 rounded-full font-semibold transition text-lg ${
            isSubmitting || selectedSessions.length === 0
              ? 'bg-neutral-400 cursor-not-allowed text-neutral-200'
              : 'bg-orange-500 hover:bg-orange-600 shadow-lg text-white'
          }`}
        >
          {isSubmitting ? 'Processing...' : selectedSessions.length === 0 ? 'Select Sessions to Book' : `Book ${selectedSessions.length} Session${selectedSessions.length !== 1 ? 's' : ''} - ${calculateTotalPrice()} PHP`}
        </button>
      </div>
    </div>
  )
}

// Booking Status Component
const BookingStatusSection = () => {
  const [clientBookings, setClientBookings] = useState<ClientBooking[]>([])
  const [loading, setLoading] = useState<boolean>(true) // Already starts as true

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user?.email) {
        setLoading(false)
        setClientBookings([])
        return
      }

      // Query bookings for the current user
      const q = query(
        collection(db, "bookings"),
        where("clientEmail", "==", user.email),
        orderBy("createdAt", "desc")
      )
      
      const unsubscribeBookings = onSnapshot(
        q, 
        (snapshot) => {
          const bookingsData: ClientBooking[] = []
          snapshot.forEach((doc) => {
            const data = doc.data()
            if (data.createdAt) {
              bookingsData.push({
                id: doc.id,
                ...data
              } as ClientBooking)
            }
          })
          
          setClientBookings(bookingsData)
          setLoading(false) // Only set loading to false in the callback
        },
        (error) => {
          console.error("Error fetching bookings:", error)
          setLoading(false) // Also set to false on error
        }
      )

      return () => unsubscribeBookings()
    })

    return () => unsubscribeAuth()
  }, [])

  const getStatusColor = (status: ClientBooking['status']): string => {
    switch (status) {
      case 'pending_confirmation':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'pending_payment':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'in_progress':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: ClientBooking['status']) => {
    switch (status) {
      case 'pending_confirmation':
      case 'pending_payment':
        return <Clock className="w-5 h-5" />
      case 'confirmed':
        return <CheckCircle className="w-5 h-5" />
      case 'in_progress':
        return <PlayCircle className="w-5 h-5" />
      case 'completed':
        return <CheckCircle className="w-5 h-5" />
      case 'cancelled':
        return <Clock className="w-5 h-5" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  const getStatusMessage = (booking: ClientBooking): string => {
    switch (booking.status) {
      case 'pending_confirmation':
        return "Waiting for coach to confirm your booking"
      case 'pending_payment':
        return "Please complete your payment to confirm booking"
      case 'confirmed':
        return "Your booking is confirmed! Get ready for your session"
      case 'in_progress':
        return "Session in progress - Head to the gym now!"
      case 'completed':
        return "Session completed successfully"
      case 'cancelled':
        return "Booking has been cancelled"
      default:
        return "Processing your booking"
    }
  }

  const formatSessionDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="w-full py-12 bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">Loading your bookings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-16 bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-900 dark:to-neutral-950">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-neutral-800 dark:text-neutral-200 text-center mb-4">
          Your Booking Status
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-center mb-12 max-w-2xl mx-auto">
          Track your coaching sessions and get real-time updates on your bookings
        </p>

        {clientBookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-neutral-400" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
              No Bookings Yet
            </h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6">
              Book your first coaching session to get started!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-6 hover:shadow-xl transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-neutral-800 dark:text-white">
                      {booking.coachName}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {booking.totalSessions} session{booking.totalSessions !== 1 ? 's' : ''} • ₱{booking.totalPrice}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}>
                    {getStatusIcon(booking.status)}
                    <span className="capitalize">
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Sessions */}
                <div className="mb-4">
                  <h4 className="font-semibold text-neutral-700 dark:text-neutral-300 mb-2 text-sm">
                    UPCOMING SESSIONS:
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {booking.sessions.slice(0, 3).map((session, index) => (
                      <div
                        key={index}
                        className="text-sm bg-neutral-50 dark:bg-neutral-700 p-3 rounded-lg"
                      >
                        <div className="font-medium text-neutral-800 dark:text-neutral-200">
                          {formatSessionDate(session.date)}
                        </div>
                        <div className="text-neutral-600 dark:text-neutral-400">
                          {session.time}
                        </div>
                      </div>
                    ))}
                    {booking.sessions.length > 3 && (
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
                        +{booking.sessions.length - 3} more sessions
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Message */}
                <div className="mb-4">
                  <div className="text-sm text-neutral-600 dark:text-neutral-400">
                    {getStatusMessage(booking)}
                  </div>
                </div>

                {/* Action Button */}
                {booking.status === 'in_progress' && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="font-semibold text-sm">ACTION REQUIRED</span>
                    </div>
                    <p className="text-green-600 dark:text-green-400 text-sm">
                      Your session has started! Please proceed to the gym and meet your coach at the designated area.
                    </p>
                  </div>
                )}

                {booking.status === 'confirmed' && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold text-sm">NEXT SESSION</span>
                    </div>
                    {booking.sessions.length > 0 && (
                      <p className="text-blue-600 dark:text-blue-400 text-sm">
                        Next session: {formatSessionDate(booking.sessions[0].date)} at {booking.sessions[0].time}
                      </p>
                    )}
                  </div>
                )}

                {/* Booking Date */}
<div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
  <p className="text-xs text-neutral-500 dark:text-neutral-400">
    Booked on {booking.createdAt?.toDate().toLocaleDateString('en-PH') || 'Date not available'}
  </p>
</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CoachesCarousel() {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [currentImageIndices, setCurrentImageIndices] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "coach"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const coachesData: Coach[] = snapshot.docs.map((doc) => {
        const data = doc.data()
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
        } as Coach
      })
      setCoaches(coachesData)
      
      const indices: { [key: string]: number } = {}
      coachesData.forEach((coach) => {
        indices[coach.id] = 0
      })
      setCurrentImageIndices(indices)
      
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (coaches.length === 0) return

    const interval = setInterval(() => {
      setCurrentImageIndices((prev) => {
        const updated = { ...prev }
        coaches.forEach((coach) => {
          if (coach.images && coach.images.length > 1) {
            updated[coach.id] = ((prev[coach.id] || 0) + 1) % coach.images.length
          }
        })
        return updated
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [coaches])

  if (loading) {
    return (
      <div className="w-full py-20 flex items-center justify-center">
        <p className="text-2xl text-muted-foreground">Loading elite coaches...</p>
      </div>
    )
  }

  if (coaches.length === 0) {
    return (
      <div className="w-full py-20 text-center">
        <p className="text-3xl font-bold text-neutral-400">No coaches available yet.</p>
        <p className="text-neutral-500 mt-4">Add your first coach from the management panel!</p>
      </div>
    )
  }

  const cards = coaches.map((coach, index) => {
    const currentIndex = currentImageIndices[coach.id] || 0
    const primaryImage = coach.images?.[currentIndex] || null
    
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
    )
  })

  return (
    <>
      <div className="w-full py-20 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-950 dark:to-black">
        <h2 className="max-w-7xl pl-4 mx-auto text-xl md:text-5xl font-bold text-neutral-800 dark:text-neutral-200 font-sans text-center mb-16">
          Meet Our Elite Coaches
        </h2>
        <Carousel items={cards} autoplay={true} autoplayInterval={3000} />
      </div>
      
      {/* Booking Status Section */}
      <BookingStatusSection />
    </>
  )
}