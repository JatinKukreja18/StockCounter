import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18794e]/40",
  {
    variants: {
      variant: {
        primary: "bg-[#18794e] text-white hover:bg-[#0f5e3b] shadow-sm",
        secondary: "border border-[#dfe5e1] bg-white text-[#18211d] hover:bg-[#f5f7f5]",
        ghost: "text-[#56615b] hover:bg-[#edf1ee]",
        danger: "bg-[#b42318] text-white hover:bg-[#8f1c13]",
        amber: "bg-[#fff1ca] text-[#874300] hover:bg-[#ffe7a4]"
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-14 px-6 text-base",
        icon: "size-11"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
