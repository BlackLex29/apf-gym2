"use client";
import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import Chatbot from "@/components/Chatbot";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Type definitions - Matching ClientManagement interface
type UserType = "regular" | "student";
type PaymentMethod = "cash" | "gcash" | "bank_transfer";
type MembershipStatus =
  | "active"
  | "pending"
  | "expired"
  | "cancelled"
  | "payment_pending";

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

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: "admin" | "owner" | "client";
  emailVerified: boolean;
  createdAt: string;
}

const MonthlyMembershipForm: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  const [formData, setFormData] = useState<MembershipFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    userType: "regular",
    paymentMethod: "cash",
    studentId: "",
    emergencyContact: "",
    emergencyPhone: "",
    healthConditions: "",
    fitnessGoals: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [activeMemberships, setActiveMemberships] = useState<
    MembershipRecord[]
  >([]);
  const [showGCashModal, setShowGCashModal] = useState(false);

  // GCash References and Instructions
  const gcashReferences = {
    number: "0917-123-4567",
    name: "GymSched Pro Fitness Center",
    qrCode: "/Gcash-qr.jpg",
    instructions: [
      "Open your GCash app",
      'Tap "Send Money"',
      "Enter our GCash number: 0917-123-4567",
      "Enter amount: ₱{amount}",
      "Add your name in the remarks/message",
      "Take screenshot of transaction for verification",
    ],
  };

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

            // Pre-fill form with user data
            setFormData((prev) => ({
              ...prev,
              firstName: userDataFromFirestore.firstName,
              lastName: userDataFromFirestore.lastName,
              email: userDataFromFirestore.email,
              phone: userDataFromFirestore.phone,
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

  // Calculate monthly price based on user type
  const calculateMonthlyPrice = (): number => {
    return formData.userType === "regular" ? 1200 : 1000;
  };

  // Generate unique membership ID
  const generateMembershipId = (): string => {
    const prefix = "GYM";
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
      expiryDate,
    };
  };

  // Format date for display
  const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Load active memberships
  const loadActiveMemberships = async () => {
    try {
      const membershipsRef = collection(db, "monthlyMemberships");
      const q = query(
        membershipsRef,
        where("status", "in", ["active", "pending", "payment_pending"])
      );

      const querySnapshot = await getDocs(q);
      const memberships: MembershipRecord[] = [];

      querySnapshot.forEach((doc) => {
        memberships.push({ id: doc.id, ...doc.data() } as MembershipRecord);
      });

      setActiveMemberships(memberships);
    } catch (error) {
      console.error("Error loading memberships:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is logged in
    if (!currentUser) {
      setSubmitMessage("❌ Please log in to apply for a membership.");
      return;
    }

    // Basic validation
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim()
    ) {
      setSubmitMessage("❌ Please fill in all required fields.");
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
        formData.paymentMethod === "gcash" ? "payment_pending" : "pending";

      // Create membership data WITHOUT undefined fields
      const membershipData: Omit<MembershipRecord, "id"> = {
        ...formData,
        membershipId,
        monthlyPrice,
        startDate: Timestamp.fromDate(startDate),
        expiryDate: Timestamp.fromDate(expiryDate),
        status: initialStatus,
        createdAt: now,
        approvedBy: "",
      };

      // Remove undefined fields before saving
      const cleanMembershipData = Object.fromEntries(
        Object.entries(membershipData).filter(
          ([, value]) => value !== undefined
        )
      );

      console.log("Saving membership data:", cleanMembershipData);

      // Save to Firestore
      const docRef = await addDoc(
        collection(db, "monthlyMemberships"),
        cleanMembershipData
      );

      console.log("Membership saved with ID:", docRef.id);

      // Show GCash modal if GCash payment method selected
      if (formData.paymentMethod === "gcash") {
        setShowGCashModal(true);
      }

      const paymentInstructions =
        formData.paymentMethod === "gcash"
          ? " Please complete your GCash payment using the instructions provided."
          : " Please proceed to the gym reception for cash payment.";

      setSubmitMessage(
        `✅ Monthly membership application submitted! ` +
          `Membership ID: ${membershipId}. ` +
          `Please proceed with payment of ₱${monthlyPrice}. ` +
          `Your membership will be valid from ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(expiryDate)}.${paymentInstructions}`
      );

      // Reset form but keep user type and pre-filled user data
      setFormData({
        firstName: userData?.firstName || "",
        lastName: userData?.lastName || "",
        email: userData?.email || "",
        phone: userData?.phone || "",
        userType: formData.userType,
        paymentMethod: "cash",
        studentId: "",
        emergencyContact: "",
        emergencyPhone: "",
        healthConditions: "",
        fitnessGoals: "",
      });

      // Refresh memberships list
      await loadActiveMemberships();
    } catch (error) {
      console.error("Error saving membership:", error);
      setSubmitMessage(
        "❌ Error processing membership application. Please try again."
      );

      if (error instanceof Error) {
        console.error("Error details:", error.message);
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

  const getMembershipStatusVariant = (status: MembershipStatus) => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "secondary";
      case "payment_pending":
        return "outline";
      case "cancelled":
        return "destructive";
      case "expired":
        return "secondary";
      default:
        return "secondary";
    }
  };

  useEffect(() => {
    loadActiveMemberships();
  }, []);

  const monthlyPrice = calculateMonthlyPrice();
  const { startDate, expiryDate } = calculateMembershipDates();

  // Show loading state while fetching user data
  if (isLoadingUser) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <Card className="w-full">
          <CardContent className="p-6 text-center">
            <div className="flex justify-center items-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span>Loading your information...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show login prompt if user is not logged in
  if (!currentUser) {
    return (
      <div className="container mx-auto p-4 max-w-6xl">
        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">🔐 Login Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p>Please log in to apply for a monthly membership.</p>
            <Button onClick={() => (window.location.href = "/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      {/* GCash Payment Modal */}
      {showGCashModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-primary text-primary-foreground">
              <div className="flex justify-between items-center">
                <CardTitle>💰 GCash Payment Instructions</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowGCashModal(false)}
                  className="text-primary-foreground hover:bg-primary-foreground/20"
                >
                  ×
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-4">Send Payment To:</h3>
                  <div className="space-y-3 bg-muted p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">GCash Number:</span>
                      <span className="font-bold text-primary">
                        {gcashReferences.number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Account Name:</span>
                      <span>{gcashReferences.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Amount:</span>
                      <span className="font-bold text-primary">
                        ₱{monthlyPrice}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-4">Or Scan QR Code:</h3>
                  <div className="bg-muted p-4 rounded-lg flex flex-col items-center">
                    <div className="relative">
                      <Image
                        src={gcashReferences.qrCode}
                        alt="GCash QR Code"
                        width={200}
                        height={200}
                        className="rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Scan this QR code using your GCash app
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">📱 Payment Steps:</h3>
                <ol className="space-y-2 bg-muted p-4 rounded-lg">
                  {gcashReferences.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start">
                      <span className="font-bold mr-2">{index + 1}.</span>
                      {instruction.replace("{amount}", monthlyPrice.toString())}
                    </li>
                  ))}
                </ol>
              </div>

              <Alert>
                <AlertDescription className="space-y-2">
                  <h4 className="font-semibold">⚠️ Important Notes:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Include your FULL NAME in the transaction remarks</li>
                    <li>Take a screenshot of the payment confirmation</li>
                    <li>
                      Your membership will be activated within 1-2 hours after
                      payment verification
                    </li>
                    <li>For issues, contact us at: gymschedpro@gmail.com</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="text-center">
                <Button onClick={() => setShowGCashModal(false)}>
                  I Understand, Close Instructions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="w-full">
        <CardHeader className="text-center border-b">
          <CardTitle className="text-3xl">🏋️ Monthly Gym Membership</CardTitle>
          <p className="text-muted-foreground text-lg">
            Start Your Fitness Journey Today!
          </p>

          {/* User Info Banner */}
          <Alert className="mt-4 bg-primary/5 border-primary/20">
            <AlertDescription>
              <strong>Welcome back, {userData?.firstName}!</strong> Your basic
              information has been pre-filled from your account.
            </AlertDescription>
          </Alert>

          {/* CLICKABLE MEMBERSHIP CARDS */}
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <Card 
              className={`
                cursor-pointer transition-all duration-200 
                ${formData.userType === "regular" 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-accent/50"}
              `}
              onClick={() => handleSelectChange("userType", "regular")}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">Regular Membership</h3>
                  {formData.userType === "regular" && (
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                  )}
                </div>
                <div className="text-3xl font-bold text-primary mb-2">
                  ₱1,200
                </div>
                <p className="text-muted-foreground mb-4">per month</p>
                <ul className="space-y-2 text-sm">
                  <li>✅ Unlimited gym access</li>
                  <li>✅ All equipment usage</li>
                  <li>✅ Locker facilities</li>
                  <li>✅ Towel service</li>
                  <li>✅ Free fitness assessment</li>
                </ul>
              </CardContent>
            </Card>

            <Card 
              className={`
                cursor-pointer transition-all duration-200 
                ${formData.userType === "student" 
                  ? "ring-2 ring-primary bg-primary/5" 
                  : "hover:bg-accent/50"}
              `}
              onClick={() => handleSelectChange("userType", "student")}
            >
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">Student Membership</h3>
                  {formData.userType === "student" && (
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                  )}
                </div>
                <div className="text-3xl font-bold text-primary mb-2">
                  ₱1,000
                </div>
                <p className="text-muted-foreground mb-4">per month</p>
                <ul className="space-y-2 text-sm">
                  <li>✅ All regular benefits</li>
                  <li>✅ Special student hours</li>
                  <li>✅ Student events</li>
                  <li>✅ Group workout sessions</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {submitMessage && (
            <Alert
              variant={submitMessage.includes("✅") ? "default" : "destructive"}
              className="mb-6"
            >
              <AlertDescription>{submitMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">👤 Basic Information</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your basic information has been pre-filled from your account.
                  You can update if needed.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your first name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your last name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your email address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Student ID Field (Only shows when Student is selected) */}
            {formData.userType === "student" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🎓 Student Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Student ID (Optional)</Label>
                    <Input
                      id="studentId"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleInputChange}
                      placeholder="Enter your student ID"
                    />
                    <p className="text-xs text-muted-foreground">
                      Providing your student ID helps us verify your student status.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🚨 Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">
                      Emergency Contact Name *
                    </Label>
                    <Input
                      id="emergencyContact"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleInputChange}
                      required
                      placeholder="Full name of emergency contact"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">
                      Emergency Contact Phone *
                    </Label>
                    <Input
                      id="emergencyPhone"
                      name="emergencyPhone"
                      type="tel"
                      value={formData.emergencyPhone}
                      onChange={handleInputChange}
                      required
                      placeholder="Emergency contact phone number"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">❤️ Health Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="healthConditions">
                      Health Conditions (Optional)
                    </Label>
                    <Textarea
                      id="healthConditions"
                      name="healthConditions"
                      value={formData.healthConditions}
                      onChange={handleInputChange}
                      placeholder="Please list any health conditions, allergies, or medications we should be aware of..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fitnessGoals">
                      Fitness Goals (Optional)
                    </Label>
                    <Textarea
                      id="fitnessGoals"
                      name="fitnessGoals"
                      value={formData.fitnessGoals}
                      onChange={handleInputChange}
                      placeholder="What are your main fitness goals? (e.g., weight loss, muscle gain, endurance, etc.)"
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  💳 Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Select Payment Method *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value: PaymentMethod) => 
                        handleSelectChange("paymentMethod", value)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">
                          <div className="flex items-center space-x-2">
                            <span>💵 Cash (In-person)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="gcash">
                          <div className="flex items-center space-x-2">
                            <span>📱 GCash</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="bank_transfer">
                          <div className="flex items-center space-x-2">
                            <span>🏦 Bank Transfer</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {formData.paymentMethod === "cash" && 
                        "Please bring exact amount to the gym reception. Payment should be made before accessing facilities."}
                      {formData.paymentMethod === "gcash" && 
                        "Complete GCash payment using the instructions provided after form submission."}
                      {formData.paymentMethod === "bank_transfer" && 
                        "Bank account details will be provided after form submission. Email deposit slip for verification."}
                    </p>
                  </div>

                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-2">
                        Payment Instructions:
                      </h4>
                      {formData.paymentMethod === "cash" && (
                        <div className="space-y-2">
                          <p><strong>Cash Payment Process:</strong></p>
                          <div className="bg-background p-3 rounded space-y-1 text-sm">
                            <p>💰 Amount: <strong>₱{monthlyPrice}</strong></p>
                            <p>📍 Location: Gym Reception Counter</p>
                            <p>⏰ Payment: Before accessing facilities</p>
                          </div>
                          <p className="text-sm">
                            Please bring exact amount to avoid delays in processing.
                          </p>
                        </div>
                      )}
                      {formData.paymentMethod === "gcash" && (
                        <div className="space-y-2">
                          <p><strong>GCash Payment Process:</strong></p>
                          <div className="bg-background p-3 rounded space-y-1 text-sm">
                            <p>📱 Send to: <strong>{gcashReferences.number}</strong></p>
                            <p>💳 Amount: <strong>₱{monthlyPrice}</strong></p>
                            <p>🏢 Account: <strong>{gcashReferences.name}</strong></p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Complete payment instructions will be shown after form submission
                          </p>
                        </div>
                      )}
                      {formData.paymentMethod === "bank_transfer" && (
                        <div className="space-y-2 text-sm">
                          <p><strong>Bank Transfer Process:</strong></p>
                          <p>1. Submit this application form</p>
                          <p>2. Check your email for our bank account details</p>
                          <p>3. Make transfer and email the deposit slip to our official email</p>
                          <p>4. Your membership will be activated upon payment verification</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">📋 Membership Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 bg-background p-4 rounded-lg">
                  <div className="flex justify-between">
                    <span>Membership Type:</span>
                    <span>
                      {formData.userType === "regular" ? "Regular" : "Student"}{" "}
                      Membership
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly Fee:</span>
                    <span>₱{monthlyPrice}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span>
                      {formData.paymentMethod === "cash" && "Cash (In-person)"}
                      {formData.paymentMethod === "gcash" &&
                        "GCash (Payment Pending)"}
                      {formData.paymentMethod === "bank_transfer" &&
                        "Bank Transfer (Payment Pending)"}
                    </span>
                  </div>
                  <div className="flex justify-between bg-muted p-2 rounded">
                    <span>Start Date:</span>
                    <span className="font-semibold">
                      {formatDateForDisplay(startDate)}
                    </span>
                  </div>
                  <div className="flex justify-between bg-muted p-2 rounded">
                    <span>Expiry Date:</span>
                    <span className="font-semibold">
                      {formatDateForDisplay(expiryDate)}
                    </span>
                  </div>
                  <div className="flex justify-between bg-warning/20 p-2 rounded">
                    <span>Duration:</span>
                    <span className="font-semibold">30 Days</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold text-lg">
                    <span>Total Due:</span>
                    <span>₱{monthlyPrice}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="text-center space-y-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto px-8 py-3 text-lg"
                size="lg"
              >
                {isSubmitting
                  ? "Processing..."
                  : `Apply for Membership - ₱${monthlyPrice}`}
              </Button>
              <p className="text-sm text-muted-foreground">
                {formData.paymentMethod === "gcash" ||
                formData.paymentMethod === "bank_transfer"
                  ? "Payment instructions will be shown after form submission."
                  : "Your membership will be activated upon payment verification."}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* REMOVED: Active Memberships Display - HINDI NA ITO IPAPAKITA */}

      {/* Chatbot Component */}
      <Chatbot />
    </div>
  );
};

export default MonthlyMembershipForm;