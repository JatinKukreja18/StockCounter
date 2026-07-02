import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "green" | "amber" | "red" }) {
  const tones = {
    neutral: "bg-[#edf1ee] text-[#526059]",
    green: "bg-[#e9f6ef] text-[#12673f]",
    amber: "bg-[#fff1ca] text-[#874300]",
    red: "bg-[#fff0ee] text-[#a01c12]"
  };
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)} {...props} />;
}
