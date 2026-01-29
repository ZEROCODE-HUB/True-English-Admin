import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Brain,
  MessageSquare,
  BarChart3,
  CreditCard,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";

import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const menuItems = [
  { id: "dashboard", title: "Panel de Control", icon: LayoutDashboard },
  { id: "users", title: "Gestión de Usuarios", icon: Users },
  { id: "courses", title: "Gestión de Cursos", icon: BookOpen },
  { id: "quizzes", title: "Gestión de Quizzes", icon: Brain },
  { id: "conversations", title: "Conversaciones con IA", icon: MessageSquare },
  { id: "plans", title: "Planes", icon: CreditCard },
  { id: "subscriptions", title: "Suscripciones", icon: BarChart3 },
];
export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (id: string) => {
    const path = `/${id}`;
    navigate(path);
  };

  const { signOut } = useAuth();

  const { user } = useAuth();
  const [profile, setProfile] = useState<{ name?: string | null; last_name?: string | null; email?: string | null; avatar_url?: string | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!user?.id) return setProfile(null);
      try {
        const { data, error } = await supabase.from('profiles').select('name,last_name,email,avatar_url').eq('id', user.id).maybeSingle();
        if (error) {
          console.error('failed to load profile', error);
          return;
        }
        if (!mounted) return;
        setProfile(data ?? null);
      } catch (e) {
        console.error('failed to load profile', e);
      }
    };
    loadProfile();
    return () => { mounted = false };
  }, [user]);

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
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-accent-foreground font-bold">{(profile?.name ? profile.name[0] : (user?.email ? user.email[0] : 'U')).toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-sidebar-foreground">{profile?.name ? `${profile.name}${profile.last_name ? ' ' + profile.last_name : ''}` : user?.email}</div>
                  <div className="text-xs text-sidebar-foreground/80">{profile?.email ?? user?.email}</div>
                </div>
              </div>

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