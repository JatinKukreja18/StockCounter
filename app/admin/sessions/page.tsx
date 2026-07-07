import type { ComponentProps } from "react";
import { PageHeading } from "@/components/admin/page-heading";
import { SessionManager } from "@/components/admin/session-manager";

const PAGE_HEADING = {
  eyebrow: "Count setup",
  title: "Count sessions",
  description:
    "Split the store into concurrent sessions. Staff entries remain additive even when people count the same product or area."
} satisfies ComponentProps<typeof PageHeading>;

export default function SessionsPage() {
  return (
    <>
      <PageHeading {...PAGE_HEADING} />
      <SessionManager />
    </>
  );
}
