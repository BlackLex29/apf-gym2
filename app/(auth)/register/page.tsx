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

export default function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [userEmail, setUserEmail] = useState("");
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [successMessage, setSuccessMessage] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const router = useRouter();

    const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL!;
    const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL!;
    
    console.log(`${ADMIN_EMAIL} and ${OWNER_EMAIL}`)

    useEffect(() => {
        if (!showSuccess) return;
        
        console.log(`${ADMIN_EMAIL} and ${OWNER_EMAIL}`)
        
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
        const data = new FormData(e.currentTarget);
        const email = data.get("email") as string;
        const password = data.get("password") as string;

        let role: "admin" | "owner" | "client" = "client";
        if (email === ADMIN_EMAIL) role = "admin";
        else if (email === OWNER_EMAIL) role = "owner";

        setIsLoading(true);
        setErrorMessage(""); // Clear previous errors

        try {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            const userData: UserData = {
                firstName: data.get("firstName") as string,
                lastName: data.get("lastName") as string,
                email,
                phone: data.get("phone") as string,
                role,
                emailVerified: false,
                createdAt: new Date().toISOString(),
            };

            await setDoc(doc(db, "users", user.uid), userData);

            await sendEmailVerification(user);

            setSuccessMessage("Account created successfully! Please check your email to verify your account.");
            setUserEmail(email);
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
                                console.log(`${ADMIN_EMAIL} | ${OWNER_EMAIL} these are the admin emails`);
                                if (isAdmin || isOwner) {
                                    router.push("/a/dashboard");
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
                                <Input
                                    name="firstName"
                                    placeholder="First Name"
                                    required
                                    className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500"
                                />
                                <Input
                                    name="lastName"
                                    placeholder="Last Name"
                                    required
                                    className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500"
                                />
                            </div>

                            <Input
                                name="email"
                                type="email"
                                placeholder="Email address"
                                required
                                className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500"
                            />

                            <Input
                                name="phone"
                                type="tel"
                                placeholder="Phone number"
                                required
                                className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500"
                            />

                            <div className="relative">
                                <Input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    required
                                    className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            <div className="flex items-start space-x-2">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    required
                                    className="mt-1 h-4 w-4 text-orange-500 bg-input border-border rounded focus:ring-orange-500"
                                />
                                <label htmlFor="terms" className="text-sm text-muted-foreground">
                                    I agree to the{" "}
                                    <Link href="/terms" className="text-orange-500 hover:text-orange-400">
                                        Terms
                                    </Link>{" "}
                                    and{" "}
                                    <Link href="/privacy" className="text-orange-500 hover:text-orange-400">
                                        Privacy Policy
                                    </Link>
                                </label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                                disabled={isLoading}
                            >
                                {isLoading ? "Creating..." : "Create Account"}
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
    );
}