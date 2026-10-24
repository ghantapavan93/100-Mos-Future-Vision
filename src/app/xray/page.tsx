import type { Metadata } from "next";
import { Suspense } from "react";
import { XRay } from "@/components/xray/XRay";

export const metadata: Metadata = { title: "How miles count — 100 Miles of Summer" };

export default function Page() {
  // useSearchParams (?r=<receipt>) needs a Suspense boundary in Next 16.
  return (
    <Suspense fallback={null}>
      <XRay />
    </Suspense>
  );
}
