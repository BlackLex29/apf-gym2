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

// List of protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/admin',
  '/client', 
  '/coach'
]

// List of public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password'
]

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

            // Check if user is trying to access a route they&apos;re not authorized for
            const isAccessingProtectedRoute = PROTECTED_ROUTES.some(route => 
              pathname.startsWith(route)
            )

            if (isAccessingProtectedRoute) {
              // Redirect based on role to appropriate dashboard
              let redirectPath = '/dashboard'
              
              if (role === 'admin' && !pathname.startsWith('/admin')) {
                redirectPath = '/admin/dashboard'
              } else if (role === 'client' && !pathname.startsWith('/client')) {
                redirectPath = '/client/dashboard' 
              } else if (role === 'coach' && !pathname.startsWith('/coach')) {
                redirectPath = '/coach/dashboard'
              }

              if (redirectPath !== pathname) {
                console.log(`🔄 [AUTH] Redirecting ${role} to: ${redirectPath}`)
                router.push(redirectPath)
              }
            }
          } else {
            setUserRole(null)
            console.log("❌ [AUTH] User document not found")
            
            // If user doc doesn&apos;t exist but user is authenticated, log them out
            await auth.signOut()
            router.push('/login')
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
          setUserRole(null)
          await auth.signOut()
          router.push('/login')
        }
      } else {
        setUser(null)
        setUserRole(null)
        console.log("❌ [AUTH] No user, checking if protected route...")
        
        // Check if trying to access protected route without authentication
        const isAccessingProtectedRoute = PROTECTED_ROUTES.some(route => 
          pathname.startsWith(route)
        )

        if (isAccessingProtectedRoute) {
          console.log("🔄 [AUTH] Redirecting to login from protected route")
          router.push('/login')
        }
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router, pathname])

  // Function to check if current route is accessible for the user
  const isRouteAccessible = () => {
    if (!user || !userRole) return false

    // Admin can access admin routes
    if (userRole === 'admin' && pathname.startsWith('/admin')) return true
    // Client can access client routes
    if (userRole === 'client' && pathname.startsWith('/client')) return true
    // Coach can access coach routes
    if (userRole === 'coach' && pathname.startsWith('/coach')) return true
    // All roles can access dashboard
    if (pathname.startsWith('/dashboard')) return true

    return false
  }

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

  // If no user but trying to access protected route (handled by useEffect)
  if (!user && PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-lg">Redirecting to login...</div>
        </div>
      </div>
    )
  }

  // If user exists but no role or invalid role access
  if (user && (!userRole || !isRouteAccessible())) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-lg text-red-500 mb-4">
            Access Denied
          </div>
          <p className="text-muted-foreground mb-4">
            You don&apos;t have permission to access this page.
          </p>
          <div className="space-y-2">
            <button 
              onClick={() => {
                // Redirect to appropriate dashboard based on role
                if (userRole === 'admin') {
                  router.push('/admin/dashboard')
                } else if (userRole === 'client') {
                  router.push('/client/dashboard')
                } else if (userRole === 'coach') {
                  router.push('/coach/dashboard')
                } else {
                  router.push('/dashboard')
                }
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md block w-full"
            >
              Go to Your Dashboard
            </button>
            <button 
              onClick={() => {
                auth.signOut()
                router.push('/')
              }}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md block w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // If user is on a public route (like landing page, login, register), don&apos;t show dashboard layout
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )

  if (isPublicRoute) {
    return <>{children}</>
  }

  console.log("✅ [LAYOUT] Rendering dashboard for:", userRole, "on route:", pathname)

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
          role: userRole!,
          userId: user?.uid || '' // Fixed: Added fallback for user.uid
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