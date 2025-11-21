"use client";

import { useEffect, useState } from "react";
import {
    multiFactor,
    signOut,
    TotpMultiFactorGenerator,
    TotpSecret,
    User,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    MultiFactorUser,
    MultiFactorSession,
} from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import { auth, db } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Loader2,
    RefreshCw,
    User as UserIcon,
    Bell,
    Palette,
    LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

// Type guards and interfaces
interface MultiFactorUserExtended extends User {
    multiFactor: MultiFactorUser;
}

interface TotpSecretExtended extends TotpSecret {
    secret: string;
}

interface UserProfile {
    firstName?: string;
    lastName?: string;
    phone?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    language?: string;
    timezone?: string;
}

interface FirebaseAuthError extends Error {
    code: string;
}

// Type guards
function isMultiFactorUser(user: User): user is MultiFactorUserExtended {
    return !!(user as MultiFactorUserExtended).multiFactor;
}

function isTotpSecret(secret: TotpSecret): secret is TotpSecretExtended {
    return !!(secret as TotpSecretExtended).secret;
}

function isFirebaseAuthError(error: unknown): error is FirebaseAuthError {
    return error instanceof Error && 'code' in error;
}

const getSecretKey = (secret: TotpSecret): string => {
    if (isTotpSecret(secret)) {
        return secret.secret;
    }
    return '';
};

export default function SettingsPage() {
    const router = useRouter();

    /* ------------------------------------------------------------------ *
     *  Auth & user data
     * ------------------------------------------------------------------ */
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    /* ------------------------------------------------------------------ *
     *  Global UI state
     * ------------------------------------------------------------------ */
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    /* ------------------------------------------------------------------ *
     *  Profile
     * ------------------------------------------------------------------ */
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    /* ------------------------------------------------------------------ *
     *  Notifications
     * ------------------------------------------------------------------ */
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);
    const [smsNotifications, setSmsNotifications] = useState(false);

    /* ------------------------------------------------------------------ *
     *  Password
     * ------------------------------------------------------------------ */
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    /* ------------------------------------------------------------------ *
     *  Preferences
     * ------------------------------------------------------------------ */
    const [language, setLanguage] = useState("en");
    const [timezone, setTimezone] = useState("asia/manila");

    /* ------------------------------------------------------------------ *
     *  2FA (TOTP)
     * ------------------------------------------------------------------ */
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
    const [code, setCode] = useState("");
    const [enrolled, setEnrolled] = useState(false);

    /* ------------------------------------------------------------------ *
     *  Load user + Firestore data
     * ------------------------------------------------------------------ */
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            setUser(u);
            setAuthLoading(false);

            if (u) {
                // 2FA status
                if (isMultiFactorUser(u)) {
                    const mf = multiFactor(u);
                    const hasTotp = mf.enrolledFactors.some(
                        (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID
                    );
                    setEnrolled(hasTotp);
                }

                // Firestore profile
                try {
                    const snap = await getDoc(doc(db, "users", u.uid));
                    if (snap.exists()) {
                        const data = snap.data() as UserProfile;
                        setFirstName(data.firstName ?? "");
                        setLastName(data.lastName ?? "");
                        setPhone(data.phone ?? "");
                        setEmailNotifications(data.emailNotifications ?? true);
                        setPushNotifications(data.pushNotifications ?? true);
                        setSmsNotifications(data.smsNotifications ?? false);
                        setLanguage(data.language ?? "en");
                        setTimezone(data.timezone ?? "asia/manila");
                    }
                } catch (err: unknown) {
                    console.error("Error loading user data:", err);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    /* ------------------------------------------------------------------ *
     *  Helpers
     * ------------------------------------------------------------------ */
    const clearMessages = () => {
        setError(null);
        setSuccess(null);
    };

    const startEnrollment = async () => {
        if (!user || !isMultiFactorUser(user)) return;
        setLoading(true);
        clearMessages();
        try {
            const resolver = multiFactor(user);
            const session = await resolver.getSession() as MultiFactorSession;
            const secret = await TotpMultiFactorGenerator.generateSecret(session);
            const uri = secret.generateQrCodeUrl(user.email ?? "user", "GymSched Pro");
            setQrUrl(uri);
            setTotpSecret(secret);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message ?? "Failed to generate TOTP secret");
            } else {
                setError("Failed to generate TOTP secret");
            }
        } finally {
            setLoading(false);
        }
    };

    const verifyAndEnroll = async () => {
        if (!user || !isMultiFactorUser(user) || !totpSecret || code.length !== 6) return;
        setLoading(true);
        clearMessages();
        try {
            const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
                totpSecret,
                code
            );
            await multiFactor(user).enroll(assertion, "TOTP Authenticator");
            await user.reload();
            setEnrolled(true);
            setQrUrl(null);
            setTotpSecret(null);
            setCode("");
            setSuccess("2FA enabled!");
        } catch (err: unknown) {
            if (err instanceof Error) {
                const message = err.message ?? "Verification failed";
                setError(
                    message.includes("INVALID_TOTP_VERIFICATION_CODE")
                        ? "Invalid or expired code – try again."
                        : message
                );
            } else {
                setError("Verification failed");
            }
        } finally {
            setLoading(false);
        }
    };

    const unenroll = async () => {
        if (!user || !isMultiFactorUser(user)) return;
        const factor = multiFactor(user).enrolledFactors.find(
            (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID
        );
        if (!factor) return;

        setLoading(true);
        clearMessages();
        try {
            await multiFactor(user).unenroll(factor.uid);
            await user.reload();
            setEnrolled(false);
            setSuccess("2FA removed");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message ?? "Failed to remove 2FA");
            } else {
                setError("Failed to remove 2FA");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        setLoading(true);
        clearMessages();
        try {
            await signOut(auth);
            router.push("/login");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message ?? "Logout failed");
            } else {
                setError("Logout failed");
            }
        } finally {
            setLoading(false);
        }
    };

    const saveProfile = async () => {
        if (!user) return;
        setLoading(true);
        clearMessages();
        try {
            await updateDoc(doc(db, "users", user.uid), {
                firstName,
                lastName,
                phone,
            });
            setSuccess("Profile saved");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message ?? "Failed to save profile");
            } else {
                setError("Failed to save profile");
            }
        } finally {
            setLoading(false);
        }
    };

    const saveNotifications = async () => {
        if (!user) return;
        setLoading(true);
        clearMessages();
        try {
            await updateDoc(doc(db, "users", user.uid), {
                emailNotifications,
                pushNotifications,
                smsNotifications,
            });
            setSuccess("Notification preferences saved");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message ?? "Failed to save notifications");
            } else {
                setError("Failed to save notifications");
            }
        } finally {
            setLoading(false);
        }
    };

    const changePassword = async () => {
        if (!user?.email) return;
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        clearMessages();
        try {
            const cred = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, cred);
            await updatePassword(user, newPassword);
            setSuccess("Password updated");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: unknown) {
            if (isFirebaseAuthError(err)) {
                setError(
                    err.code === "auth/wrong-password"
                        ? "Current password is incorrect"
                        : err.message ?? "Password update failed"
                );
            } else if (err instanceof Error) {
                setError(err.message ?? "Password update failed");
            } else {
                setError("Password update failed");
            }
        } finally {
            setLoading(false);
        }
    };

    const savePreferences = async () => {
        if (!user) return;
        setLoading(true);
        clearMessages();
        try {
            await updateDoc(doc(db, "users", user.uid), { language, timezone });
            setSuccess("Preferences saved");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message ?? "Failed to save preferences");
            } else {
                setError("Failed to save preferences");
            }
        } finally {
            setLoading(false);
        }
    };

    /* ------------------------------------------------------------------ *
     *  Render
     * ------------------------------------------------------------------ */
    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Sticky header */}
            <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 py-4">
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage your account preferences and security
                    </p>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-6 space-y-6">
                {/* Global messages */}
                {error && (
                    <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                {success && (
                    <Alert className="border-green-500/20 bg-green-500/10">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <AlertDescription className="text-green-500">
                            {success}
                        </AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Profile Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserIcon className="h-5 w-5" />
                                Profile Information
                            </CardTitle>
                            <CardDescription>Update your personal details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">First Name</label>
                                    <Input
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Last Name</label>
                                    <Input
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Email</label>
                                <Input value={user?.email ?? ""} disabled />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Phone</label>
                                <Input
                                    placeholder="+63 912 345 6789"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>

                            <Button onClick={saveProfile} disabled={loading} className="w-full">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Notifications Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notifications
                            </CardTitle>
                            <CardDescription>Choose how you want to be notified</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Email</p>
                                    <p className="text-sm text-muted-foreground">Updates via email</p>
                                </div>
                                <Switch
                                    checked={emailNotifications}
                                    onCheckedChange={setEmailNotifications}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Push</p>
                                    <p className="text-sm text-muted-foreground">Browser push</p>
                                </div>
                                <Switch
                                    checked={pushNotifications}
                                    onCheckedChange={setPushNotifications}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">SMS</p>
                                    <p className="text-sm text-muted-foreground">Text messages</p>
                                </div>
                                <Switch
                                    checked={smsNotifications}
                                    onCheckedChange={setSmsNotifications}
                                />
                            </div>

                            <Button onClick={saveNotifications} disabled={loading} className="w-full">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    "Save Preferences"
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Password Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Password
                            </CardTitle>
                            <CardDescription>Change your account password</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Current Password</label>
                                <Input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">New Password</label>
                                <Input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Confirm New Password</label>
                                <Input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <Button onClick={changePassword} disabled={loading} className="w-full">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating…
                                    </>
                                ) : (
                                    "Update Password"
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* 2FA Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5" />
                                    <div>
                                        <CardTitle>Two-Factor Authentication</CardTitle>
                                        <CardDescription>
                                            Secure your account with an authenticator app
                                        </CardDescription>
                                    </div>
                                </div>
                                {enrolled && (
                                    <Badge className="bg-green-500 text-white">
                                        <ShieldCheck className="mr-1 h-3 w-3" />
                                        Active
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {!enrolled && !qrUrl && (
                                <Button
                                    onClick={startEnrollment}
                                    disabled={loading}
                                    className="w-full"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating…
                                        </>
                                    ) : (
                                        "Enable 2FA"
                                    )}
                                </Button>
                            )}

                            {qrUrl && totpSecret && (
                                <div className="space-y-6 rounded-lg border p-4 bg-muted/30">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium">1. Scan QR code</h4>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={startEnrollment}
                                                disabled={loading}
                                            >
                                                <RefreshCw className="mr-1 h-4 w-4" />
                                                Regenerate
                                            </Button>
                                        </div>
                                        <div className="flex justify-center p-4 bg-white rounded">
                                            <QRCodeSVG value={qrUrl} size={180} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium">Or enter manually</h4>
                                        <code className="block rounded bg-muted p-3 text-xs font-mono break-all">
                                            {getSecretKey(totpSecret)}
                                        </code>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="font-medium">2. Enter 6-digit code</h4>
                                        <div className="flex gap-2">
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                value={code}
                                                onChange={(e) =>
                                                    setCode(e.target.value.replace(/\D/g, ""))
                                                }
                                                placeholder="000000"
                                                className="w-32 text-center font-mono text-lg"
                                                autoFocus
                                            />
                                            <Button
                                                onClick={verifyAndEnroll}
                                                disabled={loading || code.length !== 6}
                                                className="bg-green-600 hover:bg-green-700"
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Verifying…
                                                    </>
                                                ) : (
                                                    "Verify & Enroll"
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Code expires in 30 seconds.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {enrolled && (
                                <div className="space-y-4">
                                    <Alert className="border-green-500/20 bg-green-500/10">
                                        <ShieldCheck className="h-4 w-4 text-green-500" />
                                        <AlertDescription className="text-green-500 flex items-center gap-2">
                                            2FA is <strong>active</strong> and protecting your account.
                                        </AlertDescription>
                                    </Alert>
                                    <Button
                                        variant="destructive"
                                        onClick={unenroll}
                                        disabled={loading}
                                        className="w-full"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Removing…
                                            </>
                                        ) : (
                                            "Remove 2FA"
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Preferences Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="h-5 w-5" />
                                Preferences
                            </CardTitle>
                            <CardDescription>Customize your experience</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium">Language</label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="fil">Filipino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium">Timezone</label>
                                <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asia/manila">Asia/Manila</SelectItem>
                                        <SelectItem value="utc">UTC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={savePreferences} disabled={loading} className="w-full">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    "Save Preferences"
                                )}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Logout Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LogOut className="h-5 w-5" />
                                Account Actions
                            </CardTitle>
                            <CardDescription>Sign out of your session</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                onClick={handleLogout}
                                disabled={loading}
                                className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing out…
                                    </>
                                ) : (
                                    "Sign Out"
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}