"use client"

import { useState, useEffect } from 'react'
import { User } from 'firebase/auth'
import { useRouter, usePathname } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'client' | 'coach' | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("🔄 [AUTH] Auth state changed:", user ? user.uid : "null")
      
      if (user) {
        setUser(user)
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            const role = userData.role as 'admin' | 'client' | 'coach'
            setUserRole(role)
            console.log("✅ [AUTH] User authenticated with role:", role)
          } else {
            setUserRole(null)
            console.log("❌ [AUTH] User document not found")
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
          setUserRole(null)
        }
      } else {
        setUser(null)
        setUserRole(null)
        console.log("❌ [AUTH] No user, checking if protected route...")
        
        // Only redirect if trying to access dashboard without auth
        if (pathname.includes('/dashboard') || 
            pathname.includes('/admin') || 
            pathname.includes('/client') || 
            pathname.includes('/coach')) {
          console.log("🔄 [AUTH] Redirecting to login")
          router.push('/login')
        }
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router, pathname])

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  // If no user but loading is done, redirect (handled by useEffect)
  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-lg">Please wait...</div>
        </div>
      </div>
    )
  }

  // If user exists but no role (shouldn't happen normally)
  if (!userRole) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg text-red-500 mb-4">User data not found</div>
          <button 
            onClick={() => {
              auth.signOut()
              router.push('/login')
            }}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  console.log("✅ [LAYOUT] Rendering dashboard for:", userRole)

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
          role: userRole,
          userId: user.uid
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