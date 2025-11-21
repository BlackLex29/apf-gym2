"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import Chatbot from "@/components/Chatbot";

// Type definitions - REMOVED KARATE
type ActivityType = 'modeling' | 'dance' | 'zumba';
type TimeSlot = string;
type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

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
}

// Available time slots
const TIME_SLOTS: TimeSlot[] = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM'
];

// Activity configurations with pricing - UPDATED TO ₱350 PER HOUR AND REMOVED KARATE
const ACTIVITIES = {
  modeling: {
    name: 'Modeling Practice',
    maxParticipants: 10,
    durations: [1, 2, 3],
    pricePerHour: 350,  // Changed from 200 to 350
    icon: '📸'
  },
  dance: {
    name: 'Dance Practice',
    maxParticipants: 15,
    durations: [1, 2, 3, 4],
    pricePerHour: 350,  // Changed from 200 to 350
    icon: '💃'
  },
  zumba: {
    name: 'Zumba Class',
    maxParticipants: 25,
    durations: [1, 2],
    pricePerHour: 350,  // Changed from 200 to 350
    icon: '🎵'
  }
  // REMOVED KARATE ACTIVITY
};

const BookStudioForm: React.FC = () => {
  const [formData, setFormData] = useState<AppointmentFormData>({
    name: '',
    phone: '',
    activityType: 'dance',
    date: '',
    timeSlot: TIME_SLOTS[0],
    duration: 1,
    participants: 1,
    specialRequests: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  // Calculate total price - NOW USES ₱350 PER HOUR
  const calculateTotalPrice = (): number => {
    const activity = ACTIVITIES[formData.activityType];
    return activity.pricePerHour * formData.duration;
  };

  // Check availability for selected date - WRAPPED IN useCallback
  const checkAvailability = useCallback(async (date: string) => {
    if (!date) return;
    
    setIsCheckingAvailability(true);
    try {
      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('date', '==', date),
        where('status', 'in', ['pending', 'confirmed'])
      );
      
      const querySnapshot = await getDocs(q);
      const bookedSlots = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const booking = doc.data() as BookingRecord;
        bookedSlots.add(booking.timeSlot);
      });

      const available = TIME_SLOTS.filter(slot => !bookedSlots.has(slot));
      setAvailableSlots(available);
      
      // If current selected slot is not available, reset to first available slot
      if (!available.includes(formData.timeSlot) && available.length > 0) {
        setFormData(prev => ({ ...prev, timeSlot: available[0] }));
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableSlots(TIME_SLOTS); // Fallback to all slots
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [formData.timeSlot]); // Add dependencies that are used inside the function

  // Generate booking reference
  const generateBookingReference = (): string => {
    const prefix = 'STUDIO';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  // Format phone number to 11 digits
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit to 11 digits
    return digits.slice(0, 11);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      const formattedPhone = formatPhoneNumber(value);
      setFormData(prev => ({
        ...prev,
        [name]: formattedPhone
      }));
    } else {
      const newValue = name === 'duration' || name === 'participants' ? parseInt(value) : value;
      
      setFormData(prev => ({
        ...prev,
        [name]: newValue
      }));

      // Check availability when date changes
      if (name === 'date') {
        checkAvailability(value);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    if (formData.phone.length !== 11) {
      setSubmitMessage('❌ Please enter a valid 11-digit phone number');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const totalPrice = calculateTotalPrice();
      const bookingReference = generateBookingReference();

      const bookingData: Omit<BookingRecord, 'id'> = {
        ...formData,
        totalPrice,
        status: 'pending' as BookingStatus,
        createdAt: Timestamp.now(),
        bookingReference
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'bookings'), bookingData);
      
      setSubmitMessage(`✅ Booking successful! Your reference: ${bookingReference}. Total: ₱${totalPrice}`);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        activityType: 'dance',
        date: '',
        timeSlot: TIME_SLOTS[0],
        duration: 1,
        participants: 1,
        specialRequests: ''
      });
      setAvailableSlots([]);

      // Log to console (for demo)
      console.log('Booking saved with ID:', docRef.id, bookingData);

    } catch (error) {
      console.error('Error saving booking:', error);
      setSubmitMessage('❌ Error booking appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    return maxDate.toISOString().split('T')[0];
  };

  const currentActivity = ACTIVITIES[formData.activityType];
  const totalPrice = calculateTotalPrice();

  // Initialize availability check when component mounts or date changes
  useEffect(() => {
    if (formData.date) {
      checkAvailability(formData.date);
    }
  }, [formData.date, checkAvailability]); // Added checkAvailability to dependencies

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <span className="text-2xl">🎭</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Studio Booking
          </h1>
          <p className="text-lg text-gray-600">
            Book our studio for your practice sessions - <span className="font-semibold text-green-600">₱350 per hour</span>
          </p>
        </div>

        {/* Success/Error Message */}
        {submitMessage && (
          <div className={`mb-6 p-4 rounded-lg border ${
            submitMessage.includes('✅') 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              <span className="text-lg mr-2">{submitMessage.includes('✅') ? '✅' : '❌'}</span>
              <span className="font-medium">{submitMessage}</span>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8">
            {/* Personal Information */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 text-sm font-semibold">1</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Phone Number * (11 digits)
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    maxLength={11}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="09XXXXXXXXX"
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                      Format: 09XXXXXXXXX
                    </p>
                    <p className={`text-sm font-medium ${
                      formData.phone.length === 11 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formData.phone.length}/11 digits
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Details */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 text-sm font-semibold">2</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Activity Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Activity Type - REMOVED KARATE OPTION */}
                <div className="space-y-2">
                  <label htmlFor="activityType" className="block text-sm font-medium text-gray-700">
                    Activity Type *
                  </label>
                  <div className="relative">
                    <select
                      id="activityType"
                      name="activityType"
                      value={formData.activityType}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all duration-200"
                    >
                      {Object.entries(ACTIVITIES).map(([key, activity]) => (
                        <option key={key} value={key}>
                          {activity.icon} {activity.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm text-green-600 font-medium">
                    ₱{currentActivity.pricePerHour} per hour
                  </p>
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  {isCheckingAvailability && (
                    <p className="text-sm text-yellow-600 flex items-center">
                      <span className="animate-spin mr-1">⟳</span> Checking availability...
                    </p>
                  )}
                </div>

                {/* Time Slot */}
                <div className="space-y-2">
                  <label htmlFor="timeSlot" className="block text-sm font-medium text-gray-700">
                    Time Slot *
                  </label>
                  <div className="relative">
                    <select
                      id="timeSlot"
                      name="timeSlot"
                      value={formData.timeSlot}
                      onChange={handleInputChange}
                      required
                      disabled={availableSlots.length === 0 && formData.date !== ''}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      {formData.date ? (
                        availableSlots.length > 0 ? (
                          availableSlots.map(slot => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))
                        ) : (
                          <option value="">No available slots</option>
                        )
                      ) : (
                        TIME_SLOTS.map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))
                      )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  {formData.date && availableSlots.length > 0 && (
                    <p className="text-sm text-green-600 font-medium">
                      {availableSlots.length} slots available
                    </p>
                  )}
                  {formData.date && availableSlots.length === 0 && (
                    <p className="text-sm text-red-600">
                      No available slots for this date
                    </p>
                  )}
                </div>

                {/* Duration - UPDATED PRICE TO ₱350 */}
                <div className="space-y-2">
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                    Duration (hours) *
                  </label>
                  <div className="relative">
                    <select
                      id="duration"
                      name="duration"
                      value={formData.duration}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none transition-all duration-200"
                    >
                      {currentActivity.durations.map(duration => (
                        <option key={duration} value={duration}>
                          {duration} hour{duration > 1 ? 's' : ''} (₱{duration * 350})
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="space-y-2">
                  <label htmlFor="participants" className="block text-sm font-medium text-gray-700">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                  <p className="text-sm text-gray-500">
                    Max: {currentActivity.maxParticipants} participants
                  </p>
                </div>
              </div>

              {/* Price Summary - UPDATED TO ₱350 */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-3">Price Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      {formData.duration} hour{formData.duration > 1 ? 's' : ''} × ₱350
                    </span>
                    <span className="font-medium">₱{totalPrice}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-green-600">₱{totalPrice}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 text-sm font-semibold">3</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Additional Information</h2>
              </div>

              <div className="space-y-2">
                <label htmlFor="specialRequests" className="block text-sm font-medium text-gray-700">
                  Special Requests or Equipment Needs
                </label>
                <textarea
                  id="specialRequests"
                  name="specialRequests"
                  value={formData.specialRequests}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                  placeholder="Any special equipment, setup requirements, or additional notes..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <button 
                type="submit" 
                disabled={isSubmitting || (formData.date && availableSlots.length === 0) || formData.phone.length !== 11}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:from-blue-700 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none"
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
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Need help? Contact us at <span className="text-blue-600">support@studiobook.com</span> or call <span className="text-blue-600">+63 917 123 4567</span></p>
        </div>
      </div>

      {/* Chatbot Component */}
      <Chatbot />
    </div>
  );
};

export default BookStudioForm;