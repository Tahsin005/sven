import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function PublicRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      } else {
        setIsCheckingAuth(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isCheckingAuth) return null;

  return <>{children}</>;
}
