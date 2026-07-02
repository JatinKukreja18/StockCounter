import { ImportStock } from "@/components/admin/import-stock";
import { PageHeading } from "@/components/admin/page-heading";
import { Card } from "@/components/ui/card";

export default function ImportPage() {
  return (
    <>
      <PageHeading eyebrow="Stock source" title="Import GoFrugal stock" description="Upload the latest stock export. We validate and preview the rows before replacing the active product cache." />
      <ImportStock />
      <Card className="mt-5 p-5 shadow-none">
        <h2 className="text-sm font-bold">GoFrugal Current Stock Detail</h2>
        <p className="mt-2 text-sm leading-6 text-[#68726c]">The importer understands GoFrugal&apos;s product-summary and batch-row layout. Item Code and EAN identify the product; each underlying row remains a separate countable batch with its own expiry, inward reference and Current Stock. Product totals are checked against the sum of their batches.</p>
      </Card>
    </>
  );
}
