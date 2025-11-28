"use client";

import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconSettings,
  IconUsers,
  IconCalendar,
  IconMessage,
  IconCreditCard,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun, LogOut, User, Monitor } from "lucide-react";
import { useTheme } from "next-themes";

type UserRole = "admin" | "client" | "coach";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userRole?: {
    role: UserRole;
    userId: string;
  };
}

interface UserData {
  name: string;
  email: string;
  avatar: string;
  photoURL?: string;
  role?: UserRole;
  theme?: "light" | "dark" | "system";
}

// Route permission configuration
const routePermissions: Record<UserRole, string[]> = {
  admin: [
    "/admin/dashboard",
    "/admin/users-management",
    "/admin/clientmanagement",
    "/admin/settings",
    "/admin",
  ],
  client: [
    "/client/dashboard",
    "/client/bookstudio",
    "/client/inquire",
    "/client/monthly",
    "/client/settings",
    "/client",
  ],
  coach: ["/kowts/dashboard", "/kowts/session", "/kowts/settings", "/kowts"],
};

// Check if user has access to the current path
const hasAccessToPath = (userRole: UserRole, currentPath: string): boolean => {
  const allowedPaths = routePermissions[userRole];

  // Check exact match or starts with allowed paths
  return allowedPaths.some(
    (path) => currentPath === path || currentPath.startsWith(path + "/")
  );
};

// Navigation data based on user role
const getNavData = (role: UserRole) => {
  const commonNav = [
    {
      title: "Dashboard",
      url: `/${role === "admin" ? "admin" : role === "coach" ? "kowts" : "client"}/dashboard`,
      icon: IconDashboard,
    },
  ];

  const adminNav = [
    ...commonNav,
    {
      title: "Users",
      url: "/admin/users-management",
      icon: IconUsers,
    },
    {
      title: "Client Managements",
      url: "/admin/clientmanagement",
      icon: IconChartBar,
    },
    {
      title: "Settings",
      url: "/admin/settings",
      icon: IconSettings,
    },
  ];

  const clientNav = [
    ...commonNav,
    {
      title: "Book Studio",
      url: "/client/bookstudio",
      icon: IconCalendar,
    },
    {
      title: "Inquire",
      url: "/client/inquire",
      icon: IconMessage,
    },
    {
      title: "Monthly",
      url: "/client/monthly",
      icon: IconCreditCard,
    },
    {
      title: "Settings",
      url: "/client/settings",
      icon: IconSettings,
    },
  ];

  const coachNav = [
    ...commonNav,
    {
      title: "Today's Sessions",
      url: "/kowts/session",
      icon: IconCalendar,
    },
    {
      title: "Settings",
      url: "/kowts/settings",
      icon: IconSettings,
    },
  ];

  switch (role) {
    case "admin":
      return adminNav;
    case "coach":
      return coachNav;
    case "client":
    default:
      return clientNav;
  }
};

// Get redirect path based on user role
const getRedirectPath = (userRole: UserRole): string => {
  switch (userRole) {
    case "admin":
      return "/admin/dashboard";
    case "coach":
      return "/kowts/dashboard";
    case "client":
    default:
      return "/client/dashboard";
  }
};

// Theme Toggle Component - FIXED VERSION
const ThemeToggle = ({ userId }: { userId?: string }) => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Fixed: Use useEffect properly without direct setState
  useEffect(() => {
    // Use requestAnimationFrame to avoid synchronous state updates
    const timer = requestAnimationFrame(() => {
      setMounted(true);
    });
    
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    
    // Save theme preference to Firestore if user is logged in
    if (userId && auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", userId), {
          theme: newTheme,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
          <div className="text-sm font-medium">Theme</div>
        </div>
        <div className="w-10 h-6 bg-muted rounded-full animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          {theme === "dark" ? (
            <Moon className="h-4 w-4 text-yellow-500" />
          ) : theme === "light" ? (
            <Sun className="h-4 w-4 text-orange-500" />
          ) : (
            <Monitor className="h-4 w-4 text-blue-500" />
          )}
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground capitalize">
              {theme} mode
            </p>
          </div>
        </div>
        <Switch
          checked={theme === "dark"}
          onCheckedChange={(checked) => 
            handleThemeChange(checked ? "dark" : "light")
          }
        />
      </div>
      
      {/* Theme Options */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
        <Button
          variant={theme === "light" ? "default" : "ghost"}
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => handleThemeChange("light")}
        >
          <Sun className="h-3 w-3 mr-1" />
          Light
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "ghost"}
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => handleThemeChange("dark")}
        >
          <Moon className="h-3 w-3 mr-1" />
          Dark
        </Button>
        <Button
          variant={theme === "system" ? "default" : "ghost"}
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={() => handleThemeChange("system")}
        >
          <Monitor className="h-3 w-3 mr-1" />
          Auto
        </Button>
      </div>
    </div>
  );
};

// Custom hook for route protection
export function useRouteProtection() {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const { setTheme } = useTheme();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // User is not authenticated, redirect to login
        setUser(null);
        setUserRole(null);
        // Fixed: Use setTimeout to avoid synchronous state updates in effect
        setTimeout(() => setIsChecking(false), 0);
        router.push("/login");
        return;
      }

      // User is authenticated
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData & { role?: string; theme?: string };
          const role = (data?.role as UserRole) || "client";
          const userTheme = (data?.theme as "light" | "dark" | "system") || "system";
          
          setUserRole(role);
          // Set the theme from user preference
          setTheme(userTheme);
          setUser({
            name: data.name || currentUser.displayName || "GymSchedPro User",
            email: currentUser.email || "user@example.com",
            avatar: data.photoURL || "/avatars/default.jpg",
            role: role,
            theme: userTheme,
          });

          // Check if current path is accessible for the user role
          if (!hasAccessToPath(role, pathname)) {
            // Redirect to appropriate dashboard
            const redirectPath = getRedirectPath(role);
            console.warn(
              `🚫 Access denied for ${role} at ${pathname}. Redirecting to ${redirectPath}`
            );
            router.push(redirectPath);
          } else {
            // Fixed: Use setTimeout to avoid synchronous state updates in effect
            setTimeout(() => setIsChecking(false), 0);
          }
        } else {
          setUserRole("client");
          setTimeout(() => setIsChecking(false), 0);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("client");
        setTimeout(() => setIsChecking(false), 0);
      }
    });

    return () => unsubscribe();
  }, [router, pathname, setTheme]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return {
    isChecking,
    userRole,
    user,
    handleLogout,
    hasAccessToPath: userRole
      ? (path: string) => hasAccessToPath(userRole, path)
      : () => false,
  };
}

// Route Guard Component - use this to wrap your pages
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isChecking } = useRouteProtection();

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Protected Link Component - use this for internal navigation
export function ProtectedLink({
  href,
  children,
  ...props
}: {
  href: string;
  children: React.ReactNode;
} & React.ComponentProps<typeof Link>) {
  const { userRole, hasAccessToPath } = useRouteProtection();
  const isAccessible = userRole ? hasAccessToPath(href) : false;

  if (!isAccessible) {
    return (
      <span
        {...props}
        className={`${props.className} cursor-not-allowed opacity-50`}
        title="You don't have permission to access this page"
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}

export function AppSidebar({
  userRole: propUserRole,
  ...props
}: AppSidebarProps) {
  const { userRole: hookUserRole, user, handleLogout } = useRouteProtection();
  const userRole = propUserRole?.role || hookUserRole || "client";

  const navMain = getNavData(userRole);
  const pathname = usePathname();

  // Show loading state while checking auth
  if (!hookUserRole && !propUserRole) {
    return (
      <Sidebar collapsible="offcanvas" {...props}>
        <SidebarContent>
          <div className="flex items-center justify-center p-4">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={getRedirectPath(userRole)}>
                <div className="flex items-center gap-2">
                  <Image
                    src="/APF.jpg"
                    alt="GymSchedPro Logo"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                  <span className="text-base font-semibold">GymSchedPro</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarMenu>
          {navMain.map((item) => {
            const isAccessible = hasAccessToPath(userRole, item.url);
            const isActive =
              pathname === item.url || pathname.startsWith(item.url + "/");

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className={
                    !isAccessible ? "opacity-50 cursor-not-allowed" : ""
                  }
                  isActive={isActive}
                >
                  {isAccessible ? (
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  ) : (
                    <button
                      className="w-full text-left"
                      disabled
                      title="You don't have permission to access this page"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </button>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer with User Info, Theme Toggle, and Logout */}
      <SidebarFooter>
        <div className="space-y-3 p-2">
          {/* User Info */}
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {user.role}
                </p>
              </div>
            </div>
          )}

          {/* Theme Toggle - FIXED */}
          <ThemeToggle userId={user?.role ? auth.currentUser?.uid : undefined} />

          {/* Logout Button */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}