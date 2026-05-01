import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Plus, MessageSquare, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BACKEND_URL } from "@/env";

const supabase = createClient();

interface Conversation {
  id: string;
  title: string | null;
  slug: string;
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchConversations() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      try {
        const res = await fetch(`${BACKEND_URL}/conversations`, {
          headers: { Authorization: session.access_token }
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      } catch (error) {
        console.error("Failed to fetch conversations", error);
      }
    }
    fetchConversations();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className="w-64 border-r border-border bg-sidebar h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 bg-foreground rounded flex items-center justify-center text-background font-bold">
          S
        </div>
        <span className="font-semibold text-lg text-foreground">Sven</span>
      </div>

      <button 
        onClick={() => {
          navigate("/");
          if (onClose) onClose();
        }}
        className="flex items-center gap-2 w-full py-2 px-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-full transition-colors border border-border"
      >
        <Plus size={16} />
        <span className="font-medium text-sm">New Thread</span>
      </button>

      <div className="flex-1 overflow-y-auto space-y-1 mt-8">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">History</p>
        {conversations.map((conv) => (
          <Link 
            key={conv.id} 
            to={`/c/${conv.id}`}
            onClick={() => {
              if (onClose) onClose();
            }}
            className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary transition-colors text-sm text-foreground truncate"
          >
            <MessageSquare size={14} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{conv.title || "New Conversation"}</span>
          </Link>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 p-2 w-full rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
