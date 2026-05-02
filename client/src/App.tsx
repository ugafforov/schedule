import { useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Timetables from "@/pages/timetables";
import Teachers from "@/pages/teachers";
import Classes from "@/pages/classes";
import Subjects from "@/pages/subjects";
import Rooms from "@/pages/rooms";
import Darslar from "@/pages/darslar";
import Biriktirishlar from "@/pages/biriktirishlar";
import SettingsPage from "@/pages/settings";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Full-width header */}
      <Header onMobileMenuClick={() => setMobileOpen(true)} />

      {/* Sidebar + content row — flex-1 + min-h-0 gives definite height so h-full works inside */}
      <div className="flex flex-1 min-h-0">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <main className="flex-1 overflow-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedLayout><Dashboard /></ProtectedLayout>
      </Route>
      <Route path="/timetables">
        <ProtectedLayout><Timetables /></ProtectedLayout>
      </Route>
      <Route path="/teachers">
        <ProtectedLayout><Teachers /></ProtectedLayout>
      </Route>
      <Route path="/classes">
        <ProtectedLayout><Classes /></ProtectedLayout>
      </Route>
      <Route path="/subjects">
        <ProtectedLayout><Subjects /></ProtectedLayout>
      </Route>
      <Route path="/rooms">
        <ProtectedLayout><Rooms /></ProtectedLayout>
      </Route>
      <Route path="/darslar">
        <ProtectedLayout><Darslar /></ProtectedLayout>
      </Route>
      <Route path="/biriktirishlar">
        <ProtectedLayout><Biriktirishlar /></ProtectedLayout>
      </Route>
      <Route path="/settings">
        <ProtectedLayout><SettingsPage /></ProtectedLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
