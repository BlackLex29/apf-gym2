"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Dumbbell,
    Eye,
    EyeOff,
    ArrowRight,
    AlertCircle,
    Shield,
    Lock,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import {
    signInWithEmailAndPassword,
    getMultiFactorResolver,
    TotpMultiFactorGenerator,
    MultiFactorResolver,
    MultiFactorError,
    AuthError,
    sendEmailVerification
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    setDoc, 
    Timestamp
} from "firebase/firestore";

// Type for Firebase user document
interface UserData {
    role?: 'admin' | 'owner' | 'client' | 'coach';
}

// Type for login attempts tracking
interface LoginAttempts {
    attempts: number;
    lastAttempt: Timestamp;
    lockedUntil: Timestamp | null;
    email: string;
}

// Type guard to check if error is MultiFactorError
function isMultiFactorError(error: unknown): error is MultiFactorError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        'name' in error &&
        error.code === 'auth/multi-factor-auth-required'
    );
}

// Type guard to check if error is AuthError
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

export default function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [totpCode, setTotpCode] = useState("");
    const [isLocked, setIsLocked] = useState(false);
    const [lockTimeLeft, setLockTimeLeft] = useState(0);
    const [attemptsLeft, setAttemptsLeft] = useState(5);
    const [currentEmail, setCurrentEmail] = useState("");
    const router = useRouter();

    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION_MINUTES = 10;
    const LOCK_DURATION_MS = LOCK_DURATION_MINUTES * 60 * 1000;

    // Check lock status when email changes or component mounts
    useEffect(() => {
        if (currentEmail) {
            checkIfLocked(currentEmail);
        }
    }, [currentEmail]);

    const getLoginAttempts = async (email: string): Promise<LoginAttempts | null> => {
        try {
            const attemptsRef = doc(db, "loginAttempts", email);
            const attemptsDoc = await getDoc(attemptsRef);
            
            if (attemptsDoc.exists()) {
                return attemptsDoc.data() as LoginAttempts;
            }
            return null;
        } catch (error) {
            console.error("Error getting login attempts:", error);
            return null;
        }
    };

    const updateLoginAttempts = async (email: string, success: boolean): Promise<void> => {
        try {
            const attemptsRef = doc(db, "loginAttempts", email);
            const now = Timestamp.now();
            
            if (success) {
                // Reset attempts on successful login
                await setDoc(attemptsRef, {
                    attempts: 0,
                    lastAttempt: now,
                    lockedUntil: null,
                    email: email
                });
                setIsLocked(false);
                setAttemptsLeft(MAX_ATTEMPTS);
                setLockTimeLeft(0);
            } else {
                const existingAttempts = await getLoginAttempts(email);
                const currentAttempts = existingAttempts ? existingAttempts.attempts + 1 : 1;
                
                if (currentAttempts >= MAX_ATTEMPTS) {
                    const lockedUntil = new Timestamp(now.seconds + (LOCK_DURATION_MINUTES * 60), now.nanoseconds);
                    
                    await setDoc(attemptsRef, {
                        attempts: currentAttempts,
                        lastAttempt: now,
                        lockedUntil: lockedUntil,
                        email: email
                    });
                    
                    setIsLocked(true);
                    startLockTimer(lockedUntil);
                } else {
                    await setDoc(attemptsRef, {
                        attempts: currentAttempts,
                        lastAttempt: now,
                        lockedUntil: null,
                        email: email
                    });
                    setAttemptsLeft(MAX_ATTEMPTS - currentAttempts);
                    setIsLocked(false);
                }
            }
        } catch (error) {
            console.error("Error updating login attempts:", error);
        }
    };

    const startLockTimer = (lockedUntil: Timestamp) => {
        const updateTimer = () => {
            const now = Date.now();
            const lockedUntilMs = lockedUntil.toMillis();
            const timeLeft = Math.max(0, lockedUntilMs - now);
            
            setLockTimeLeft(Math.ceil(timeLeft / 1000));
            
            if (timeLeft <= 0) {
                setIsLocked(false);
                setAttemptsLeft(MAX_ATTEMPTS);
                // Clear the lock from Firestore
                if (currentEmail) {
                    updateLoginAttempts(currentEmail, true);
                }
            } else {
                setTimeout(updateTimer, 1000);
            }
        };
        
        updateTimer();
    };

    const checkIfLocked = async (email: string): Promise<boolean> => {
        const attempts = await getLoginAttempts(email);
        
        if (!attempts) {
            setIsLocked(false);
            setAttemptsLeft(MAX_ATTEMPTS);
            return false;
        }

        if (attempts.lockedUntil) {
            const now = Timestamp.now();
            const lockedUntil = attempts.lockedUntil;
            
            if (lockedUntil.seconds > now.seconds) {
                // Still locked - calculate time left
                const timeLeftMs = lockedUntil.toMillis() - now.toMillis();
                setLockTimeLeft(Math.ceil(timeLeftMs / 1000));
                setIsLocked(true);
                setAttemptsLeft(0);
                startLockTimer(lockedUntil);
                return true;
            } else {
                // Lock period expired - reset attempts
                await updateLoginAttempts(email, true);
                return false;
            }
        }
        
        // Not locked, but show remaining attempts
        setAttemptsLeft(MAX_ATTEMPTS - attempts.attempts);
        setIsLocked(false);
        return false;
    };

    const handleFirstFactor = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setMfaResolver(null);

        const data = new FormData(e.currentTarget);
        const email = data.get("email") as string;
        const password = data.get("password") as string;

        setCurrentEmail(email);

        // Check if account is locked
        const locked = await checkIfLocked(email);
        if (locked) {
            setError(`Account temporarily locked. Please try again in ${formatTimeLeft(lockTimeLeft)}.`);
            return;
        }

        console.log("🔐 [LOGIN] Starting login process for:", email);
        setIsLoading(true);

        try {
            if (!auth) {
                throw new Error("Authentication service is not available.");
            }

            console.log("🔐 [LOGIN] Attempting Firebase authentication...");
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Successful login - reset attempts
            await updateLoginAttempts(email, true);

            console.log("✅ [LOGIN] Firebase authentication successful");
            console.log("👤 [LOGIN] User UID:", user.uid);
            console.log("📧 [LOGIN] Email verified:", user.emailVerified);

            // Check if email is verified
            if (!user.emailVerified) {
                console.warn("⚠️ [LOGIN] Email not verified, sending verification email...");
                await sendEmailVerification(user);
                await auth.signOut();

                setError(
                    "Please verify your email address. We've just sent you a new verification link to " +
                    email +
                    ". Check your inbox (and spam folder)."
                );

                setTimeout(() => {
                    setError((prev) =>
                        prev.includes("sent you a new verification link")
                            ? prev + " You can close this tab or try logging in again later."
                            : prev
                    );
                }, 8000);

                setIsLoading(false);
                return;
            }

            console.log("🔄 [LOGIN] Email verified, proceeding to redirect...");
            await redirectAfterLogin(user.uid);

        } catch (err: unknown) {
            console.error("❌ [LOGIN] Login error:", err);

            // Update failed attempt
            await updateLoginAttempts(email, false);

            if (isMultiFactorError(err)) {
                console.log("🔒 [LOGIN] MFA required, showing TOTP screen");
                const resolver = getMultiFactorResolver(auth, err);
                setMfaResolver(resolver);
                setError("");
            } else if (isAuthError(err)) {
                console.error("🚫 [LOGIN] Auth error code:", err.code);
                switch (err.code) {
                    case "auth/invalid-credential":
                        setError(`Invalid email or password. ${attemptsLeft > 0 ? `${attemptsLeft} attempt(s) left.` : 'Account locked.'}`);
                        break;
                    case "auth/too-many-requests":
                        setError("Too many failed attempts. Try again later or reset your password.");
                        break;
                    case "auth/user-disabled":
                        setError("This account has been disabled. Contact support.");
                        break;
                    case "auth/user-not-found":
                        setError("No account found with this email.");
                        break;
                    case "auth/network-request-failed":
                        setError("Network error. Check your internet connection.");
                        break;
                    default:
                        setError(err.message || "Login failed. Please try again.");
                }
            } else if (err instanceof Error) {
                console.error("⚠️ [LOGIN] Generic error:", err.message);
                setError(err.message);
            } else {
                console.error("⚠️ [LOGIN] Unknown error:", err);
                setError("An unexpected error occurred.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleTotpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaResolver || totpCode.length !== 6) return;
        setIsLoading(true);
        setError("");

        console.log("🔒 [MFA] Starting TOTP verification...");

        try {
            const hint = mfaResolver.hints.find(
                (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
            );
            if (!hint) throw new Error("TOTP not enrolled");

            const assertion = TotpMultiFactorGenerator.assertionForSignIn(
                hint.uid,
                totpCode
            );

            console.log("🔒 [MFA] Resolving sign-in with TOTP...");
            const userCredential = await mfaResolver.resolveSignIn(assertion);
            
            // Get email from the form to reset attempts
            const form = document.querySelector('form') as HTMLFormElement;
            const formData = new FormData(form);
            const email = formData.get("email") as string;
            if (email) {
                await updateLoginAttempts(email, true);
            }
            
            console.log("✅ [MFA] TOTP verification successful");
            console.log("👤 [MFA] User UID:", userCredential.user.uid);
            
            await redirectAfterLogin(userCredential.user.uid);
        } catch (err: unknown) {
            console.error("❌ [MFA] TOTP verification error:", err);
            
            if (err instanceof Error) {
                const message = err.message;
                if (message.includes("INVALID_CODE") || message.includes("EXPIRED")) {
                    setError("Invalid or expired code. Try again.");
                } else {
                    setError(err.message || "Verification failed. Please try again.");
                }
            } else {
                setError("Verification failed. Please try again.");
            }
            setTotpCode("");
        } finally {
            setIsLoading(false);
        }
    };

    const redirectAfterLogin = async (uid: string): Promise<void> => {
        console.log("🔄 [REDIRECT] Starting redirect process for UID:", uid);
        
        try {
            console.log("📄 [REDIRECT] Fetching user document from Firestore...");
            
            // First try: Direct document lookup
            const userDocRef = doc(db, "users", uid);
            let userDoc = await getDoc(userDocRef);
            
            console.log("📄 [REDIRECT] Direct lookup - User document exists:", userDoc.exists());
            
            // Second try: Query by authUid field
            if (!userDoc.exists()) {
                console.log("🔍 [REDIRECT] Trying query by authUid field...");
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("authUid", "==", uid));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    console.log("✅ [REDIRECT] Found user document via authUid query");
                    userDoc = querySnapshot.docs[0];
                } else {
                    console.error("❌ [REDIRECT] User document not found anywhere");
                    router.push("/client/dashboard");
                    return;
                }
            }

            const userData = userDoc.data() as UserData | undefined;
            console.log("📋 [REDIRECT] Full user data:", JSON.stringify(userData, null, 2));
            
            const role = userData?.role || "client";
            console.log("👔 [REDIRECT] User role:", role);
            console.log("🔍 [REDIRECT] Role === 'coach':", role === "coach");

            let redirectPath = "/client/dashboard";

            if (role === "admin" || role === "owner") {
                redirectPath = "/admin/dashboard";
                console.log("🎯 [REDIRECT] Redirecting to ADMIN dashboard");
            } else if (role === "coach") {
                redirectPath = "/kowts/dashboard";
                console.log("🎯 [REDIRECT] Redirecting to COACH (kowts) dashboard");
            } else {
                redirectPath = "/client/dashboard";
                console.log("🎯 [REDIRECT] Redirecting to CLIENT dashboard");
            }

            console.log("➡️ [REDIRECT] Final redirect path:", redirectPath);
            router.push(redirectPath);

        } catch (err: unknown) {
            console.error("❌ [REDIRECT] Failed to fetch user role:", err);
            if (err instanceof Error) {
                console.error("❌ [REDIRECT] Error message:", err.message);
            }
            router.push("/client/dashboard");
        }
    };

    const formatTimeLeft = (seconds: number): string => {
        if (seconds <= 0) return "0 seconds";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${remainingSeconds}s`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted to-orange-900/20 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl grid lg:grid-cols-2 gap-8 items-center">
                {/* LEFT – branding */}
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
                            <span className="text-balance">Welcome back!</span>
                            <br />
                            <span className="text-balance text-orange-500">
                                Train Smarter, Not Harder
                            </span>
                        </h2>
                        <p className="text-muted-foreground text-lg">
                            Sign in to book sessions, chat with coaches, and track your progress.
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

                {/* RIGHT – form */}
                <Card className="bg-card/90 border-orange-500/20 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-2xl font-bold text-center">
                            {mfaResolver ? "Enter Authenticator Code" : "Sign In"}
                        </CardTitle>
                        <CardDescription className="text-center">
                            {mfaResolver
                                ? "Open your authenticator app and enter the 6-digit code"
                                : "Enter your credentials to access your account"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && (
                            <Alert className="mb-4 border-destructive bg-destructive/10">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <AlertDescription className="text-destructive">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Locked Account Warning */}
                        {isLocked && (
                            <Alert className="mb-4 border-yellow-500 bg-yellow-500/10">
                                <Lock className="h-4 w-4 text-yellow-500" />
                                <AlertDescription className="text-yellow-500">
                                    Account temporarily locked due to too many failed attempts. 
                                    Please try again in {formatTimeLeft(lockTimeLeft)}.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Attempts Counter */}
                        {!isLocked && attemptsLeft < MAX_ATTEMPTS && (
                            <Alert className="mb-4 border-orange-500 bg-orange-500/10">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                <AlertDescription className="text-orange-500">
                                    {attemptsLeft} attempt(s) remaining before temporary lock.
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* TOTP Form */}
                        {mfaResolver ? (
                            <form onSubmit={handleTotpSubmit} className="space-y-4">
                                <div className="flex justify-center">
                                    <Shield className="h-12 w-12 text-orange-500" />
                                </div>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                                    placeholder="000000"
                                    className="text-center text-2xl tracking-widest font-mono h-14"
                                    autoFocus
                                />
                                <Button
                                    type="submit"
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                                    disabled={isLoading || totpCode.length !== 6 || isLocked}
                                >
                                    {isLoading ? "Verifying..." : "Verify & Sign In"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMfaResolver(null);
                                        setTotpCode("");
                                        setError("");
                                    }}
                                    className="text-sm text-orange-500 hover:text-orange-400 underline w-full text-center"
                                >
                                    Back to email login
                                </button>
                            </form>
                        ) : (
                            /* Email + Password Form */
                            <form onSubmit={handleFirstFactor} className="space-y-4">
                                <Input
                                    name="email"
                                    type="email"
                                    placeholder="Email address"
                                    required
                                    className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500"
                                    disabled={isLocked}
                                    onChange={(e) => setCurrentEmail(e.target.value)}
                                />
                                <div className="relative">
                                    <Input
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        required
                                        className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500 pr-10"
                                        disabled={isLocked}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        disabled={isLocked}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <div className="text-right">
                                    <Link href="/forgot-password" className="text-sm text-orange-500 hover:text-orange-400">
                                        Forgot password?
                                    </Link>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold transition-all duration-300 transform hover:scale-105"
                                    disabled={isLoading || isLocked}
                                >
                                    {isLoading ? "Signing In..." : isLocked ? "Account Locked" : "Sign In"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                                <p className="text-center text-sm text-muted-foreground">
                                    Don&#39;t have an account?{" "}
                                    <Link href="/register" className="text-orange-500 hover:text-orange-400">
                                        Sign up
                                    </Link>
                                </p>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}