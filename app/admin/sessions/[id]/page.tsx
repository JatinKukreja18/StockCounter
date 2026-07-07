import { SessionDetail } from "@/components/admin/session-detail";

export default async function SessionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = {
    id,
    name: "Session review",
    status: "open" as const,
    category: "",
    store: "",
    stockImportId: "",
    masterFileName: "",
    productIds: [],
    assignees: [],
    createdAt: new Date().toISOString()
  };
  return <SessionDetail session={session} />;
}
