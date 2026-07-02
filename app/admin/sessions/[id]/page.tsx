import { notFound } from "next/navigation";
import { PageHeading } from "@/components/admin/page-heading";
import { SessionDetail } from "@/components/admin/session-detail";
import { demoSessions } from "@/lib/demo-data";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = demoSessions.find((item) => item.id === id);
  if (!session) notFound();
  return (
    <>
      <PageHeading eyebrow="Session review" title={session.name} description="Review the additive count total, investigate variances, and close only when the team has finished syncing." />
      <SessionDetail session={session} />
    </>
  );
}
