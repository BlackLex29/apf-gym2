// hooks/useAuth.ts
"use client"

import { useState, useEffect } from 'react'
import { User } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

interface UseAuthResult {
  user: User | null
  userRole: 'admin' | 'client' | 'coach' | null
  loading: boolean
}

export const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'client' | 'coach' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      
      if (user) {
        try {
          // Fetch user role from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUserRole(userData.role as 'admin' | 'client' | 'coach')
          } else {
            setUserRole(null)
          }
        } catch (error) {
          console.error('Error fetching user role:', error)
          setUserRole(null)
        }
      } else {
        setUserRole(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return { user, userRole, loading }
}