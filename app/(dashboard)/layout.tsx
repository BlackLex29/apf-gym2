"use client";
import { useState, useEffect } from 'react'
import { User } from 'firebase/auth'
import { useRouter, usePathname } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
  '/kowts'
]

// List of public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password'
]

// Define dashboard paths
const DASHBOARD_PATHS = {
  admin: '/admin/dashboard',
  client: '/client/dashboard',
  coach: '/kowts/dashboard'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'client' | 'coach' | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Function to fetch user data from both collections
  const fetchUserData = async (userId: string) => {
    try {
      console.log("🔍 [AUTH] Fetching user data for:", userId)
      
      // Try users collection first (for admin and client roles)
      const userDoc = await getDoc(doc(db, 'users', userId))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        console.log("✅ [AUTH] Found in users collection:", userData.role)
        return { role: userData.role, data: userData }
      }
      
      console.log("🔍 [AUTH] Not found in users collection, checking coaches...")
      
      // Try query by authUid field in users collection for coaches
      const coachesQuery = query(
        collection(db, 'users'),
        where('authUid', '==', userId),
        where('role', '==', 'coach')
      )
      
      const coachesSnapshot = await getDocs(coachesQuery)
      console.log("🔍 [AUTH] Coaches query returned:", coachesSnapshot.size, "documents")
      
      if (!coachesSnapshot.empty) {
        const coachDoc = coachesSnapshot.docs[0]
        const coachData = coachDoc.data()
        console.log("✅ [AUTH] Found coach in users collection:", coachData)
        return { role: 'coach', data: coachData }
      }
      
      console.log("❌ [AUTH] User not found in any collection")
      return null
      
    } catch (error) {
      console.error('❌ [AUTH] Error fetching user data:', error)
      return null
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("🔄 [AUTH] Auth state changed:", user ? user.uid : "null")
      
      if (user) {
        setUser(user)
        try {
          const userData = await fetchUserData(user.uid)
          
          if (userData) {
            const role = userData.role as 'admin' | 'client' | 'coach'
            setUserRole(role)
            console.log("✅ [AUTH] User authenticated with role:", role)

            // Get the intended dashboard path
            const userDashboardPath = DASHBOARD_PATHS[role] || '/dashboard'
            
            console.log("📍 [AUTH] Current path:", pathname)
            console.log("🎯 [AUTH] Intended dashboard:", userDashboardPath)

            // Check if we need to redirect
            const shouldRedirect = 
              // If user is on login page but already authenticated
              pathname === '/login' ||
              // If user is on register page but already authenticated
              pathname === '/register' ||
              // If user is on wrong role dashboard
              (role === 'coach' && !pathname.startsWith('/kowts')) ||
              (role === 'admin' && !pathname.startsWith('/admin')) ||
              (role === 'client' && !pathname.startsWith('/client'))

            if (shouldRedirect) {
              console.log(`🔄 [AUTH] Redirecting ${role} from ${pathname} to: ${userDashboardPath}`)
              router.push(userDashboardPath)
            }
          } else {
            setUserRole(null)
            console.log("❌ [AUTH] User document not found in any collection")
            // If user data not found, sign them out
            await auth.signOut()
            router.push('/login')
          }
        } catch (error) {
          console.error('❌ [AUTH] Error fetching user role:', error)
          setUserRole(null)
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
      
      setAuthChecked(true)
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
    // Coach can access kowts routes
    if (userRole === 'coach' && pathname.startsWith('/kowts')) return true
    // All roles can access dashboard
    if (pathname.startsWith('/dashboard')) return true
    // Allow root path for all authenticated users
    if (pathname === '/') return true

    return false
  }

  // Show loading state only during initial auth check
  if (loading && !authChecked) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-lg">Loading...</div>
        </div>
      </div>
    )
  }

  // If no user but trying to access protected route
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
    console.log("🚫 [AUTH] Access denied - User:", user.uid, "Role:", userRole, "Path:", pathname)
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
                // Try to redirect to appropriate dashboard
                if (userRole) {
                  router.push(DASHBOARD_PATHS[userRole])
                } else {
                  // If no role, try to fetch again or go to login
                  router.push('/login')
                }
              }}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md block w-full"
            >
              Go to Your Dashboard
            </button>
            <button 
              onClick={async () => {
                try {
                  await auth.signOut()
                  router.push('/')
                } catch (error) {
                  console.error('Error signing out:', error)
                  router.push('/')
                }
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

  // If user is on a public route, don't show dashboard layout
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
          userId: user?.uid || ''
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