"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dumbbell,
    Eye,
    EyeOff,
    ArrowRight,
    AlertCircle,
    Shield,
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
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

// Type for Firebase user document
interface UserData {
    role?: 'admin' | 'owner' | 'client' | 'coach';
    // Add other user fields as needed
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
    const router = useRouter();

    const handleFirstFactor = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setMfaResolver(null);

        const data = new FormData(e.currentTarget);
        const email = data.get("email") as string;
        const password = data.get("password") as string;

        console.log("🔐 [LOGIN] Starting login process for:", email);
        setIsLoading(true);

        try {
            if (!auth) {
                throw new Error("Authentication service is not available.");
            }

            console.log("🔐 [LOGIN] Attempting Firebase authentication...");
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

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

            if (isMultiFactorError(err)) {
                console.log("🔒 [LOGIN] MFA required, showing TOTP screen");
                const resolver = getMultiFactorResolver(auth, err);
                setMfaResolver(resolver);
                setError("");
            } else if (isAuthError(err)) {
                console.error("🚫 [LOGIN] Auth error code:", err.code);
                switch (err.code) {
                    case "auth/invalid-credential":
                        setError("Invalid email or password.");
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
                                    disabled={isLoading || totpCode.length !== 6}
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
                                <div className="text-right">
                                    <Link href="/forgot-password" className="text-sm text-orange-500 hover:text-orange-400">
                                        Forgot password?
                                    </Link>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold transition-all duration-300 transform hover:scale-105"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Signing In..." : "Sign In"}
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