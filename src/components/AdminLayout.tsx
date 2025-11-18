import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Brain,
  MessageSquare,
  BarChart3,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const menuItems = [
  { id: "dashboard", title: "Panel de Control", icon: LayoutDashboard },
  { id: "users", title: "Gestión de Usuarios", icon: Users },
  { id: "courses", title: "Gestión de Cursos", icon: BookOpen },
  { id: "quizzes", title: "Gestión de Quizzes", icon: Brain },
  { id: "conversations", title: "Conversaciones con IA", icon: MessageSquare },
];
export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (id: string) => {
    const path = `/${id}`;
    navigate(path);
  };

  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="w-64 border-r bg-primary">
          <SidebarContent>
            <div className="p-6 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <span className="text-accent-foreground font-bold text-sm">TE</span>
                </div>
                <div>
                  <h1 className="text-sidebar-foreground font-bold">TrueEnglish</h1>
                  <p className="text-sidebar-foreground/80 text-sm">Academy Admin</p>
                </div>
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent ${location.pathname === `/${item.id}` || (item.id === "dashboard" && location.pathname === "/")
                          ? "bg-sidebar-accent"
                          : ""
                          }`}
                      >
                        <item.icon className="w-5 h-5 mr-3" />
                        {item.title}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="mt-auto p-4 border-t border-sidebar-border">
              <Button
                onClick={handleLogout}
                className="w-full justify-start bg-[hsl(220,70%,25%)] text-white hover:bg-[hsl(220,70%,25%)] border-0"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Cerrar Sesión
              </Button>
            </div>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 bg-background">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}