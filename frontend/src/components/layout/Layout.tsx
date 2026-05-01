import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Layout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <div className="md:hidden absolute top-4 left-4 z-50">
        <button 
          onClick={() => setIsMobileOpen(true)}
          className="p-2 bg-card border border-border rounded-lg shadow-sm text-foreground hover:bg-secondary transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="hidden md:block h-full shrink-0">
        <Sidebar />
      </div>

      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:hidden bg-sidebar shadow-xl w-64 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setIsMobileOpen(false)} />
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>
      </div>

      <main className="flex-1 h-full overflow-y-auto bg-background md:pt-0 pt-16">
        <Outlet />
      </main>
    </div>
  );
}
