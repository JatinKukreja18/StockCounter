import type { Metadata } from "next";
import { CountingScreen } from "@/components/counting-screen";

export const metadata: Metadata = { title: "Count stock" };

export default function CountPage() {
  return <CountingScreen />;
}
