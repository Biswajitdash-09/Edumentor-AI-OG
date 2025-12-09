import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type AppRole = "student" | "faculty" | "admin" | "parent";

export const useRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching role:", error);
          setRole(null);
        } else {
          setRole(data?.role ?? null);
        }
      } catch (err) {
        console.error("Error fetching role:", err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchRole();
    }
  }, [user, authLoading]);

  const getDashboardPath = () => {
    switch (role) {
      case "admin":
        return "/dashboard/admin";
      case "faculty":
        return "/dashboard/faculty";
      case "student":
        return "/dashboard/student";
      case "parent":
        return "/dashboard/parent";
      default:
        return "/auth";
    }
  };

  return { 
    role, 
    loading: authLoading || loading, 
    getDashboardPath,
    isAdmin: role === "admin",
    isFaculty: role === "faculty",
    isStudent: role === "student",
    isParent: role === "parent"
  };
};
