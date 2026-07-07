import Link from "next/link";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div>
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-[#fff6df] text-[#b45309]">
          <CloudOff size={30} />
        </span>
        <h1 className="text-2xl font-black">You&apos;re offline</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#68726c]">
          The counting screen and saved entries still work. Admin pages need a
          connection if they have not been opened before.
        </p>
        <Link href="/count">
          <Button className="mt-5">
            <RefreshCw size={17} /> Return to counting
          </Button>
        </Link>
      </div>
    </div>
  );
}
