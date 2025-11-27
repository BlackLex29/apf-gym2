"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dumbbell,
  ArrowRight,
  Menu,
  X,
  Calendar,
  CreditCard,
  MessageCircle,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import Chatbot from "@/components/Chatbot";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    el?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ────── Navigation ────── */}
      <nav className="fixed top-0 w-full bg-background/90 backdrop-blur-sm border-b border-orange-500/20 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Dumbbell className="h-6 w-6 text-black" />
              </div>
              <div>
                <span className="text-xl font-bold">GymSchedPro</span>
                <span className="text-sm text-orange-500 block leading-none">
                  APF Tanauan
                </span>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex items-center space-x-8">
              <button
                onClick={() => scrollToSection("features")}
                className="text-muted-foreground hover:text-orange-500 transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("membership")}
                className="text-muted-foreground hover:text-orange-500 transition-colors"
              >
                Membership
              </button>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-muted-foreground hover:text-orange-500 transition-colors"
              >
                Contact
              </button>
              <ThemeToggle />
              <Button
                onClick={() => router.push("/login")}
                className="bg-orange-500 hover:bg-orange-600 text-black font-semibold"
              >
                Sign In
              </Button>
            </div>

            {/* Mobile */}
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-foreground"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-muted border-t border-orange-500/20">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {["features", "membership", "coaches", "contact"].map((s) => (
                  <button
                    key={s}
                    onClick={() => scrollToSection(s)}
                    className="block w-full text-left px-3 py-2 text-muted-foreground hover:text-orange-500 transition-colors"
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                >
                  Sign In / Sign Up
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ────── Hero ────── */}
      <section className="pt-16 min-h-screen bg-gradient-to-br from-background via-muted to-orange-900/20 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center space-y-8">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold leading-tight">
                <span className="text-balance">Transform Your</span>
                <br />
                <span className="text-balance text-orange-500 font-serif italic">
                  Fitness Journey
                </span>
              </h1>

              <div className="relative max-w-4xl mx-auto">
                <div className="absolute -top-4 -left-4 text-6xl text-orange-500/20 font-serif">
                  &quot;
                </div>
                <div className="absolute -bottom-4 -right-4 text-6xl text-orange-500/20 font-serif">
                  &quot;
                </div>
                <blockquote className="text-xl md:text-3xl text-muted-foreground font-light italic leading-relaxed px-8 py-4 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent rounded-lg border-l-4 border-orange-500">
                  <span className="text-balance">
                    The body achieves what the mind believes. Every rep, every
                    session, every goal conquered brings you closer to your{" "}
                    <span className="text-orange-500 font-semibold not-italic">
                      strongest self
                    </span>
                    .
                  </span>
                </blockquote>
                <cite className="block text-center mt-4 text-muted-foreground text-sm">
                  - GymSchedPro Philosophy
                </cite>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => router.push("/login")}
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-black font-semibold text-lg px-8 py-4"
              >
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                onClick={() => scrollToSection("features")}
                size="lg"
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black text-lg px-8 py-4"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ────── Features ────── */}
      <section id="features" className="py-20 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Why Choose GymSchedPro?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience the future of fitness management with our comprehensive
              platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                Icon: Calendar,
                title: "Realtime Scheduling",
                desc: "Book sessions instantly with live availability updates and real-time coach scheduling",
              },
              {
                Icon: CreditCard,
                title: "GCash Payment",
                desc: "Secure and convenient payments through GCash integration for seamless transactions",
              },
              {
                Icon: MessageCircle,
                title: "Coach Chat",
                desc: "Direct communication with your coaches for personalized guidance and support",
              },
              {
                Icon: Bell,
                title: "Smart Reminders",
                desc: "Never miss a session with intelligent notifications and upcoming schedule alerts",
              },
            ].map((f, i) => (
              <Card
                key={i}
                className="bg-card border-orange-500/20 hover:border-orange-500/40 transition-colors"
              >
                <CardContent className="p-8 text-center">
                  <f.Icon className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ────── Membership ────── */}
      <section id="membership" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Membership Plans</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the perfect plan for your fitness journey
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Basic */}
            <Card className="bg-card border-border">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-2">Basic</h3>
                <p className="text-3xl font-bold text-orange-500 mb-4">
                  ₱1,500
                  <span className="text-lg text-muted-foreground">/month</span>
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Access to gym equipment</li>
                  <li>• 4 training sessions per month</li>
                  <li>• Basic progress tracking</li>
                  <li>• Mobile app access</li>
                </ul>
              </CardContent>
            </Card>

            {/* Premium – most popular */}
            <Card className="bg-card border-orange-500 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-orange-500 text-black px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-2">Premium</h3>
                <p className="text-3xl font-bold text-orange-500 mb-4">
                  ₱2,500
                  <span className="text-lg text-muted-foreground">/month</span>
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Everything in Basic</li>
                  <li>• Unlimited training sessions</li>
                  <li>• Personal coach assignment</li>
                  <li>• Advanced analytics</li>
                  <li>• Priority booking</li>
                </ul>
              </CardContent>
            </Card>

            {/* Elite */}
            <Card className="bg-card border-border">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-2">Elite</h3>
                <p className="text-3xl font-bold text-orange-500 mb-4">
                  ₱3,500
                  <span className="text-lg text-muted-foreground">/month</span>
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Everything in Premium</li>
                  <li>• 1-on-1 personal training</li>
                  <li>• Nutrition consultation</li>
                  <li>• Custom workout plans</li>
                  <li>• 24/7 gym access</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ────── Contact ────── */}
      <section id="contact" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Get In Touch</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ready to start your fitness journey? Contact APF Tanauan today!
            </p>
          </div>

          <div className="grid place-items-center gap-12">
            <h3 className="text-2xl font-bold">APF Tanauan</h3>
            <div className="space-y-4 text-muted-foreground flex flex-col items-center">
              <p>123 Fitness Street, Tanauan City, Batangas</p>
              <p>+63 912 345 6789</p>
              <p>info@apfgymtanauan.com</p>
              <p>Mon-Fri: 5:00 AM - 11:00 PM</p>
              <p>Sat-Sun: 6:00 AM - 10:00 PM</p>
            </div>
          </div>
        </div>
      </section>

      {/* ────── Footer ────── */}
      <footer className="bg-muted border-t border-orange-500/20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-500 rounded-lg">
                <Dumbbell className="h-5 w-5 text-black" />
              </div>
              <div>
                <span className="font-bold">GymSchedPro</span>
                <span className="text-sm text-orange-500 block leading-none">
                  APF Tanauan
                </span>
              </div>
            </div>
            <p className="text-muted-foreground">
              © 2024 GymSchedPro. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <Chatbot />
    </div>
  );
}
