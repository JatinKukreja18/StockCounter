import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green"
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "green" | "amber" | "neutral";
}) {
  const tones = {
    green: "bg-[#e9f6ef] text-[#18794e]",
    amber: "bg-[#fff6df] text-[#b45309]",
    neutral: "bg-[#eef1ef] text-[#56615b]"
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.08em] text-[#7a847e]">
            {label}
          </p>
          <p className="tabular mt-2 text-3xl font-black tracking-tight">
            {value}
          </p>
          <p className="mt-1 text-xs text-[#7a847e]">{detail}</p>
        </div>
        <span
          className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={19} />
        </span>
      </div>
    </Card>
  );
}
