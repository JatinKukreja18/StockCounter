import { AlertCircle } from "lucide-react";

export function ErrorAlert({
  message,
  className = ""
}: {
  message: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={`flex gap-2 rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#9e251b] ${className}`}
    >
      <AlertCircle size={17} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
