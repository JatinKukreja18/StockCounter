import { PageHeading } from "@/components/admin/page-heading";
import { SessionManager } from "@/components/admin/session-manager";

export default function SessionsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Count setup"
        title="Count sessions"
        description="Split the store into concurrent sessions. Staff entries remain additive even when people count the same product or area."
      />
      <SessionManager />
    </>
  );
}
