import { PageHeading } from "@/components/admin/page-heading";
import { UserManager } from "@/components/admin/user-manager";

export default function UsersPage() {
  return (
    <>
      <PageHeading eyebrow="Access" title="Pilot users" description="Create individual staff accounts before assigning them to count sessions." />
      <UserManager />
    </>
  );
}
