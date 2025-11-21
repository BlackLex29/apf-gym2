"use client"

import * as React from "react"
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
} from "@tabler/icons-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import Image from "next/image"

type UserRole = 'admin' | 'client' | 'coach'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userRole: {
    role: UserRole
    userId: string
  }
}

// Navigation data based on user role
const getNavData = (role: UserRole) => {
  const commonNav = [
    {
      title: "Dashboard",
      url: `/${role === 'admin' ? 'admin' : role === 'coach' ? 'kowts' : 'client'}/dashboard`,  
      icon: IconDashboard,
    }, 
  ]

  const adminNav = [
    ...commonNav,
    {
      title: "Users",
      url: "/admin/users-management",
      icon: IconUsers,
    },
    {
      title: "Analytics",
      url: "/admin/analytics",
      icon: IconChartBar,
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
    }
  ]

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
  ]

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
  ]

  switch (role) {
    case 'admin':
      return adminNav
    case 'coach':
      return coachNav
    case 'client':
    default:
      return clientNav
  }
}

const getSecondaryNav = (role: UserRole) => {
  return [
    {
      title: "Settings",
      url: role === 'admin' ? "/admin/settings" : role === 'coach' ? "/kowts/settings" : "/client/settings",
      icon: IconSettings,
    },
    {
      title: "Get Help",
      url: "#",
      icon: IconHelp,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ]
}

// Get redirect path based on user role
const getRedirectPath = (userRole: UserRole): string => {
  switch (userRole) {
    case 'admin':
      return '/admin/dashboard'
    case 'coach':
      return '/kowts/dashboard'
    case 'client':
    default:
      return '/client/dashboard'
  }
}

export function AppSidebar({ userRole, ...props }: AppSidebarProps) {
  const navMain = getNavData(userRole.role)
  const navSecondary = getSecondaryNav(userRole.role)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href={getRedirectPath(userRole.role)}>
                {/* Logo using Image component */}
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
          {navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        {/* Secondary Navigation */}
        <SidebarMenu className="mt-auto">
          {navSecondary.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}