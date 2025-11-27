"use client";
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'client' | 'coach' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Try users collection first
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return { role: userData.role, data: userData };
      }
      
      // Try coaches in users collection
      const coachesQuery = query(
        collection(db, 'users'),
        where('authUid', '==', userId),
        where('role', '==', 'coach')
      );
      
      const coachesSnapshot = await getDocs(coachesQuery);
      if (!coachesSnapshot.empty) {
        const coachDoc = coachesSnapshot.docs[0];
        const coachData = coachDoc.data();
        return { role: 'coach', data: coachData };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userData = await fetchUserData(user.uid);
        if (userData) {
          setUserRole(userData.role as 'admin' | 'client' | 'coach');
        } else {
          setUserRole(null);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    userRole,
    loading,
    isAuthenticated: !!user,
    isCoach: userRole === 'coach',
    isAdmin: userRole === 'admin',
    isClient: userRole === 'client'
  };
};