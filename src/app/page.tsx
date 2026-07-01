"use client";

import dynamic from "next/dynamic";

// Render the app client-side only — it relies on localStorage + geolocation + socket.
const YukTaxiApp = dynamic(
  () => import("@/components/app/YukTaxiApp").then((m) => m.YukTaxiApp),
  { ssr: false, loading: () => <AppLoader /> }
);

function AppLoader() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-b from-primary to-amber-800">
      <div className="flex flex-col items-center gap-3 text-white">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        <span className="text-[15px] font-medium">YukTaxi yuklanmoqda...</span>
      </div>
    </div>
  );
}

export default function Home() {
  return <YukTaxiApp />;
}