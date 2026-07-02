import { PageHeading } from "@/components/admin/page-heading";
import { IssuesQueue } from "@/components/admin/issues-queue";

export default function IssuesPage() {
  return (
    <>
      <PageHeading eyebrow="Admin review" title="Sync issues" description="Resolve entries the server could not route safely. Ordinary repeated counts never appear here." />
      <IssuesQueue />
    </>
  );
}
