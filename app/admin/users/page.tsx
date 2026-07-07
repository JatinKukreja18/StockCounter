import type { ComponentProps } from "react";
import { PageHeading } from "@/components/admin/page-heading";
import { UserManager } from "@/components/admin/user-manager";

const PAGE_HEADING = {
  eyebrow: "Access",
  title: "Users",
  description:
    "Create individual staff accounts before assigning them to count sessions."
} satisfies ComponentProps<typeof PageHeading>;

export default function UsersPage() {
  return (
    <>
      <PageHeading {...PAGE_HEADING} />
      <UserManager />
    </>
  );
}
