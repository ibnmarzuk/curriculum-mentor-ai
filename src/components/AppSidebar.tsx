import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Compass,
  MessageSquare,
  GraduationCap,
  User,
  BookOpen,
  Map,
  Target,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const NAV = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Tracks", url: "/tracks", icon: Map },
  { title: "Browse", url: "/browse", icon: Compass },
  { title: "Mentor", url: "/mentor", icon: MessageSquare },
  { title: "Assessments", url: "/assessments", icon: GraduationCap },
  { title: "Checkpoints", url: "/checkpoints", icon: Target },
  { title: "Profile", url: "/profile", icon: User },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-2 text-foreground"
          aria-label="Home"
        >
          <BookOpen size={18} className="text-primary shrink-0" />
          {!collapsed && (
            <span className="serif italic text-base truncate">
              Learn2Earn <span className="text-primary">Mentor</span>
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active =
                  pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
