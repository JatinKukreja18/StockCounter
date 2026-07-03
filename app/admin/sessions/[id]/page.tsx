import { PageHeading } from "@/components/admin/page-heading";
import { SessionDetail } from "@/components/admin/session-detail";
import { demoSessions } from "@/lib/demo-data";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = demoSessions.find((item) => item.id === id) ?? {
    id, name: "Session review", status: "open" as const, category: "", store: "", stockImportId: "",
    masterFileName: "", productIds: [], assignees: [], createdAt: new Date().toISOString()
  };
  return (
    <>
      <PageHeading eyebrow="Session review" title={session.name} description="Review the additive count total, investigate variances, and close only when the team has finished syncing." />
      <SessionDetail session={session} />
    </>
  );
}
