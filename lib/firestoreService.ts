import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  DocumentData,
  QuerySnapshot
} from "firebase/firestore";
import { db } from "./firebaseConfig";

export interface User {
  id: string;
  email: string;
  password?: string; // Make password optional since we don't store it in Firestore for security
  role: "admin" | "coach" | "member" | "client";
  coachId?: string;
  status: "active" | "inactive";
  name: string;
  phone: string;
  specialty?: "gym" | "karate" | "boxing" | "zumba";
  experience?: string;
  createdAt: string;
  updatedAt: string;
  authUid?: string; // Add authUid to store Firebase Auth UID
}

// Firestore functions
export const addUserToFirestore = async (userData: Omit<User, "id">): Promise<User> => {
  try {
    // Don't store password in Firestore for security
    const { password, ...safeUserData } = userData;
    
    const docRef = await addDoc(collection(db, "users"), {
      ...safeUserData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    return {
      ...userData,
      id: docRef.id,
    };
  } catch (error) {
    console.error('Error adding user to Firestore:', error);
    throw error;
  }
};

export const getUsersFromFirestore = async (): Promise<User[]> => {
  try {
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(collection(db, "users"));
    const users: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      users.push({
        id: doc.id,
        email: data.email,
        // Don't include password from Firestore
        role: data.role,
        coachId: data.coachId,
        status: data.status,
        name: data.name,
        phone: data.phone,
        specialty: data.specialty,
        experience: data.experience,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        authUid: data.authUid, // Include authUid
      } as User);
    });
    
    return users;
  } catch (error) {
    console.error('Error getting users from Firestore:', error);
    throw error;
  }
};

export const updateUserInFirestore = async (userId: string, userData: Partial<User>): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    
    // Don't store password in Firestore
    const { password, ...safeUserData } = userData;
    
    await updateDoc(userRef, {
      ...safeUserData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating user in Firestore:', error);
    throw error;
  }
};

export const deleteUserFromFirestore = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    throw error;
  }
};

export const checkEmailExists = async (email: string): Promise<boolean> => {
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking email existence:', error);
    throw error;
  }
};

export const getUserByCoachId = async (coachId: string): Promise<User | null> => {
  try {
    const q = query(collection(db, "users"), where("coachId", "==", coachId));
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      email: data.email,
      // Don't include password from Firestore
      role: data.role,
      coachId: data.coachId,
      status: data.status,
      name: data.name,
      phone: data.phone,
      specialty: data.specialty,
      experience: data.experience,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      authUid: data.authUid, // Include authUid
    } as User;
  } catch (error) {
    console.error('Error getting user by coach ID:', error);
    throw error;
  }
};

// New function to get user by authUid
export const getUserByAuthUid = async (authUid: string): Promise<User | null> => {
  try {
    const q = query(collection(db, "users"), where("authUid", "==", authUid));
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      email: data.email,
      role: data.role,
      coachId: data.coachId,
      status: data.status,
      name: data.name,
      phone: data.phone,
      specialty: data.specialty,
      experience: data.experience,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      authUid: data.authUid,
    } as User;
  } catch (error) {
    console.error('Error getting user by auth UID:', error);
    throw error;
  }
};

// Function to get coaches only
export const getCoachesFromFirestore = async (): Promise<User[]> => {
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"));
    const querySnapshot: QuerySnapshot<DocumentData> = await getDocs(q);
    const coaches: User[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      coaches.push({
        id: doc.id,
        email: data.email,
        role: data.role,
        coachId: data.coachId,
        status: data.status,
        name: data.name,
        phone: data.phone,
        specialty: data.specialty,
        experience: data.experience,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        authUid: data.authUid,
      } as User);
    });
    
    return coaches;
  } catch (error) {
    console.error('Error getting coaches from Firestore:', error);
    throw error;
  }
};