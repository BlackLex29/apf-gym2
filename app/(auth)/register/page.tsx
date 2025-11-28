"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dumbbell,
    Eye,
    EyeOff,
    ArrowRight,
    Mail,
    AlertCircle,
    CheckCircle,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

import { auth, db } from "@/lib/firebase";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    AuthError
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Type for user data in Firestore
interface UserData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: 'admin' | 'owner' | 'client';
    emailVerified: boolean;
    createdAt: string;
}

// Type for form validation errors
interface FormErrors {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
}

// Type for form data
interface FormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    terms: boolean;
}

// Type guard for AuthError
function isAuthError(error: unknown): error is AuthError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'name' in error &&
        typeof error.code === 'string' &&
        error.code.startsWith('auth/')
    );
}

// Validation functions
const validateFirstName = (firstName: string): string | undefined => {
    if (!firstName.trim()) return "First name is required";
    if (firstName.length < 2) return "First name must be at least 2 characters";
    if (firstName.length > 50) return "First name must be less than 50 characters";
    if (!/^[a-zA-Z\s\-']+$/.test(firstName)) return "First name can only contain letters, spaces, hyphens, and apostrophes";
    return undefined;
};

const validateLastName = (lastName: string): string | undefined => {
    if (!lastName.trim()) return "Last name is required";
    if (lastName.length < 2) return "Last name must be at least 2 characters";
    if (lastName.length > 50) return "Last name must be less than 50 characters";
    if (!/^[a-zA-Z\s\-']+$/.test(lastName)) return "Last name can only contain letters, spaces, hyphens, and apostrophes";
    return undefined;
};

const validateEmail = (email: string): string | undefined => {
    if (!email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address";
    return undefined;
};

const validatePhone = (phone: string): string | undefined => {
    if (!phone.trim()) return "Phone number is required";
    // Remove all non-digit characters for validation
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Philippine phone number validation
    if (cleanPhone.length < 10) return "Phone number must be at least 10 digits";
    if (cleanPhone.length > 11) return "Phone number must be 10 or 11 digits";
    
    // Check if it starts with Philippine mobile prefixes (09, +639, 639)
    if (!/^(09|\+?639|639)\d+$/.test(cleanPhone)) {
        return "Please enter a valid Philippine mobile number (starts with 09)";
    }
    
    // Check if it's exactly 10 or 11 digits after cleaning
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
        return "Philippine mobile numbers must be 10 or 11 digits";
    }
    
    return undefined;
};

const validatePassword = (password: string): string | undefined => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    if (password.length > 128) return "Password must be less than 128 characters";
    if (!/(?=.*[a-z])/.test(password)) return "Password must contain at least one lowercase letter";
    if (!/(?=.*[A-Z])/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/(?=.*\d)/.test(password)) return "Password must contain at least one number";
    if (!/(?=.*[@$!%*?&])/.test(password)) return "Password must contain at least one special character (@$!%*?&)";
    return undefined;
};

const validateConfirmPassword = (password: string, confirmPassword: string): string | undefined => {
    if (!confirmPassword) return "Please confirm your password";
    if (password !== confirmPassword) return "Passwords do not match";
    return undefined;
};

const validateTerms = (terms: boolean): string | undefined => {
    if (!terms) return "You must accept the terms and conditions";
    return undefined;
};

// Terms and Conditions Modal Component
function TermsModal({ isOpen, onClose, onAccept }: { 
    isOpen: boolean; 
    onClose: () => void; 
    onAccept: () => void;
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-lg max-w-2xl max-h-[80vh] w-full overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-foreground">Terms and Conditions</h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                    <div className="space-y-4 text-sm text-muted-foreground">
                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">1. Membership Agreement</h3>
                            <p>By creating an account with GymSchedPro APF Tanauan, you agree to abide by our gym rules and regulations. Membership fees are non-refundable and automatically renew monthly unless cancelled.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">2. Booking and Cancellations</h3>
                            <p>Training sessions must be booked at least 24 hours in advance. Cancellations within 12 hours of the session may incur a fee. No-shows will be charged the full session rate.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">3. Payment Terms</h3>
                            <p>All payments are processed securely through GCash. Monthly memberships auto-renew on the same date each month. You are responsible for maintaining sufficient funds in your GCash account.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">4. Health and Safety</h3>
                            <p>You confirm that you are in good physical condition and have consulted with a physician before beginning any exercise program. GymSchedPro is not liable for any injuries sustained during training sessions.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">5. Code of Conduct</h3>
                            <p>Respectful behavior towards staff and other members is required. Proper gym attire must be worn at all times. Equipment must be used properly and returned to its designated area after use.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">6. Privacy Policy</h3>
                            <p>Your personal information is protected and will not be shared with third parties without your consent. We use your data solely for gym management, communication, and service improvement purposes.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">7. Termination</h3>
                            <p>We reserve the right to terminate membership for violations of gym rules, non-payment, or inappropriate behavior. Members may cancel their membership with 30 days written notice.</p>
                        </section>

                        <section>
                            <h3 className="text-lg font-semibold text-foreground mb-2">8. Communications</h3>
                            <p>By registering, you agree to receive communications from GymSchedPro regarding your account, booking reminders, promotions, and gym updates. You can opt-out of promotional emails at any time.</p>
                        </section>
                    </div>
                </div>

                <div className="flex gap-3 p-6 border-t border-border bg-muted/50">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="flex-1 border-border text-muted-foreground hover:text-foreground"
                    >
                        Decline
                    </Button>
                    <Button
                        onClick={onAccept}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                    >
                        I Accept Terms
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [userEmail, setUserEmail] = useState("");
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [successMessage, setSuccessMessage] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [formData, setFormData] = useState<FormData>({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
        terms: false
    });
    const router = useRouter();

    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;
    const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL!;

    // Format Philippine phone number as user types
    const formatPhoneNumber = (value: string): string => {
        // Remove all non-digit characters
        const cleanValue = value.replace(/\D/g, '');
        
        // Apply Philippine mobile number formatting
        if (cleanValue.length === 0) return '';
        if (cleanValue.length <= 3) {
            return cleanValue;
        } else if (cleanValue.length <= 6) {
            return `${cleanValue.slice(0, 4)} ${cleanValue.slice(4)}`;
        } else if (cleanValue.length <= 10) {
            return `${cleanValue.slice(0, 4)} ${cleanValue.slice(4, 7)} ${cleanValue.slice(7)}`;
        } else {
            return `${cleanValue.slice(0, 4)} ${cleanValue.slice(4, 7)} ${cleanValue.slice(7, 11)}`;
        }
    };

    // Handle input changes with validation
    const handleInputChange = (field: keyof FormData, value: string | boolean) => {
        const newFormData = { ...formData, [field]: value };
        setFormData(newFormData);

        // Validate the changed field
        let error: string | undefined;

        switch (field) {
            case 'firstName':
                error = validateFirstName(value as string);
                break;
            case 'lastName':
                error = validateLastName(value as string);
                break;
            case 'email':
                error = validateEmail(value as string);
                break;
            case 'phone':
                error = validatePhone(value as string);
                break;
            case 'password':
                error = validatePassword(value as string);
                // Also validate confirm password if it's already filled
                if (newFormData.confirmPassword) {
                    setFormErrors(prev => ({
                        ...prev,
                        confirmPassword: validateConfirmPassword(value as string, newFormData.confirmPassword)
                    }));
                }
                break;
            case 'confirmPassword':
                error = validateConfirmPassword(newFormData.password, value as string);
                break;
            case 'terms':
                error = validateTerms(value as boolean);
                break;
        }

        setFormErrors(prev => ({
            ...prev,
            [field]: error
        }));
    };

    // Special handler for phone number with formatting
    const handlePhoneChange = (value: string) => {
        const formattedValue = formatPhoneNumber(value);
        handleInputChange('phone', formattedValue);
    };

    // Validate entire form
    const validateForm = (): boolean => {
        const errors: FormErrors = {
            firstName: validateFirstName(formData.firstName),
            lastName: validateLastName(formData.lastName),
            email: validateEmail(formData.email),
            phone: validatePhone(formData.phone),
            password: validatePassword(formData.password),
            confirmPassword: validateConfirmPassword(formData.password, formData.confirmPassword),
            terms: validateTerms(formData.terms)
        };

        setFormErrors(errors);

        // Check if there are any errors
        return !Object.values(errors).some(error => error !== undefined);
    };

    useEffect(() => {
        if (!showSuccess) return;
        
        // Check verification status every 3 seconds
        const checkInterval = setInterval(async () => {
            const user = auth.currentUser;
            if (user && !isVerified) {
                await user.reload();

                if (user.emailVerified) {
                    setIsVerified(true);

                    // Update Firestore
                    await setDoc(doc(db, "users", user.uid), {
                        emailVerified: true,
                    }, { merge: true });

                    // Determine redirect based on role
                    const isAdmin = user.email === ADMIN_EMAIL;
                    const isOwner = user.email === OWNER_EMAIL;

                    // Show success and redirect after 2 seconds
                    setTimeout(() => {
                        if (isAdmin || isOwner) {
                            router.push("/admin/dashboard");
                        } else {
                            router.push("/login");
                        }
                    }, 2000);

                    clearInterval(checkInterval);
                }
            }
        }, 3000);

        return () => clearInterval(checkInterval);
    }, [showSuccess, isVerified, router, ADMIN_EMAIL, OWNER_EMAIL]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMessage("");

        // Validate form before submission
        if (!validateForm()) {
            setErrorMessage("Please fix the errors in the form before submitting.");
            return;
        }

        if (!termsAccepted) {
            setErrorMessage("You must accept the Terms and Conditions to register.");
            return;
        }

        setIsLoading(true);

        try {
            // Clean phone number before saving (remove spaces and formatting)
            const cleanPhone = formData.phone.replace(/\D/g, '');

            const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

            const userData: UserData = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email,
                phone: cleanPhone, // Save cleaned phone number
                role: formData.email === ADMIN_EMAIL ? "admin" : formData.email === OWNER_EMAIL ? "owner" : "client",
                emailVerified: false,
                createdAt: new Date().toISOString(),
            };

            await setDoc(doc(db, "users", user.uid), userData);
            await sendEmailVerification(user);

            setSuccessMessage("Account created successfully! Please check your email to verify your account.");
            setUserEmail(formData.email);
            setShowSuccess(true);
        } catch (err: unknown) {
            // Handle specific Firebase errors
            if (isAuthError(err)) {
                switch (err.code) {
                    case "auth/email-already-in-use":
                        setErrorMessage("This email is already registered. Please sign in or use a different email.");
                        break;
                    case "auth/weak-password":
                        setErrorMessage("Password should be at least 6 characters long.");
                        break;
                    case "auth/invalid-email":
                        setErrorMessage("Please enter a valid email address.");
                        break;
                    case "auth/operation-not-allowed":
                        setErrorMessage("Email/password accounts are not enabled. Please contact support.");
                        break;
                    case "auth/network-request-failed":
                        setErrorMessage("Network error. Please check your connection.");
                        break;
                    default:
                        setErrorMessage(err.message || "Registration failed. Please try again.");
                }
            } else if (err instanceof Error) {
                setErrorMessage(err.message || "Registration failed. Please try again.");
            } else {
                setErrorMessage("An unexpected error occurred. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (resendCooldown > 0 || !auth.currentUser) return;

        setIsResending(true);
        try {
            await sendEmailVerification(auth.currentUser);
            alert("Verification email resent! Check your inbox.");

            setResendCooldown(60);
            const interval = setInterval(() => {
                setResendCooldown((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (err: unknown) {
            let errorMessage = "Failed to resend verification email.";
            
            if (isAuthError(err)) {
                switch (err.code) {
                    case "auth/too-many-requests":
                        errorMessage = "Too many attempts. Please try again later.";
                        break;
                    default:
                        errorMessage = err.message || errorMessage;
                }
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            
            alert(errorMessage);
        } finally {
            setIsResending(false);
        }
    };

    const handleAcceptTerms = () => {
        setTermsAccepted(true);
        setFormData(prev => ({ ...prev, terms: true }));
        setShowTermsModal(false);
    };

    const handleDeclineTerms = () => {
        setTermsAccepted(false);
        setFormData(prev => ({ ...prev, terms: false }));
        setShowTermsModal(false);
    };

    // ─────────────────────────────────────
    // SUCCESS SCREEN – WITH VERIFICATION WARNING
    // ─────────────────────────────────────
    if (showSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background via-muted to-orange-900/20 flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-card/90 border-orange-500/20 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="p-3 bg-orange-500 rounded-full">
                                <Mail className="h-8 w-8 text-black" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-bold text-foreground">
                            Check Your Email
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            We sent a verification link to
                            <br />
                            <span className="font-semibold text-orange-500">{userEmail}</span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* SUCCESS MESSAGE */}
                        {!isVerified && successMessage && (
                            <Alert className="border-green-500 bg-green-500/10">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <AlertDescription className="text-green-500">
                                    {successMessage}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* VERIFIED MESSAGE */}
                        {isVerified && (
                            <Alert className="border-green-500 bg-green-500/10">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <AlertDescription className="text-green-500 font-semibold">
                                    ✅ Email verified successfully! Redirecting to login...
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* VERIFICATION REQUIRED BANNER */}
                        {!isVerified && (
                            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                        Account Verification Required
                                    </p>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                        You must verify your email before accessing your account.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                            <p className="text-sm text-muted-foreground">
                                Click the link in the email to activate your account.
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Check your spam/junk folder if you don&#39;t see it.
                            </p>
                            {isVerified && (
                                <p className="text-xs text-green-600 dark:text-green-400 font-semibold">
                                    ✓ Verification detected! You&#39;ll be redirected shortly.
                                </p>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-2 text-muted-foreground">
                                    Didn&#39;t receive it?
                                </span>
                            </div>
                        </div>

                        <Button
                            onClick={handleResendVerification}
                            variant="outline"
                            className="w-full border-orange-500/50 text-orange-500 hover:bg-orange-500 hover:text-black"
                            disabled={isResending || resendCooldown > 0 || isVerified}
                        >
                            {isResending
                                ? "Resending..."
                                : resendCooldown > 0
                                    ? `Resend in ${resendCooldown}s`
                                    : isVerified
                                        ? "Email Verified ✓"
                                        : "Resend Verification Email"}
                        </Button>
                        <Button
                            onClick={() => {
                                const user = auth.currentUser;
                                const isAdmin = user?.email === ADMIN_EMAIL;
                                const isOwner = user?.email === OWNER_EMAIL;
                                if (isAdmin || isOwner) {
                                    router.push("/admin/dashboard");
                                } else {
                                    router.push("/login");
                                }
                            }}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                            disabled={isVerified}
                        >
                            {isVerified ? "Redirecting..." : "Go to Login"}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ─────────────────────────────────────
    // MAIN FORM
    // ─────────────────────────────────────
    return (
        <>
            <div className="min-h-screen bg-gradient-to-br from-background via-muted to-orange-900/20 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
                    {/* Left */}
                    <div className="text-center lg:text-left space-y-6">
                        <div className="flex items-center justify-center lg:justify-start gap-3">
                            <div className="p-3 bg-orange-500 rounded-full">
                                <Dumbbell className="h-10 w-10 text-black" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold text-foreground">GymSchedPro</h1>
                                <p className="text-orange-500 font-semibold">APF Tanauan</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-3xl font-bold text-foreground leading-tight">
                                <span className="text-balance">Create Your Account</span>
                                <br />
                                <span className="text-balance text-orange-500">
                                    Start Training Smarter
                                </span>
                            </h2>
                            <p className="text-muted-foreground text-lg">
                                Join APF Tanauan and get instant access to booking, coach chat, and
                                progress tracking.
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => router.push("/")}
                            className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                        >
                            Back to Home
                        </Button>
                    </div>

                    {/* Right */}
                    <Card className="bg-card/90 border-orange-500/20 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold text-center">
                                Sign Up
                            </CardTitle>
                            <CardDescription className="text-center">
                                Fill in the details to create your account
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Error Message */}
                                {errorMessage && (
                                    <Alert className="border-red-500 bg-red-500/10">
                                        <AlertCircle className="h-4 w-4 text-red-500" />
                                        <AlertDescription className="text-red-500">
                                            {errorMessage}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Input
                                            name="firstName"
                                            placeholder="First Name"
                                            value={formData.firstName}
                                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                                            required
                                            className={`bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 ${
                                                formErrors.firstName ? 'border-red-500' : ''
                                            }`}
                                        />
                                        {formErrors.firstName && (
                                            <p className="text-xs text-red-500">{formErrors.firstName}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Input
                                            name="lastName"
                                            placeholder="Last Name"
                                            value={formData.lastName}
                                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                                            required
                                            className={`bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 ${
                                                formErrors.lastName ? 'border-red-500' : ''
                                            }`}
                                        />
                                        {formErrors.lastName && (
                                            <p className="text-xs text-red-500">{formErrors.lastName}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Input
                                        name="email"
                                        type="email"
                                        placeholder="Email address"
                                        value={formData.email}
                                        onChange={(e) => handleInputChange('email', e.target.value)}
                                        required
                                        className={`bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 ${
                                            formErrors.email ? 'border-red-500' : ''
                                        }`}
                                    />
                                    {formErrors.email && (
                                        <p className="text-xs text-red-500">{formErrors.email}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Input
                                        name="phone"
                                        type="tel"
                                        placeholder="0917 123 4567"
                                        value={formData.phone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        required
                                        className={`bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 ${
                                            formErrors.phone ? 'border-red-500' : ''
                                        }`}
                                    />
                                    {formErrors.phone && (
                                        <p className="text-xs text-red-500">{formErrors.phone}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Enter your Philippine mobile number (e.g., 0917 123 4567)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Password"
                                            value={formData.password}
                                            onChange={(e) => handleInputChange('password', e.target.value)}
                                            required
                                            className={`bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 pr-10 ${
                                                formErrors.password ? 'border-red-500' : ''
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {formErrors.password && (
                                        <p className="text-xs text-red-500">{formErrors.password}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                        Password must contain: 6+ characters, uppercase, lowercase, number, and special character (@$!%*?&)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative">
                                        <Input
                                            name="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Confirm Password"
                                            value={formData.confirmPassword}
                                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                                            required
                                            className={`bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 pr-10 ${
                                                formErrors.confirmPassword ? 'border-red-500' : ''
                                            }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {formErrors.confirmPassword && (
                                        <p className="text-xs text-red-500">{formErrors.confirmPassword}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-start space-x-2">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            checked={termsAccepted}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setShowTermsModal(true);
                                                } else {
                                                    setTermsAccepted(false);
                                                    setFormData(prev => ({ ...prev, terms: false }));
                                                }
                                            }}
                                            className="mt-1 h-4 w-4 text-orange-500 bg-input border-border rounded focus:ring-orange-500"
                                        />
                                        <label htmlFor="terms" className="text-sm text-muted-foreground">
                                            I agree to the{" "}
                                            <button
                                                type="button"
                                                onClick={() => setShowTermsModal(true)}
                                                className="text-orange-500 hover:text-orange-400 underline"
                                            >
                                                Terms and Conditions
                                            </button>
                                        </label>
                                    </div>
                                    {formErrors.terms && (
                                        <p className="text-xs text-red-500">{formErrors.terms}</p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                                    disabled={isLoading || !termsAccepted}
                                >
                                    {isLoading ? "Creating Account..." : "Create Account"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>

                                <p className="text-center text-sm text-muted-foreground">
                                    Already have an account?{" "}
                                    <Link href="/login" className="text-orange-500 hover:text-orange-400">
                                        Sign in
                                    </Link>
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Terms and Conditions Modal */}
            <TermsModal
                isOpen={showTermsModal}
                onClose={handleDeclineTerms}
                onAccept={handleAcceptTerms}
            />
        </>
    );
}