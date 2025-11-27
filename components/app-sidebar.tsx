"use client";

import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconHelp,
  IconSearch,
  IconSettings,
  IconUsers,
  IconCalendar,
  IconMessage,
  IconCreditCard,
} from "@tabler/icons-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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

// Custom hook for route protection
export function useRouteProtection() {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // User is not authenticated, redirect to login
        setUser(null);
        setUserRole(null);
        setIsChecking(false);
        router.push("/login");
        return;
      }

      // User is authenticated
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData & { role?: string };
          const role = (data?.role as UserRole) || "client";
          setUserRole(role);
          setUser({
            name: data.name || currentUser.displayName || "GymSchedPro User",
            email: currentUser.email || "user@example.com",
            avatar: data.photoURL || "/avatars/default.jpg",
            role: role,
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
            setIsChecking(false);
          }
        } else {
          setUserRole("client");
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("client");
        setIsChecking(false);
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  return {
    isChecking,
    userRole,
    user,
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
  const { userRole: hookUserRole, user } = useRouteProtection();
  const userRole = propUserRole?.role || hookUserRole || "client";
  const userId = propUserRole?.userId || user?.email || "unknown";

  const navMain = getNavData(userRole);
  const router = useRouter();
  const pathname = usePathname();

  // Function to handle navigation with permission check
  const handleNavigation = (url: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (!hasAccessToPath(userRole, url)) {
      alert("You don't have permission to access this page.");
      return;
    }

    router.push(url);
  };

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
    </Sidebar>
  );
}