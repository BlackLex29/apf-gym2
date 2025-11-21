"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { useAuth } from "@/hooks/useAuth"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, userRole, loading } = useAuth()

  console.log("🏠 [LAYOUT] Dashboard Layout Render");
  console.log("🏠 [LAYOUT] Loading:", loading);
  console.log("🏠 [LAYOUT] User:", user?.uid || "null");
  console.log("🏠 [LAYOUT] User role:", userRole);

  // Show loading state while Firebase initializes
  if (loading) {
    console.log("⏳ [LAYOUT] Showing loading screen");
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Wait for role to be fetched
  if (!userRole) {
    console.log("⏳ [LAYOUT] Waiting for user role...");
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading user data...</div>
      </div>
    )
  }

  console.log("✅ [LAYOUT] Rendering sidebar with role:", userRole);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar 
        variant="inset" 
        userRole={{
          role: userRole as 'admin' | 'client' | 'coach',
          userId: user!.uid
        }}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}