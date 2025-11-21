"use client"
import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  IconUsers,
  IconUserPlus,
  IconTrash,
  IconSearch,
  IconFilter,
  IconUpload,
  IconX,
  IconEdit,
} from "@tabler/icons-react";
import { db, auth } from "@/lib/firebaseConfig";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  Unsubscribe
} from "firebase/firestore";
import { createUserWithEmailAndPassword, AuthError } from "firebase/auth";

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: "gym" | "karate" | "boxing" | "zumba";
  yearsOfTeaching: number;
  images: string[];
  gymMotto: string;
  status: "active" | "inactive";
  dateCreated: string;
  authUid: string;
}

interface CoachFormData {
  name: string;
  email: string;
  phone: string;
  specialty: "gym" | "karate" | "boxing" | "zumba";
  yearsOfTeaching: number;
  gymMotto: string;
  status: "active" | "inactive";
  password: string;
  images: File[];
}

interface Specialty {
  value: "gym" | "karate" | "boxing" | "zumba";
  label: string;
  color: string;
}

// Cloudinary configuration
const cloudinaryConfig = {
  cloudName: 'dwdsrnpqs',
  uploadPreset: 'coach_uploads',
};

// Type guard for Firebase Auth errors
function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'name' in error &&
    typeof (error as AuthError).code === 'string'
  );
}

// Initial form state
const initialCoachForm: CoachFormData = {
  name: "",
  email: "",
  phone: "",
  specialty: "gym",
  yearsOfTeaching: 1,
  gymMotto: "",
  status: "active",
  password: "",
  images: [],
};

export default function CoachManagementPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [uploadingImages, setUploadingImages] = useState(false);

  const [coachForm, setCoachForm] = useState<CoachFormData>(initialCoachForm);

  const specialties: Specialty[] = [
    { value: "gym", label: "Gym Training", color: "text-orange-400" },
    { value: "karate", label: "Karate", color: "text-blue-400" },
    { value: "boxing", label: "Boxing", color: "text-red-400" },
    { value: "zumba", label: "Zumba", color: "text-pink-400" }
  ];

  // Upload images to Cloudinary
  const uploadImagesToCloudinary = async (images: File[], coachId: string): Promise<string[]> => {
    const uploadPromises = images.map(async (image) => {
      try {
        const formData = new FormData();
        formData.append('file', image);
        formData.append('upload_preset', cloudinaryConfig.uploadPreset);
        formData.append('folder', `coaches/${coachId}`);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Cloudinary upload failed:', response.status, errorText);
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.secure_url;
      } catch (error) {
        console.error('Error uploading image to Cloudinary:', error);
        throw error;
      }
    });

    return Promise.all(uploadPromises);
  };

  // Delete images from Cloudinary
  const deleteImagesFromCloudinary = async (imageUrls: string[]): Promise<void> => {
    const deletePromises = imageUrls.map(async (imageUrl) => {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = imageUrl.split('/');
        const uploadIndex = urlParts.findIndex(part => part === 'upload');
        if (uploadIndex === -1) {
          console.warn('Invalid Cloudinary URL:', imageUrl);
          return;
        }

        const publicIdWithVersion = urlParts.slice(uploadIndex + 2).join('/');
        const publicId = publicIdWithVersion.split('.')[0];

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/destroy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              public_id: publicId,
              api_key: '419659386863313',
            }),
          }
        );

        if (!response.ok) {
          console.warn(`Failed to delete image: ${publicId}`);
        } else {
          console.log('Successfully deleted image:', publicId);
        }
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    });

    await Promise.all(deletePromises);
  };

  // Generate optimized Cloudinary URL
  const getOptimizedImageUrl = (imageUrl: string, width: number = 300, height: number = 300): string => {
    if (!imageUrl.includes('cloudinary.com')) return imageUrl;
    
    const urlParts = imageUrl.split('/');
    const versionIndex = urlParts.findIndex(part => part.startsWith('v'));
    const publicIdWithExtension = urlParts.slice(versionIndex + 1).join('/');
    const publicId = publicIdWithExtension.split('.')[0];
    
    return `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/c_fill,w_${width},h_${height},q_auto,f_auto/${publicId}`;
  };

  // Fetch coaches from Firestore
  useEffect(() => {
    let unsubscribe: Unsubscribe = () => {};

    const fetchCoaches = () => {
      try {
        const coachesRef = collection(db, "users");
        const q = query(coachesRef, where("role", "==", "coach"));
        
        unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
          const coachesData: Coach[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            coachesData.push({
              id: doc.id,
              name: data.name || "",
              email: data.email || "",
              phone: data.phone || "",
              specialty: data.specialty || "gym",
              yearsOfTeaching: data.yearsOfTeaching || 0,
              images: data.images || [],
              gymMotto: data.gymMotto || "",
              status: data.status || "active",
              dateCreated: data.createdAt || "",
              authUid: data.authUid || ""
            });
          });
          setCoaches(coachesData);
        });
      } catch (error: unknown) {
        console.error('Error fetching coaches:', error);
      }
    };

    fetchCoaches();
    return () => unsubscribe();
  }, []);

  // Validate phone number (11 digits maximum)
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^[0-9]{1,11}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages = Array.from(files);
    
    const validImages = newImages.filter(image => {
      const isValidType = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(image.type);
      const isValidSize = image.size <= 10 * 1024 * 1024;
      
      if (!isValidType) {
        alert(`File ${image.name} is not a supported image type. Please use JPEG, PNG, or WebP.`);
        return false;
      }
      
      if (!isValidSize) {
        alert(`File ${image.name} is too large. Please use images under 10MB.`);
        return false;
      }
      
      return true;
    });

    setCoachForm(prev => ({
      ...prev,
      images: [...prev.images, ...validImages]
    }));
  };

  const removeImage = (index: number) => {
    setCoachForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Handle phone number input with validation
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
      setCoachForm(prev => ({ ...prev, phone: value }));
    }
  };

  // Reset form function
  const resetForm = () => {
    setCoachForm(initialCoachForm);
  };

  // Close add form and reset
  const closeAddForm = () => {
    setShowAddForm(false);
    resetForm();
  };

  // Close edit form and reset
  const closeEditForm = () => {
    setShowEditForm(false);
    setEditingCoach(null);
    resetForm();
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhoneNumber(coachForm.phone)) {
      alert("Please enter a valid phone number (maximum 11 digits)");
      return;
    }

    setLoading(true);
    setUploadingImages(true);

    try {
      // 1. Create authentication account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        coachForm.email, 
        coachForm.password
      );
      
      const authUid = userCredential.user.uid;

      // 2. Upload images to Cloudinary
      let imageUrls: string[] = [];
      if (coachForm.images.length > 0) {
        imageUrls = await uploadImagesToCloudinary(coachForm.images, authUid);
      }

      // 3. Add to Firestore users collection
const userData = {
  name: coachForm.name,
  email: coachForm.email,
  phone: coachForm.phone,
  specialty: coachForm.specialty,
  yearsOfTeaching: coachForm.yearsOfTeaching,
  images: imageUrls,
  gymMotto: coachForm.gymMotto,
  status: coachForm.status,
  role: "coach",
  authUid: authUid,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

      await addDoc(collection(db, "users"), userData);

      setSuccessMessage("✅ Coach added successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      resetForm();
      closeAddForm();

    } catch (error: unknown) {
      console.error('Error adding coach:', error);
      
      let errorMessage = "Unknown error occurred";
      
      if (isAuthError(error)) {
        switch (error.code) {
          case "auth/email-already-in-use":
            errorMessage = "Email address is already in use.";
            break;
          case "auth/invalid-email":
            errorMessage = "Invalid email address.";
            break;
          case "auth/weak-password":
            errorMessage = "Password is too weak.";
            break;
          case "auth/operation-not-allowed":
            errorMessage = "Email/password accounts are not enabled.";
            break;
          default:
            errorMessage = error.message || "Authentication failed.";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  // Edit coach functionality
  const handleEditCoach = (coach: Coach) => {
    setEditingCoach(coach);
    setCoachForm({
      name: coach.name,
      email: coach.email,
      phone: coach.phone,
      specialty: coach.specialty,
      yearsOfTeaching: coach.yearsOfTeaching,
      gymMotto: coach.gymMotto,
      status: coach.status,
      password: "",
      images: [],
    });
    setShowEditForm(true);
  };

  // Update coach functionality - FIXED: Proper typing for Firestore update
  const handleUpdateCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Add this to prevent event bubbling
    
    console.log('Update button clicked'); // Debug log
    
    if (!editingCoach) {
      alert("No coach selected for editing");
      return;
    }

    if (!validatePhoneNumber(coachForm.phone)) {
      alert("Please enter a valid phone number (maximum 11 digits)");
      return;
    }

    setLoading(true);
    setUploadingImages(true);

    try {
      let imageUrls: string[] = [...editingCoach.images];

      // Upload new images if any
      if (coachForm.images.length > 0) {
        const newImageUrls = await uploadImagesToCloudinary(coachForm.images, editingCoach.authUid);
        imageUrls = [...imageUrls, ...newImageUrls];
      }

      // Prepare update data with proper typing for Firestore
      const updateData = {
        name: coachForm.name,
        email: coachForm.email,
        phone: coachForm.phone,
        specialty: coachForm.specialty,
        yearsOfTeaching: coachForm.yearsOfTeaching,
        images: imageUrls,
        gymMotto: coachForm.gymMotto,
        status: coachForm.status,
        updatedAt: new Date().toISOString()
      };

      console.log('Updating coach with data:', updateData);

      // Update in Firestore - FIXED: Remove type annotation to allow Firestore's flexible typing
      const coachDocRef = doc(db, "users", editingCoach.id);
      await updateDoc(coachDocRef, updateData);

      setSuccessMessage("✅ Coach updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      resetForm();
      closeEditForm();

    } catch (error: unknown) {
      console.error('Error updating coach:', error);
      let errorMessage = "Error updating coach";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
      setUploadingImages(false);
    }
  };

  // Delete image from coach
  const handleDeleteImage = async (coach: Coach, imageIndex: number) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const imageToDelete = coach.images[imageIndex];
      const updatedImages = coach.images.filter((_, index) => index !== imageIndex);

      // Delete from Cloudinary
      await deleteImagesFromCloudinary([imageToDelete]);

      // Update Firestore
      await updateDoc(doc(db, "users", coach.id), {
        images: updatedImages,
        updatedAt: new Date().toISOString()
      });

      setSuccessMessage("Image deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: unknown) {
      console.error('Error deleting image:', error);
      const errorMessage = error instanceof Error ? error.message : "Error deleting image";
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleDeleteCoach = async (coach: Coach) => {
    if (confirm("Are you sure you want to delete this coach? This will also delete their images from Cloudinary.")) {
      try {
        // Delete images from Cloudinary
        if (coach.images && coach.images.length > 0) {
          await deleteImagesFromCloudinary(coach.images);
        }

        // Delete from Firestore
        await deleteDoc(doc(db, "users", coach.id));
        
        setSuccessMessage("Coach deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 3000);
      } catch (error: unknown) {
        console.error('Error deleting coach:', error);
        const errorMessage = error instanceof Error ? error.message : "Error deleting coach";
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  const handleStatusToggle = async (coach: Coach) => {
    try {
      const newStatus = coach.status === "active" ? "inactive" : "active";
      await updateDoc(doc(db, "users", coach.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      setSuccessMessage(`Coach status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: unknown) {
      console.error('Error updating status:', error);
      const errorMessage = error instanceof Error ? error.message : "Error updating status";
      alert(`Error: ${errorMessage}`);
    }
  };

  const filteredCoaches = coaches.filter(coach => {
    const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        coach.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        coach.gymMotto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = filterSpecialty === "all" || coach.specialty === filterSpecialty;
    const matchesStatus = filterStatus === "all" || coach.status === filterStatus;
    
    return matchesSearch && matchesSpecialty && matchesStatus;
   });

  const getSpecialtyColor = (specialty: string): string => {
    return specialties.find(s => s.value === specialty)?.color || "text-gray-400";
  };

  const getSpecialtyLabel = (specialty: string): string => {
    return specialties.find(s => s.value === specialty)?.label || specialty;
  };

  // Close modal when clicking outside
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      if (showAddForm) closeAddForm();
      if (showEditForm) closeEditForm();
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Main Content */}
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {successMessage && (
            <div className="bg-green-500/20 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <IconUsers className="size-8 text-orange-400" />
                Coach Management
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage gym coaches and their accounts
              </p>
            </div>
            
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-colors hover:bg-primary/90"
            >
              <IconUserPlus className="size-5" />
              Add New Coach
            </button>
          </div>

          {/* Search and Filter */}
          <div className="bg-card rounded-xl p-6 border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-5" />
                <input
                  type="text"
                  placeholder="Search coaches by name, email, or motto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="relative">
                <IconFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-5" />
                <select
                  value={filterSpecialty}
                  onChange={(e) => setFilterSpecialty(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Specialties</option>
                  {specialties.map(specialty => (
                    <option key={specialty.value} value={specialty.value}>
                      {specialty.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <IconFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-5" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-background border border-input rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Coaches Table */}
          <div className="bg-card rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">Coach</th>
                    <th className="text-left p-4 font-semibold">Specialty</th>
                    <th className="text-left p-4 font-semibold">Experience</th>
                    <th className="text-left p-4 font-semibold">Gym Motto</th>
                    <th className="text-left p-4 font-semibold">Images</th>
                    <th className="text-left p-4 font-semibold">Status</th>
                    <th className="text-left p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoaches.map((coach) => (
                    <tr key={coach.id} className="border-b hover:bg-muted/50">
                      <td className="p-4">
                        <div>
                          <p className="font-semibold">{coach.name}</p>
                          <p className="text-sm text-muted-foreground">{coach.email}</p>
                          <p className="text-sm text-muted-foreground">{coach.phone}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSpecialtyColor(coach.specialty)} bg-muted`}>
                          {getSpecialtyLabel(coach.specialty)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-foreground font-semibold">
                          {coach.yearsOfTeaching} {coach.yearsOfTeaching === 1 ? 'year' : 'years'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-foreground italic">
                          {coach.gymMotto || "No motto set"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {coach.images && coach.images.slice(0, 3).map((image, index) => (
                            <div key={index} className="relative group">
                              <Image
                                src={getOptimizedImageUrl(image, 80, 80)}
                                alt={`Coach ${coach.name} ${index + 1}`}
                                width={80}
                                height={80}
                                className="w-10 h-10 rounded-lg object-cover border"
                              />
                              <button
                                onClick={() => handleDeleteImage(coach, index)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete image"
                              >
                                <IconX className="size-3" />
                              </button>
                            </div>
                          ))}
                          {coach.images && coach.images.length > 3 && (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
                              +{coach.images.length - 3}
                            </div>
                          )}
                          {(!coach.images || coach.images.length === 0) && (
                            <span className="text-sm text-muted-foreground">No images</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleStatusToggle(coach)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            coach.status === "active"
                              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          }`}
                        >
                          {coach.status === "active" ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditCoach(coach)}
                            className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Edit Coach"
                          >
                            <IconEdit className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCoach(coach)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title="Delete Coach"
                          >
                            <IconTrash className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredCoaches.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <IconUsers className="size-12 mx-auto mb-4 opacity-50" />
                  <p>No coaches found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl p-6 border text-center">
              <p className="text-muted-foreground text-sm">Total Coaches</p>
              <p className="text-2xl font-bold text-foreground">{coaches.length}</p>
            </div>
            <div className="bg-card rounded-xl p-6 border text-center">
              <p className="text-muted-foreground text-sm">Active Coaches</p>
              <p className="text-2xl font-bold text-green-400">
                {coaches.filter(c => c.status === "active").length}
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 border text-center">
              <p className="text-muted-foreground text-sm">Avg. Experience</p>
              <p className="text-2xl font-bold text-orange-400">
                {coaches.length > 0 
                  ? Math.round(coaches.reduce((acc, c) => acc + c.yearsOfTeaching, 0) / coaches.length)
                  : 0} years
              </p>
            </div>
            <div className="bg-card rounded-xl p-6 border text-center">
              <p className="text-muted-foreground text-sm">Total Images</p>
              <p className="text-2xl font-bold text-blue-400">
                {coaches.reduce((acc, c) => acc + (c.images?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Coach Form Modal */}
      {showAddForm && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div 
            className="bg-background rounded-2xl p-8 max-w-2xl w-full border max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center">Add New Coach</h2>

              <form onSubmit={handleAddCoach}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={coachForm.name}
                        onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter coach's full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={coachForm.email}
                        onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter email address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Phone Number * (max 11 digits)
                      </label>
                      <input
                        type="tel"
                        required
                        value={coachForm.phone}
                        onChange={handlePhoneChange}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter phone number (digits only)"
                        maxLength={11}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum 11 digits allowed
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Years of Teaching *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="50"
                        value={coachForm.yearsOfTeaching}
                        onChange={(e) => setCoachForm({ ...coachForm, yearsOfTeaching: parseInt(e.target.value) || 1 })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter years of experience"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Specialty *
                      </label>
                      <select
                        required
                        value={coachForm.specialty}
                        onChange={(e) => setCoachForm({ ...coachForm, specialty: e.target.value as "gym" | "karate" | "boxing" | "zumba" })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {specialties.map(specialty => (
                          <option key={specialty.value} value={specialty.value}>
                            {specialty.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Gym Motto
                      </label>
                      <textarea
                        value={coachForm.gymMotto}
                        onChange={(e) => setCoachForm({ ...coachForm, gymMotto: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Enter coach's gym motto or philosophy"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={coachForm.password}
                        onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter password (min. 6 characters)"
                      />
                    </div>
                  </div>
                </div>

                {/* Image Upload Section */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Coach Images
                  </label>
                  <div className="border-2 border-dashed border-input rounded-lg p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="coach-images"
                    />
                    <label
                      htmlFor="coach-images"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <IconUpload className="size-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload images or drag and drop
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG, WEBP up to 10MB each
                      </span>
                    </label>
                  </div>

                  {/* Preview Uploaded Images */}
                  {coachForm.images.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Selected Images ({coachForm.images.length})
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        {coachForm.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <Image
                              src={URL.createObjectURL(image)}
                              alt={`Preview ${index + 1}`}
                              width={150}
                              height={150}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <IconX className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={closeAddForm}
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingImages}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {loading || uploadingImages ? "Adding..." : "Add Coach"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Coach Form Modal */}
      {showEditForm && editingCoach && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div 
            className="bg-background rounded-2xl p-8 max-w-2xl w-full border max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center">Edit Coach - {editingCoach.name}</h2>

              <form onSubmit={handleUpdateCoach}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={coachForm.name}
                        onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter coach's full name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={coachForm.email}
                        onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter email address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Phone Number * (max 11 digits)
                      </label>
                      <input
                        type="tel"
                        required
                        value={coachForm.phone}
                        onChange={handlePhoneChange}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter phone number (digits only)"
                        maxLength={11}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum 11 digits allowed
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Years of Teaching *
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="50"
                        value={coachForm.yearsOfTeaching}
                        onChange={(e) => setCoachForm({ ...coachForm, yearsOfTeaching: parseInt(e.target.value) || 1 })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Enter years of experience"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Specialty *
                      </label>
                      <select
                        required
                        value={coachForm.specialty}
                        onChange={(e) => setCoachForm({ ...coachForm, specialty: e.target.value as "gym" | "karate" | "boxing" | "zumba" })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {specialties.map(specialty => (
                          <option key={specialty.value} value={specialty.value}>
                            {specialty.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Gym Motto
                      </label>
                      <textarea
                        value={coachForm.gymMotto}
                        onChange={(e) => setCoachForm({ ...coachForm, gymMotto: e.target.value })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        placeholder="Enter coach's gym motto or philosophy"
                        rows={3}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted-foreground mb-2">
                        Status *
                      </label>
                      <select
                        required
                        value={coachForm.status}
                        onChange={(e) => setCoachForm({ ...coachForm, status: e.target.value as "active" | "inactive" })}
                        className="w-full bg-background border border-input rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Existing Images Display */}
                {editingCoach.images && editingCoach.images.length > 0 && (
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-muted-foreground mb-2">
                      Current Images
                    </label>
                    <div className="grid grid-cols-4 gap-4">
                      {editingCoach.images.map((image, index) => (
                        <div key={index} className="relative group">
                          <Image
                            src={getOptimizedImageUrl(image, 150, 150)}
                            alt={`Current ${index + 1}`}
                            width={150}
                            height={150}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs">Current Image</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image Upload Section for Edit */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Add More Images
                  </label>
                  <div className="border-2 border-dashed border-input rounded-lg p-6 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="edit-coach-images"
                    />
                    <label
                      htmlFor="edit-coach-images"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <IconUpload className="size-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload additional images
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PNG, JPG, WEBP up to 10MB each
                      </span>
                    </label>
                  </div>

                  {/* Preview New Images */}
                  {coachForm.images.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        New Images to Upload ({coachForm.images.length})
                      </h4>
                      <div className="grid grid-cols-4 gap-4">
                        {coachForm.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <Image
                              src={URL.createObjectURL(image)}
                              alt={`Preview ${index + 1}`}
                              width={150}
                              height={150}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <IconX className="size-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    type="button"
                    onClick={closeEditForm}
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingImages}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    {loading || uploadingImages ? "Updating..." : "Update Coach"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}