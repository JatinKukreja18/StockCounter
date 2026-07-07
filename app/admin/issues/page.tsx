import type { ComponentProps } from "react";
import { PageHeading } from "@/components/admin/page-heading";
import { IssuesQueue } from "@/components/admin/issues-queue";

const PAGE_HEADING = {
  eyebrow: "Admin review",
  title: "Sync issues",
  description:
    "Resolve entries the server could not route safely. Ordinary repeated counts never appear here."
} satisfies ComponentProps<typeof PageHeading>;

export default function IssuesPage() {
  return (
    <>
      <PageHeading {...PAGE_HEADING} />
      <IssuesQueue />
    </>
  );
}
