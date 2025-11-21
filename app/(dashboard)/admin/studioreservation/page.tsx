"use client";
import React, { useState, useEffect } from "react";
import {
  IconUsers,
  IconUserPlus,
  IconTrash,
  IconSearch,
  IconEdit,
  IconStar,
  IconPhone,
  IconMail,
  IconCalendar,
  IconX,
  IconCurrencyPeso,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: "gym" | "karate" | "boxing" | "zumba" | "yoga" | "crossfit";
  experience: string;
  status: "active" | "inactive";
  dateCreated: string;
  authUid: string;
  hourlyRate?: number;
  bio?: string;
}

interface CoachFormData {
  name: string;
  email: string;
  phone: string;
  specialty: "gym" | "karate" | "boxing" | "zumba" | "yoga" | "crossfit";
  experience: string;
  status: "active" | "inactive";
  password: string;
  hourlyRate: number;
  bio: string;
}

interface Specialty {
  value: "gym" | "karate" | "boxing" | "zumba" | "yoga" | "crossfit";
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

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

export default function CoachManagementPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState("all");

  const [coachForm, setCoachForm] = useState<CoachFormData>({
    name: "",
    email: "",
    phone: "",
    specialty: "gym",
    experience: "",
    status: "active",
    password: "",
    hourlyRate: 500,
    bio: "",
  });

  const specialties: Specialty[] = [
    { value: "gym", label: "Gym Training", icon: "💪", color: "text-blue-600", bgColor: "bg-blue-500" },
    { value: "karate", label: "Karate", icon: "🥋", color: "text-red-600", bgColor: "bg-red-500" },
    { value: "boxing", label: "Boxing", icon: "🥊", color: "text-orange-600", bgColor: "bg-orange-500" },
    { value: "zumba", label: "Zumba", icon: "💃", color: "text-purple-600", bgColor: "bg-purple-500" },
    { value: "yoga", label: "Yoga", icon: "🧘", color: "text-green-600", bgColor: "bg-green-500" },
    { value: "crossfit", label: "CrossFit", icon: "🔥", color: "text-yellow-600", bgColor: "bg-yellow-500" }
  ];

  // Fetch coaches from Firestore
  useEffect(() => {
    const fetchCoaches = (): Unsubscribe => {
      try {
        const coachesRef = collection(db, "users");
        const q = query(coachesRef, where("role", "==", "coach"));
        
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
          const coachesData: Coach[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            coachesData.push({
              id: doc.id,
              name: data.name || "",
              email: data.email || "",
              phone: data.phone || "",
              specialty: data.specialty || "gym",
              experience: data.experience || "",
              status: data.status || "active",
              dateCreated: data.createdAt || "",
              authUid: data.authUid || "",
              hourlyRate: data.hourlyRate || 500,
              bio: data.bio || ""
            });
          });
          setCoaches(coachesData);
        });

        return unsubscribe;
      } catch (error: unknown) {
        console.error('Error fetching coaches:', error);
        return () => {};
      }
    };

    const unsubscribe = fetchCoaches();
    return () => unsubscribe();
  }, []);

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        coachForm.email, 
        coachForm.password
      );
      
      const authUid = userCredential.user.uid;

      const userData = {
        name: coachForm.name,
        email: coachForm.email,
        phone: coachForm.phone,
        specialty: coachForm.specialty,
        experience: coachForm.experience,
        status: coachForm.status,
        hourlyRate: coachForm.hourlyRate,
        bio: coachForm.bio,
        role: "coach",
        authUid: authUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, "users"), userData);

      setSuccessMessage("✅ Coach added successfully!");
      setTimeout(() => setSuccessMessage(""), 5000);
      
      setCoachForm({
        name: "",
        email: "",
        phone: "",
        specialty: "gym",
        experience: "",
        status: "active",
        password: "",
        hourlyRate: 500,
        bio: "",
      });
      setShowAddForm(false);

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
      
      setSuccessMessage(`❌ ${errorMessage}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCoach = async (id: string) => {
    if (confirm("Are you sure you want to delete this coach? This action cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "users", id));
        setSuccessMessage("🗑️ Coach deleted successfully!");
        setTimeout(() => setSuccessMessage(""), 5000);
      } catch (error: unknown) {
        console.error('Error deleting coach:', error);
        const errorMessage = error instanceof Error ? error.message : "Error deleting coach";
        setSuccessMessage(`❌ ${errorMessage}`);
        setTimeout(() => setSuccessMessage(""), 5000);
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
      
      setSuccessMessage(`🔄 Coach status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: unknown) {
      console.error('Error updating status:', error);
      const errorMessage = error instanceof Error ? error.message : "Error updating status";
      setSuccessMessage(`❌ ${errorMessage}`);
      setTimeout(() => setSuccessMessage(""), 5000);
    }
  };

  const filteredCoaches = coaches.filter(coach => {
    const matchesSearch = coach.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         coach.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = filterSpecialty === "all" || coach.specialty === filterSpecialty;
    const matchesStatus = filterStatus === "all" || coach.status === filterStatus;
    const matchesTab = activeTab === "all" || 
                      (activeTab === "active" && coach.status === "active") ||
                      (activeTab === "inactive" && coach.status === "inactive");
    
    return matchesSearch && matchesSpecialty && matchesStatus && matchesTab;
  });

  const getSpecialtyIcon = (specialty: string): string => {
    return specialties.find(s => s.value === specialty)?.icon || "💪";
  };

  const getSpecialtyLabel = (specialty: string): string => {
    return specialties.find(s => s.value === specialty)?.label || specialty;
  };

  const getSpecialtyBgColor = (specialty: string): string => {
    return specialties.find(s => s.value === specialty)?.bgColor || "bg-blue-500";
  };

  const stats = {
    total: coaches.length,
    active: coaches.filter(c => c.status === "active").length,
    gym: coaches.filter(c => c.specialty === "gym").length,
    classes: coaches.filter(c => c.specialty !== "gym").length,
    averageRate: coaches.reduce((acc, coach) => acc + (coach.hourlyRate || 500), 0) / Math.max(coaches.length, 1)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/20 text-foreground p-0 m-0">
      {/* Main Content - Fullscreen */}
      <div className="w-full min-h-screen p-6 space-y-6">
        {successMessage && (
          <Alert className={
            successMessage.includes("✅") || successMessage.includes("🔄") 
              ? "bg-green-500/10 border-green-500/20" 
              : "bg-red-500/10 border-red-500/20"
          }>
            <AlertDescription className={
              successMessage.includes("✅") || successMessage.includes("🔄")
                ? "text-green-600 font-medium"
                : "text-red-600 font-medium"
            }>
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
                <IconUsers className="size-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Coach Management
                </h1>
                <p className="text-xl text-muted-foreground mt-2">
                  Manage your coaching team and their specialties
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => setShowAddForm(true)} 
            className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 text-lg font-semibold h-auto"
          >
            <IconUserPlus className="size-6" />
            Add New Coach
          </Button>
        </div>

        {/* Stats Grid - Full Width */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-muted-foreground">Total Coaches</p>
                  <p className="text-4xl font-bold text-blue-600 mt-2">{stats.total}</p>
                  <p className="text-sm text-muted-foreground mt-1">All team members</p>
                </div>
                <div className="p-4 bg-blue-100 rounded-2xl">
                  <IconUsers className="size-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-muted-foreground">Active Coaches</p>
                  <p className="text-4xl font-bold text-green-600 mt-2">{stats.active}</p>
                  <p className="text-sm text-muted-foreground mt-1">Currently working</p>
                </div>
                <div className="p-4 bg-green-100 rounded-2xl">
                  <IconStar className="size-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-muted-foreground">Class Coaches</p>
                  <p className="text-4xl font-bold text-purple-600 mt-2">{stats.classes}</p>
                  <p className="text-sm text-muted-foreground mt-1">Specialized training</p>
                </div>
                <div className="p-4 bg-purple-100 rounded-2xl">
                  <span className="text-3xl">💃</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-muted-foreground">Avg. Hourly Rate</p>
                  <p className="text-4xl font-bold text-orange-600 mt-2">₱{Math.round(stats.averageRate)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Per coach</p>
                </div>
                <div className="p-4 bg-orange-100 rounded-2xl">
                  <IconCurrencyPeso className="size-8 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Control Section - Full Width */}
        <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center justify-between">
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full xl:w-auto">
                <TabsList className="grid w-full grid-cols-3 xl:w-auto bg-muted/50 p-1 rounded-2xl">
                  <TabsTrigger 
                    value="all" 
                    className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
                  >
                    All Coaches
                  </TabsTrigger>
                  <TabsTrigger 
                    value="active" 
                    className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
                  >
                    Active
                  </TabsTrigger>
                  <TabsTrigger 
                    value="inactive" 
                    className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg"
                  >
                    Inactive
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full xl:w-2/3">
                <div className="relative">
                  <IconSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground size-6" />
                  <Input
                    type="text"
                    placeholder="Search coaches by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-12 bg-white border-2 border-gray-200 rounded-2xl h-14 text-lg shadow-sm focus:border-blue-500 transition-colors"
                  />
                </div>

                <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
                  <SelectTrigger className="bg-white border-2 border-gray-200 rounded-2xl h-14 text-lg shadow-sm focus:border-blue-500">
                    <SelectValue placeholder="All Specialties" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-2 border-gray-200">
                    <SelectItem value="all" className="text-lg py-3">All Specialties</SelectItem>
                    {specialties.map(specialty => (
                      <SelectItem key={specialty.value} value={specialty.value} className="text-lg py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{specialty.icon}</span>
                          <span>{specialty.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-white border-2 border-gray-200 rounded-2xl h-14 text-lg shadow-sm focus:border-blue-500">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-2 border-gray-200">
                    <SelectItem value="all" className="text-lg py-3">All Status</SelectItem>
                    <SelectItem value="active" className="text-lg py-3">Active</SelectItem>
                    <SelectItem value="inactive" className="text-lg py-3">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coaches Grid - Full Width */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredCoaches.map((coach) => (
            <Card key={coach.id} className="bg-white/90 backdrop-blur-md border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${getSpecialtyBgColor(coach.specialty)} text-white shadow-lg`}>
                      <span className="text-2xl">{getSpecialtyIcon(coach.specialty)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-xl text-gray-900">{coach.name}</h3>
                      <Badge 
                        variant={coach.status === "active" ? "default" : "secondary"}
                        className={
                          coach.status === "active" 
                            ? "bg-green-100 text-green-700 border-green-200 text-sm font-semibold mt-1" 
                            : "bg-gray-100 text-gray-700 border-gray-200 text-sm font-semibold mt-1"
                        }
                      >
                        {coach.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">₱{coach.hourlyRate}</p>
                    <p className="text-xs text-muted-foreground">per hour</p>
                  </div>
                </div>

                {/* Specialty and Experience */}
                <div className="mb-4">
                  <Badge variant="outline" className="mb-3 text-sm font-medium">
                    {getSpecialtyLabel(coach.specialty)}
                  </Badge>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <IconCalendar className="size-4" />
                    {coach.experience}
                  </p>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconMail className="size-4" />
                    <span className="truncate">{coach.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconPhone className="size-4" />
                    <span>{coach.phone}</span>
                  </div>
                </div>

                {/* Bio */}
                {coach.bio && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 bg-gray-50/50 p-3 rounded-xl">
                    {coach.bio}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200/50">
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`status-${coach.id}`} className="text-sm font-medium text-muted-foreground">
                      Active
                    </Label>
                    <Switch
                      id={`status-${coach.id}`}
                      checked={coach.status === "active"}
                      onCheckedChange={() => handleStatusToggle(coach)}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:scale-110 transition-transform"
                      onClick={() => handleDeleteCoach(coach.id)}
                      title="Delete Coach"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 px-4 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 hover:scale-110 transition-transform"
                      title="Edit Coach"
                    >
                      <IconEdit className="size-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State - Full Width */}
        {filteredCoaches.length === 0 && (
          <Card className="bg-white/90 backdrop-blur-md border-0 shadow-xl col-span-full">
            <CardContent className="p-16 text-center">
              <div className="max-w-2xl mx-auto">
                <div className="p-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-3xl inline-block mb-6">
                  <IconUsers className="size-20 text-blue-500 mx-auto" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">No coaches found</h3>
                <p className="text-xl text-muted-foreground mb-8">
                  {searchTerm || filterSpecialty !== "all" || filterStatus !== "all" 
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "Get started by adding your first coach to build your dream team."}
                </p>
                {!searchTerm && filterSpecialty === "all" && filterStatus === "all" && (
                  <Button 
                    onClick={() => setShowAddForm(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-2xl text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    <IconUserPlus className="size-5 mr-3" />
                    Add Your First Coach
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Coach Form Modal - Fullscreen */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-0 m-0">
          <div className="w-full h-full flex items-center justify-center p-8">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto border-0 shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl text-center mb-2">Add New Coach</CardTitle>
                    <CardDescription className="text-blue-100 text-lg text-center">
                      Create a new coach account with full details
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAddForm(false)}
                    className="h-12 w-12 rounded-xl bg-white/20 hover:bg-white/30 text-white"
                  >
                    <IconX className="size-6" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <form onSubmit={handleAddCoach} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Full Name *</label>
                      <Input
                        type="text"
                        required
                        value={coachForm.name}
                        onChange={(e) => setCoachForm({ ...coachForm, name: e.target.value })}
                        placeholder="Enter coach's full name"
                        className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Email Address *</label>
                      <Input
                        type="email"
                        required
                        value={coachForm.email}
                        onChange={(e) => setCoachForm({ ...coachForm, email: e.target.value })}
                        placeholder="Enter email address"
                        className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Phone Number *</label>
                      <Input
                        type="tel"
                        required
                        value={coachForm.phone}
                        onChange={(e) => setCoachForm({ ...coachForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                        className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Hourly Rate (₱) *</label>
                      <Input
                        type="number"
                        required
                        min="100"
                        step="50"
                        value={coachForm.hourlyRate}
                        onChange={(e) => setCoachForm({ ...coachForm, hourlyRate: Number(e.target.value) })}
                        placeholder="500"
                        className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Specialty *</label>
                      <Select
                        value={coachForm.specialty}
                        onValueChange={(value: "gym" | "karate" | "boxing" | "zumba" | "yoga" | "crossfit") => 
                          setCoachForm({ ...coachForm, specialty: value })
                        }
                      >
                        <SelectTrigger className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 border-gray-200">
                          {specialties.map(specialty => (
                            <SelectItem key={specialty.value} value={specialty.value} className="text-lg py-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{specialty.icon}</span>
                                <span>{specialty.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-lg font-medium text-gray-700">Experience *</label>
                      <Input
                        type="text"
                        required
                        value={coachForm.experience}
                        onChange={(e) => setCoachForm({ ...coachForm, experience: e.target.value })}
                        placeholder="e.g., 5 years of experience"
                        className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-lg font-medium text-gray-700">Bio</label>
                    <textarea
                      value={coachForm.bio}
                      onChange={(e) => setCoachForm({ ...coachForm, bio: e.target.value })}
                      placeholder="Tell us about the coach's background, qualifications, and teaching style..."
                      rows={4}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-lg font-medium text-gray-700">Password *</label>
                    <Input
                      type="password"
                      required
                      minLength={6}
                      value={coachForm.password}
                      onChange={(e) => setCoachForm({ ...coachForm, password: e.target.value })}
                      placeholder="Enter password (min. 6 characters)"
                      className="rounded-xl h-14 text-lg border-2 border-gray-200 focus:border-blue-500"
                    />
                  </div>

                  <div className="flex gap-6 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 rounded-xl h-14 text-lg font-semibold border-2 border-gray-300 hover:border-gray-400"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl h-14 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300"
                    >
                      {loading ? (
                        <div className="flex items-center gap-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                          Adding Coach...
                        </div>
                      ) : (
                        "Add Coach"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}