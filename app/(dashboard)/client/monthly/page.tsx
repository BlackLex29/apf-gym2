"use client";
import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Chatbot from "@/components/Chatbot";
import Image from 'next/image';

// Type definitions - Matching ClientManagement interface
type UserType = 'regular' | 'student';
type PaymentMethod = 'cash' | 'gcash' | 'bank_transfer';
type MembershipStatus = 'active' | 'pending' | 'expired' | 'cancelled' | 'payment_pending';

interface MembershipFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userType: UserType;
  paymentMethod: PaymentMethod;
  studentId?: string;
  emergencyContact: string;
  emergencyPhone: string;
  healthConditions: string;
  fitnessGoals: string;
}

interface MembershipRecord extends MembershipFormData {
  id?: string;
  membershipId: string;
  monthlyPrice: number;
  startDate: Timestamp;
  expiryDate: Timestamp;
  status: MembershipStatus;
  createdAt: Timestamp;
  paymentDate?: Timestamp | null;
  approvedBy?: string;
}

const MonthlyMembershipForm: React.FC = () => {
  const [formData, setFormData] = useState<MembershipFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    userType: 'regular',
    paymentMethod: 'cash',
    studentId: '',
    emergencyContact: '',
    emergencyPhone: '',
    healthConditions: '',
    fitnessGoals: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [activeMemberships, setActiveMemberships] = useState<MembershipRecord[]>([]);
  const [showGCashModal, setShowGCashModal] = useState(false);

  // GCash References and Instructions
  const gcashReferences = {
    number: '0917-123-4567',
    name: 'GymSched Pro Fitness Center',
    qrCode: '/Gcash-qr.jpg', // Path sa public folder
    instructions: [
      'Open your GCash app',
      'Tap "Send Money"',
      'Enter our GCash number: 0917-123-4567',
      'Enter amount: ₱{amount}',
      'Add your name in the remarks/message',
      'Take screenshot of transaction for verification'
    ]
  };

  // Calculate monthly price based on user type
  const calculateMonthlyPrice = (): number => {
    return formData.userType === 'regular' ? 1200 : 1000;
  };

  // Generate unique membership ID
  const generateMembershipId = (): string => {
    const prefix = 'GYM';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  // Calculate dates for display
  const calculateMembershipDates = () => {
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    return {
      startDate,
      expiryDate
    };
  };

  // Format date for display
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Load active memberships
  const loadActiveMemberships = async () => {
    try {
      const membershipsRef = collection(db, 'monthlyMemberships');
      const q = query(
        membershipsRef,
        where('status', 'in', ['active', 'pending', 'payment_pending'])
      );
      
      const querySnapshot = await getDocs(q);
      const memberships: MembershipRecord[] = [];
      
      querySnapshot.forEach((doc) => {
        memberships.push({ id: doc.id, ...doc.data() } as MembershipRecord);
      });
      
      setActiveMemberships(memberships);
    } catch (error) {
      console.error('Error loading memberships:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setSubmitMessage('❌ Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const monthlyPrice = calculateMonthlyPrice();
      const membershipId = generateMembershipId();
      const now = Timestamp.now();
      const { startDate, expiryDate } = calculateMembershipDates();

      // Determine initial status based on payment method
      const initialStatus: MembershipStatus = 
        formData.paymentMethod === 'gcash' ? 'payment_pending' : 'pending';

      // Create membership data WITHOUT undefined fields
      const membershipData: Omit<MembershipRecord, 'id'> = {
        ...formData,
        membershipId,
        monthlyPrice,
        startDate: Timestamp.fromDate(startDate),
        expiryDate: Timestamp.fromDate(expiryDate),
        status: initialStatus,
        createdAt: now,
        approvedBy: '' // Empty string instead of undefined
        // Remove paymentDate field entirely since it's not set yet
      };

      // Remove undefined fields before saving
      const cleanMembershipData = Object.fromEntries(
        Object.entries(membershipData).filter(([_, value]) => value !== undefined)
      );

      console.log('Saving membership data:', cleanMembershipData);

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'monthlyMemberships'), cleanMembershipData);
      
      console.log('Membership saved with ID:', docRef.id);

      // Show GCash modal if GCash payment method selected
      if (formData.paymentMethod === 'gcash') {
        setShowGCashModal(true);
      }

      const paymentInstructions = 
        formData.paymentMethod === 'gcash' 
          ? ' Please complete your GCash payment using the instructions provided.'
          : ' Please proceed to the gym reception for cash payment.';

      setSubmitMessage(
        `✅ Monthly membership application submitted! ` +
        `Membership ID: ${membershipId}. ` +
        `Please proceed with payment of ₱${monthlyPrice}. ` +
        `Your membership will be valid from ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(expiryDate)}.${paymentInstructions}`
      );

      // Reset form but keep user type
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        userType: formData.userType,
        paymentMethod: 'cash',
        studentId: '',
        emergencyContact: '',
        emergencyPhone: '',
        healthConditions: '',
        fitnessGoals: ''
      });

      // Refresh memberships list
      await loadActiveMemberships();

    } catch (error) {
      console.error('Error saving membership:', error);
      setSubmitMessage('❌ Error processing membership application. Please try again.');
      
      // More detailed error message
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate days remaining until expiry
  const calculateDaysRemaining = (expiryDate: Timestamp): number => {
    const now = new Date();
    const expiry = expiryDate.toDate();
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getMembershipStatusColor = (status: MembershipStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'payment_pending': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    loadActiveMemberships();
  }, []);

  const monthlyPrice = calculateMonthlyPrice();
  const { startDate, expiryDate } = calculateMembershipDates();

  return (
    <div className="monthly-membership-form">
      {/* GCash Payment Modal */}
      {showGCashModal && (
        <div className="gcash-modal-overlay">
          <div className="gcash-modal">
            <div className="gcash-header">
              <h2>💰 GCash Payment Instructions</h2>
              <button 
                className="close-button"
                onClick={() => setShowGCashModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="gcash-content">
              <div className="gcash-info-section">
                <div className="gcash-account-info">
                  <h3>Send Payment To:</h3>
                  <div className="account-details">
                    <div className="detail-item">
                      <span className="label">GCash Number:</span>
                      <span className="value highlight">{gcashReferences.number}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Account Name:</span>
                      <span className="value">{gcashReferences.name}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Amount:</span>
                      <span className="value highlight">₱{monthlyPrice}</span>
                    </div>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="qr-code-section">
                  <h3>Or Scan QR Code:</h3>
                  <div className="qr-code-placeholder">
                    <div className="qr-code-image">
                      <Image 
                        src={gcashReferences.qrCode}
                        alt="GCash QR Code"
                        width={200}
                        height={200}
                        className="qr-code"
                        onError={(e) => {
                          // Fallback kung wala ang QR code image
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <div className="qr-fallback hidden">
                        <div className="qr-placeholder">
                          <span>QR Code Image</span>
                          <small>{gcashReferences.number}</small>
                        </div>
                      </div>
                    </div>
                    <p className="qr-note">Scan this QR code using your GCash app</p>
                  </div>
                </div>
              </div>

              <div className="instructions-section">
                <h3>📱 Payment Steps:</h3>
                <ol className="instructions-list">
                  {gcashReferences.instructions.map((instruction, index) => (
                    <li key={index} className="instruction-item">
                      {instruction.replace('{amount}', monthlyPrice.toString())}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="important-notes">
                <h3>⚠️ Important Notes:</h3>
                <ul className="notes-list">
                  <li>Include your FULL NAME in the transaction remarks</li>
                  <li>Take a screenshot of the payment confirmation</li>
                  <li>Your membership will be activated within 1-2 hours after payment verification</li>
                  <li>For issues, contact us at: gymschedpro@gmail.com</li>
                  <li>Send payment confirmation to our Facebook page or email</li>
                </ul>
              </div>

              <div className="confirmation-section">
                <h3>✅ After Payment:</h3>
                <div className="confirmation-steps">
                  <p>1. Wait for payment verification (1-2 hours)</p>
                  <p>2. Check your email for membership confirmation</p>
                  <p>3. Present your membership ID at the gym reception</p>
                  <p>4. Enjoy your gym membership!</p>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="done-button"
                  onClick={() => setShowGCashModal(false)}
                >
                  I Understand, Close Instructions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="form-header">
        <h1>🏋️ Monthly Gym Membership</h1>
        <p className="tagline">Start Your Fitness Journey Today!</p>
        
        <div className="pricing-display">
          <div className={`price-card ${formData.userType === 'regular' ? 'active' : ''}`}>
            <h3>Regular Membership</h3>
            <div className="price">₱1,200</div>
            <p>per month</p>
            <ul>
              <li>✅ Unlimited gym access</li>
              <li>✅ All equipment usage</li>
              <li>✅ Locker facilities</li>
              <li>✅ Towel service</li>
              <li>✅ Free fitness assessment</li>
            </ul>
          </div>
          
          <div className={`price-card ${formData.userType === 'student' ? 'active' : ''}`}>
            <h3>Student Membership</h3>
            <div className="price">₱1,000</div>
            <p>per month</p>
            <ul>
              <li>✅ All regular benefits</li>
              <li>✅ Special student hours</li>
              <li>✅ Student events</li>
              <li>✅ Group workout sessions</li>
            </ul>
          </div>
        </div>
      </div>

      {submitMessage && (
        <div className={`submit-message ${submitMessage.includes('✅') ? 'success' : 'error'}`}>
          {submitMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="membership-form">
        {/* Basic Information */}
        <div className="form-section">
          <h3>👤 Basic Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                placeholder="Enter your first name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                placeholder="Enter your last name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter your email address"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                placeholder="Enter your phone number"
              />
            </div>
          </div>
        </div>

        {/* Membership Type */}
        <div className="form-section">
          <h3>🎯 Membership Type</h3>
          <div className="membership-type-selector">
            <label className="radio-label">
              <input
                type="radio"
                name="userType"
                value="regular"
                checked={formData.userType === 'regular'}
                onChange={handleInputChange}
              />
              <span className="radio-content">
                <strong>Regular Membership</strong>
                <span>₱1,200 per month</span>
              </span>
            </label>
            
            <label className="radio-label">
              <input
                type="radio"
                name="userType"
                value="student"
                checked={formData.userType === 'student'}
                onChange={handleInputChange}
              />
              <span className="radio-content">
                <strong>Student Membership</strong>
                <span>₱1,000 per month</span>
                {formData.userType === 'student' && (
                  <div className="student-id-input">
                    <input
                      type="text"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleInputChange}
                      placeholder="Student ID (Optional)"
                    />
                  </div>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="form-section">
          <h3>🚨 Emergency Contact</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="emergencyContact">Emergency Contact Name *</label>
              <input
                type="text"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleInputChange}
                required
                placeholder="Full name of emergency contact"
              />
            </div>

            <div className="form-group">
              <label htmlFor="emergencyPhone">Emergency Contact Phone *</label>
              <input
                type="tel"
                id="emergencyPhone"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleInputChange}
                required
                placeholder="Emergency contact phone number"
              />
            </div>
          </div>
        </div>

        {/* Health Information */}
        <div className="form-section">
          <h3>❤️ Health Information</h3>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="healthConditions">Health Conditions (Optional)</label>
              <textarea
                id="healthConditions"
                name="healthConditions"
                value={formData.healthConditions}
                onChange={handleInputChange}
                placeholder="Please list any health conditions, allergies, or medications we should be aware of..."
                rows={3}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="fitnessGoals">Fitness Goals (Optional)</label>
              <textarea
                id="fitnessGoals"
                name="fitnessGoals"
                value={formData.fitnessGoals}
                onChange={handleInputChange}
                placeholder="What are your main fitness goals? (e.g., weight loss, muscle gain, endurance, etc.)"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="form-section">
          <h3>💳 Payment Information</h3>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="paymentMethod">Preferred Payment Method *</label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleInputChange}
                required
              >
                <option value="cash">Cash (In-person)</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="payment-instructions">
              <h4>Payment Instructions:</h4>
              {formData.paymentMethod === 'cash' && (
                <p>Please bring exact amount to the gym reception. Payment should be made before accessing facilities.</p>
              )}
              {formData.paymentMethod === 'gcash' && (
                <div className="gcash-preview">
                  <p><strong>GCash Payment Process:</strong></p>
                  <div className="gcash-preview-info">
                    <p>📱 Send to: <strong>{gcashReferences.number}</strong></p>
                    <p>💳 Amount: <strong>₱{monthlyPrice}</strong></p>
                    <p>🏢 Account: <strong>{gcashReferences.name}</strong></p>
                  </div>
                  <p className="gcash-note">Complete payment instructions will be shown after form submission</p>
                </div>
              )}
              {formData.paymentMethod === 'bank_transfer' && (
                <div>
                  <p><strong>Bank Transfer Process:</strong></p>
                  <p>1. Submit this application form</p>
                  <p>2. Check your email for our bank account details</p>
                  <p>3. Make transfer and email the deposit slip to our official email</p>
                  <p>4. Your membership will be activated upon payment verification</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="form-section summary-section">
          <h3>📋 Membership Summary</h3>
          <div className="summary-content">
            <div className="summary-item">
              <span>Membership Type:</span>
              <span>{formData.userType === 'regular' ? 'Regular' : 'Student'} Membership</span>
            </div>
            <div className="summary-item">
              <span>Monthly Fee:</span>
              <span>₱{monthlyPrice}</span>
            </div>
            <div className="summary-item">
              <span>Payment Method:</span>
              <span>
                {formData.paymentMethod === 'cash' && 'Cash (In-person)'}
                {formData.paymentMethod === 'gcash' && 'GCash (Payment Pending)'}
                {formData.paymentMethod === 'bank_transfer' && 'Bank Transfer (Payment Pending)'}
              </span>
            </div>
            <div className="summary-item date-info">
              <span>Start Date:</span>
              <span className="date-highlight">{formatDateForDisplay(startDate)}</span>
            </div>
            <div className="summary-item date-info">
              <span>Expiry Date:</span>
              <span className="date-highlight">{formatDateForDisplay(expiryDate)}</span>
            </div>
            <div className="summary-item duration-info">
              <span>Duration:</span>
              <span className="duration-highlight">30 Days</span>
            </div>
            <div className="summary-item total">
              <span><strong>Total Due:</strong></span>
              <span><strong>₱{monthlyPrice}</strong></span>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? 'Processing...' : `Apply for Membership - ₱${monthlyPrice}`}
          </button>
          <p className="payment-note">
            {formData.paymentMethod === 'gcash' || formData.paymentMethod === 'bank_transfer' 
              ? 'Payment instructions will be shown after form submission.'
              : 'Your membership will be activated upon payment verification.'
            }
          </p>
        </div>
      </form>

      {/* Active Memberships Display */}
      {activeMemberships.length > 0 && (
        <div className="memberships-section">
          <h3>📊 Recent Memberships</h3>
          <div className="memberships-list">
            {activeMemberships.map((membership) => (
              <div key={membership.id} className="membership-card">
                <div className="membership-header">
                  <strong>{membership.firstName} {membership.lastName}</strong>
                  <span className={`status-badge ${getMembershipStatusColor(membership.status)}`}>
                    {membership.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="membership-details">
                  <div>ID: {membership.membershipId}</div>
                  <div>Email: {membership.email}</div>
                  <div>Type: {membership.userType} - ₱{membership.monthlyPrice}</div>
                  <div>Start: {membership.startDate.toDate().toLocaleDateString('en-PH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long' 
                  })}</div>
                  <div>Expires: {membership.expiryDate.toDate().toLocaleDateString('en-PH', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'long' 
                  })}</div>
                  {membership.status === 'active' && (
                    <div className="days-remaining">
                      Days Left: <strong>{calculateDaysRemaining(membership.expiryDate)}</strong>
                    </div>
                  )}
                  <div>Payment: {membership.paymentMethod}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chatbot Component */}
      <Chatbot />

      <style jsx>{`
        .monthly-membership-form {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          position: relative;
        }

        /* GCash Modal Styles */
        .gcash-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 1rem;
        }

        .gcash-modal {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }

        .gcash-header {
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
          padding: 1.5rem;
          border-radius: 12px 12px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .gcash-header h2 {
          margin: 0;
          font-size: 1.5rem;
        }

        .close-button {
          background: none;
          border: none;
          color: white;
          font-size: 2rem;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gcash-content {
          padding: 2rem;
        }

        .gcash-info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .gcash-account-info h3,
        .qr-code-section h3 {
          color: #333;
          margin-bottom: 1rem;
          font-size: 1.2rem;
        }

        .account-details {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          border: 2px solid #e9ecef;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #dee2e6;
        }

        .detail-item:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }

        .label {
          font-weight: 600;
          color: #555;
        }

        .value {
          color: #333;
        }

        .highlight {
          color: #007bff;
          font-weight: bold;
          font-size: 1.1rem;
        }

        .qr-code-placeholder {
          text-align: center;
        }

        .qr-code-image {
          background: #f8f9fa;
          border: 2px dashed #dee2e6;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 1rem;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 250px;
        }

        .qr-code {
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .qr-fallback {
          text-align: center;
        }

        .qr-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: #666;
          font-weight: 600;
          background: #e9ecef;
          border-radius: 8px;
          padding: 1rem;
        }

        .qr-note {
          color: #666;
          font-size: 0.9rem;
        }

        .instructions-section {
          margin-bottom: 2rem;
        }

        .instructions-list {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          border: 2px solid #e9ecef;
        }

        .instruction-item {
          margin-bottom: 0.75rem;
          padding-left: 0.5rem;
        }

        .instruction-item:last-child {
          margin-bottom: 0;
        }

        .important-notes {
          background: #fff3cd;
          border: 2px solid #ffeaa7;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .important-notes h3 {
          color: #856404;
          margin-bottom: 1rem;
        }

        .notes-list {
          color: #856404;
        }

        .notes-list li {
          margin-bottom: 0.5rem;
        }

        .confirmation-section {
          background: #d4edda;
          border: 2px solid #c3e6cb;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .confirmation-section h3 {
          color: #155724;
          margin-bottom: 1rem;
        }

        .confirmation-steps {
          color: #155724;
        }

        .confirmation-steps p {
          margin-bottom: 0.5rem;
        }

        .modal-actions {
          text-align: center;
        }

        .done-button {
          background: #28a745;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 6px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .done-button:hover {
          background: #218838;
        }

        .hidden {
          display: none;
        }

        /* GCash Preview in Form */
        .gcash-preview {
          background: #e7f3ff;
          padding: 1rem;
          border-radius: 6px;
          border: 2px solid #007bff;
        }

        .gcash-preview-info {
          background: white;
          padding: 1rem;
          border-radius: 4px;
          margin: 0.5rem 0;
        }

        .gcash-note {
          color: #007bff;
          font-style: italic;
          margin-top: 0.5rem;
        }

        /* Rest of the existing styles... */
        .form-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 2rem;
          border-bottom: 3px solid #007bff;
        }

        .form-header h1 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 2.5rem;
        }

        .tagline {
          color: #666;
          font-size: 1.2rem;
          margin-bottom: 2rem;
          font-style: italic;
        }

        .pricing-display {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-top: 2rem;
        }

        .price-card {
          background: #f8f9fa;
          padding: 2rem;
          border-radius: 12px;
          border: 3px solid #e9ecef;
          text-align: center;
          transition: all 0.3s ease;
        }

        .price-card.active {
          border-color: #28a745;
          background: #e7f3ff;
          transform: scale(1.05);
        }

        .price-card h3 {
          color: #333;
          margin-bottom: 1rem;
        }

        .price {
          font-size: 3rem;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 0.5rem;
        }

        .price-card ul {
          list-style: none;
          padding: 0;
          margin-top: 1rem;
          text-align: left;
        }

        .price-card li {
          padding: 0.5rem 0;
          color: #555;
          border-bottom: 1px solid #dee2e6;
        }

        .price-card li:last-child {
          border-bottom: none;
        }

        .form-section {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #007bff;
        }

        .form-section h3 {
          color: #333;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group.full-width {
          grid-column: 1 / -1;
        }

        .form-group label {
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #555;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 0.75rem;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #007bff;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .membership-type-selector {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .radio-label {
          flex: 1;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 1rem;
          background: white;
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .radio-label:hover {
          border-color: #007bff;
        }

        .radio-label input {
          width: auto;
          margin-top: 0.25rem;
        }

        .radio-content {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .radio-content strong {
          color: #333;
        }

        .radio-content span {
          color: #666;
          font-size: 0.875rem;
        }

        .student-id-input {
          margin-top: 0.5rem;
        }

        .student-id-input input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .payment-instructions {
          grid-column: 1 / -1;
          background: white;
          padding: 1rem;
          border-radius: 6px;
          border: 2px solid #e9ecef;
        }

        .payment-instructions h4 {
          color: #333;
          margin-bottom: 0.5rem;
        }

        .payment-instructions p {
          margin: 0.25rem 0;
          color: #555;
        }

        .summary-section {
          background: #e7f3ff;
          border-left-color: #007bff;
        }

        .summary-content {
          background: white;
          padding: 1.5rem;
          border-radius: 6px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e9ecef;
        }

        .summary-item.date-info {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          margin: 0.5rem 0;
          border: 1px solid #dee2e6;
        }

        .summary-item.duration-info {
          background: #fff3cd;
          padding: 1rem;
          border-radius: 6px;
          margin: 0.5rem 0;
          border: 1px solid #ffeaa7;
        }

        .date-highlight {
          color: #007bff;
          font-weight: 600;
          text-align: right;
        }

        .duration-highlight {
          color: #856404;
          font-weight: 600;
        }

        .summary-item.total {
          border-top: 2px solid #007bff;
          border-bottom: none;
          font-size: 1.2rem;
          margin-top: 0.5rem;
          padding-top: 1rem;
        }

        .submit-message {
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          text-align: center;
          font-weight: 600;
        }

        .submit-message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .submit-message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .form-actions {
          text-align: center;
          margin-top: 2rem;
        }

        .submit-button {
          background: #28a745;
          color: white;
          padding: 1rem 3rem;
          border: none;
          border-radius: 6px;
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }

        .submit-button:hover:not(:disabled) {
          background: #218838;
        }

        .submit-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .payment-note {
          margin-top: 1rem;
          color: #666;
          font-style: italic;
        }

        .memberships-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 3px solid #007bff;
        }

        .memberships-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .membership-card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          border: 2px solid #e9ecef;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .membership-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e9ecef;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 15px;
          font-size: 0.875rem;
          font-weight: 600;
          border: 1px solid;
        }

        .membership-details div {
          margin: 0.25rem 0;
          color: #555;
          font-size: 0.9rem;
        }

        .days-remaining {
          background: #d4edda;
          padding: 0.5rem;
          border-radius: 4px;
          margin: 0.5rem 0;
          text-align: center;
          font-weight: 600;
          color: #155724;
        }

        @media (max-width: 768px) {
          .monthly-membership-form {
            padding: 1rem;
          }

          .pricing-display {
            grid-template-columns: 1fr;
          }

          .price-card.active {
            transform: none;
          }

          .membership-type-selector {
            flex-direction: column;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .gcash-info-section {
            grid-template-columns: 1fr;
          }

          .gcash-modal {
            margin: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MonthlyMembershipForm; 