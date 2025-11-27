"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Mail,
  ArrowLeft,
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
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Type for component states
type ResetState = "form" | "success" | "error";

interface ResetFormData {
  email: string;
}

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetState, setResetState] = useState<ResetState>("form");
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();

  // Handle cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown(cooldown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    const data = new FormData(e.currentTarget);
    const email = data.get("email") as string;

    console.log("🔐 [FORGOT_PASSWORD] Starting password reset for:", email);

    try {
      if (!auth) {
        throw new Error("Authentication service is not available.");
      }

      console.log("📧 [FORGOT_PASSWORD] Sending password reset email...");
      await sendPasswordResetEmail(auth, email);

      console.log(
        "✅ [FORGOT_PASSWORD] Password reset email sent successfully"
      );

      setResetState("success");
      setSuccess(
        `Password reset link sent to ${email}. Check your inbox and spam folder.`
      );

      // Set cooldown to prevent spam (60 seconds)
      setCooldown(60);
    } catch (err: unknown) {
      console.error("❌ [FORGOT_PASSWORD] Password reset error:", err);
      setResetState("error");

      if (err instanceof Error) {
        const errorMessage = err.message;

        // Handle specific Firebase auth errors
        if (errorMessage.includes("auth/user-not-found")) {
          setError("No account found with this email address.");
        } else if (errorMessage.includes("auth/invalid-email")) {
          setError("Invalid email address format.");
        } else if (errorMessage.includes("auth/too-many-requests")) {
          setError("Too many attempts. Please try again later.");
        } else if (errorMessage.includes("auth/network-request-failed")) {
          setError("Network error. Please check your internet connection.");
        } else {
          setError("Failed to send reset email. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async (email: string) => {
    if (cooldown > 0) return;

    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (!auth) {
        throw new Error("Authentication service is not available.");
      }

      console.log("🔄 [FORGOT_PASSWORD] Resending password reset email...");
      await sendPasswordResetEmail(auth, email);

      setSuccess(
        `Reset link resent to ${email}. Check your inbox and spam folder.`
      );
      setCooldown(60); // Reset cooldown
    } catch (err: unknown) {
      console.error("❌ [FORGOT_PASSWORD] Resend error:", err);

      if (err instanceof Error) {
        setError(err.message || "Failed to resend email. Please try again.");
      } else {
        setError("Failed to resend email. Please try again.");
      }
    } finally {
      setIsLoading(false);
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
              <h1 className="text-4xl font-bold text-foreground">
                GymSchedPro
              </h1>
              <p className="text-orange-500 font-semibold">APF Tanauan</p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground leading-tight">
              <span className="text-balance">Reset Your Password</span>
              <br />
              <span className="text-balance text-orange-500">
                Get Back to Training
              </span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Enter your email address and we&#39;ll send you a link to reset
              your password.
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
            <CardTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
              <Mail className="h-5 w-5" />
              Forgot Password
            </CardTitle>
            <CardDescription className="text-center">
              {resetState === "success"
                ? "Check your email for reset instructions"
                : "Enter your email to reset your password"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Alert */}
            {error && (
              <Alert className="mb-4 border-destructive bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {success && (
              <Alert className="mb-4 border-green-500 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-500">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {/* Reset Form */}
            {resetState !== "success" ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <Input
                  name="email"
                  type="email"
                  placeholder="Enter your email address"
                  required
                  className="bg-input border-border text-foreground placeholder-muted-foreground focus:border-orange-500"
                  disabled={isLoading}
                />

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold transition-all duration-300"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending Reset Link..." : "Send Reset Link"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm text-orange-500 hover:text-orange-400 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            ) : (
              /* Success State */
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>

                <p className="text-muted-foreground">
                  We&#39;ve sent password reset instructions to your email
                  address. The link will expire in 1 hour.
                </p>

                <div className="space-y-3">
                  <Button
                    onClick={() => {
                      const form = document.querySelector("form");
                      const emailInput = form?.querySelector(
                        'input[name="email"]'
                      ) as HTMLInputElement;
                      if (emailInput?.value) {
                        handleResendEmail(emailInput.value);
                      }
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                    disabled={isLoading || cooldown > 0}
                  >
                    {isLoading
                      ? "Resending..."
                      : cooldown > 0
                        ? `Resend Available in ${cooldown}s`
                        : "Resend Email"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setResetState("form")}
                    className="w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black"
                  >
                    Try Different Email
                  </Button>

                  <Link
                    href="/login"
                    className="block text-sm text-orange-500 hover:text-orange-400 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back to Sign In
                  </Link>
                </div>
              </div>
            )}

            {/* Additional Help */}
            {resetState === "error" && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <p className="font-semibold">Need help?</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Check your spam or junk folder</li>
                  <li>Ensure you entered the correct email address</li>
                  <li>Contact support if you continue having issues</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
