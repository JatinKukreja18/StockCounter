import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const [
      { data: sessions, error: sessionsError },
      { data: progress, error: progressError },
      { count: issueCount, error: issuesError },
      { count: staffCount, error: staffError },
      { data: recent, error: recentError }
    ] = await Promise.all([
      supabase
        .from("sessions")
        .select("id,name,status,created_at,session_assignments(users(full_name))")
        .eq("status", "open")
        .order("created_at", { ascending: false }),
      supabase.from("session_product_progress").select("session_id,product_id,count_status"),
      supabase.from("sync_issues").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "staff"),
      supabase
        .from("count_entries")
        .select("id,quantity,area,synced_at,is_voided,products(name),users(full_name)")
        .eq("is_voided", false)
        .order("synced_at", { ascending: false })
        .limit(8)
    ]);
    if (sessionsError) throw sessionsError;
    if (progressError) throw progressError;
    if (issuesError) throw issuesError;
    if (staffError) throw staffError;
    if (recentError) throw recentError;

    const openIds = new Set((sessions ?? []).map((session) => session.id));
    const openProgress = (progress ?? []).filter((row) => openIds.has(row.session_id));
    const completedProducts = openProgress.filter((row) => row.count_status === "counted").length;
    const totalProducts = openProgress.length;
    const sessionProgress = (sessions ?? []).map((session) => {
      const rows = openProgress.filter((row) => row.session_id === session.id);
      const completed = rows.filter((row) => row.count_status === "counted").length;
      const source = session as unknown as {
        id: string; name: string; created_at: string;
        session_assignments: Array<{ users: { full_name: string } | null }>;
      };
      return {
        id: source.id,
        name: source.name,
        completedProducts: completed,
        totalProducts: rows.length,
        percent: rows.length ? Math.round((completed / rows.length) * 100) : 0,
        assignees: source.session_assignments.map((assignment) => assignment.users?.full_name).filter(Boolean)
      };
    });

    return NextResponse.json({
      stats: {
        completedProducts,
        totalProducts,
        overallPercent: totalProducts ? Math.round((completedProducts / totalProducts) * 100) : 0,
        openSessions: sessions?.length ?? 0,
        staffUsers: staffCount ?? 0,
        openIssues: issueCount ?? 0
      },
      sessions: sessionProgress,
      recent: (recent ?? []).map((row) => {
        const source = row as unknown as {
          id: string; quantity: number | string; area: string | null; synced_at: string;
          products: { name: string } | null; users: { full_name: string } | null;
        };
        return {
          id: source.id,
          quantity: Number(source.quantity),
          area: source.area,
          syncedAt: source.synced_at,
          productName: source.products?.name ?? "Unknown product",
          userName: source.users?.full_name ?? "Staff"
        };
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard failed";
    return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 500 });
  }
}
