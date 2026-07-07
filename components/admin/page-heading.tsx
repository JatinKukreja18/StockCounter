import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-black uppercase tracking-[.14em] text-[#18794e]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#68726c]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
