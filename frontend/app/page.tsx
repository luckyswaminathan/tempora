"use client";

import { useState, useEffect } from "react";
import { MarketGrid } from "@/components/market-grid";
import { MarketFilters } from "@/components/market-filters";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { UNDERSTANDING_DASHBOARD_STEPS } from "@/lib/tutorial-steps";
import { useSearchParams } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const dashboardTutorial = useTutorial({
    steps: UNDERSTANDING_DASHBOARD_STEPS,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "understanding-dashboard") {
        dashboardTutorial.start();
      }
    }
  }, [mounted, searchParams]);

  if (!mounted) {
    return null;
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <TutorialOverlay
        steps={UNDERSTANDING_DASHBOARD_STEPS}
        currentStep={dashboardTutorial.currentStep}
        isActive={dashboardTutorial.isActive}
        elementRect={dashboardTutorial.elementRect}
        onNext={dashboardTutorial.next}
        onClose={dashboardTutorial.close}
      />

      <div className="mb-8" id="dashboard-title">
        <h1 className="text-4xl font-bold mb-2 text-balance">
          Prediction Markets
        </h1>
        <p className="text-muted-foreground text-lg">
          Bet on future outcomes and earn from accurate predictions
        </p>
      </div>
      <MarketFilters
        category={category}
        onCategoryChange={setCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        status={status}
        onStatusChange={setStatus}
      />
      <MarketGrid
        category={category}
        searchQuery={searchQuery}
        status={status}
      />
    </main>
  );
}
