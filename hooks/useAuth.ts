"use client";
import { useState, useEffect } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type UserRole = 'admin' | 'owner' | 'client' | 'coach';

interface UseAuthReturn {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔐 [useAuth] Setting up auth state listener...");

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("🔐 [useAuth] Auth state changed");
      console.log("👤 [useAuth] Firebase user:", firebaseUser?.uid || "null");

      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          console.log("📄 [useAuth] Fetching user role from Firestore...");
          
          // First try: Direct document lookup
          const userDocRef = doc(db, "users", firebaseUser.uid);
          let userDoc = await getDoc(userDocRef);

          console.log("📄 [useAuth] Direct lookup exists:", userDoc.exists());

          // Second try: Query by authUid field (fallback for mismatched IDs)
          if (!userDoc.exists()) {
            console.log("🔍 [useAuth] Trying query by authUid field...");
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("authUid", "==", firebaseUser.uid));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              console.log("✅ [useAuth] Found user via authUid query");
              userDoc = querySnapshot.docs[0];
            } else {
              console.warn("⚠️ [useAuth] User document not found anywhere");
              setUserRole("client"); // Default role
              setLoading(false);
              return;
            }
          }

          const userData = userDoc.data();
          const role = userData?.role as UserRole || "client";
          
          console.log("✅ [useAuth] User role fetched:", role);
          console.log("📋 [useAuth] Full user data:", userData);
          
          setUserRole(role);
          
        } catch (error) {
          console.error("❌ [useAuth] Error fetching user role:", error);
          setUserRole("client"); // Default role on error
        }
      } else {
        console.log("🚫 [useAuth] No user logged in");
        setUser(null);
        setUserRole(null);
      }

      setLoading(false);
      console.log("✅ [useAuth] Auth state processing complete");
    });

    return () => {
      console.log("🧹 [useAuth] Cleaning up auth listener");
      unsubscribe();
    };
  }, []);

  return { user, userRole, loading };
}