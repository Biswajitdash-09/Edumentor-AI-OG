import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, User, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  type: "course" | "student" | "assignment";
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

export function QuickSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const searchTimeout = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [query]);

  const performSearch = async () => {
    if (!user) return;

    setLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search courses
      const { data: courses } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("faculty_id", user.id)
        .or(`title.ilike.%${query}%,code.ilike.%${query}%`)
        .limit(3);

      courses?.forEach((course) => {
        searchResults.push({
          type: "course",
          id: course.id,
          title: `${course.code} - ${course.title}`,
          subtitle: "Course",
          link: `/courses/${course.id}`,
        });
      });

      // Get faculty courses for student search
      const { data: facultyCourses } = await supabase
        .from("courses")
        .select("id")
        .eq("faculty_id", user.id);

      const courseIds = facultyCourses?.map((c) => c.id) || [];

      if (courseIds.length > 0) {
        // Search enrolled students
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select(`
            student_id,
            course_id,
            profiles!student_id(full_name, email)
          `)
          .in("course_id", courseIds)
          .eq("status", "active");

        const seenStudents = new Set<string>();
        enrollments?.forEach((enrollment: any) => {
          const name = enrollment.profiles?.full_name || "";
          const email = enrollment.profiles?.email || "";
          
          if (
            !seenStudents.has(enrollment.student_id) &&
            (name.toLowerCase().includes(query.toLowerCase()) ||
              email.toLowerCase().includes(query.toLowerCase()))
          ) {
            seenStudents.add(enrollment.student_id);
            searchResults.push({
              type: "student",
              id: enrollment.student_id,
              title: name,
              subtitle: email,
              link: `/courses/${enrollment.course_id}/students/${enrollment.student_id}`,
            });
          }
        });

        // Search assignments
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id, title, course_id, courses(code)")
          .in("course_id", courseIds)
          .ilike("title", `%${query}%`)
          .limit(3);

        assignments?.forEach((assignment: any) => {
          searchResults.push({
            type: "assignment",
            id: assignment.id,
            title: assignment.title,
            subtitle: `${assignment.courses?.code} - Assignment`,
            link: `/assignments/${assignment.id}/grade`,
          });
        });
      }

      setResults(searchResults.slice(0, 8));
    } catch (error) {
      console.error("Search error:", error);
      toast({
        title: "Search Failed",
        description: "Unable to search at this time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.link);
    setQuery("");
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "course":
        return <BookOpen className="h-4 w-4" />;
      case "student":
        return <User className="h-4 w-4" />;
      case "assignment":
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search courses, students, assignments..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-[300px] overflow-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <ul className="py-1">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    onClick={() => handleSelect(result)}
                    className={cn(
                      "w-full px-4 py-2 text-left flex items-center gap-3",
                      "hover:bg-accent transition-colors"
                    )}
                  >
                    <span className="text-muted-foreground">
                      {getIcon(result.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No results found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}