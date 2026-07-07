import { X } from "lucide-react";
import { Card } from "@/components/ui/card";

export function SheetModal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-md"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-[#172019]/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-5">
      <Card className={`max-h-[90dvh] w-full ${maxWidth} overflow-auto rounded-b-none p-6 sm:rounded-2xl`}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            {description && <p className="mt-1 text-sm text-[#68726c]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef1ef]"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
