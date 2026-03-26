"use client";

import { useState, useEffect } from "react";
import { MarketGrid } from "@/components/market-grid";
import { MarketFilters } from "@/components/market-filters";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { UNDERSTANDING_DASHBOARD_STEPS } from "@/lib/tutorial-steps";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [category, setCategory] = useState<string | null>(
    () => searchParams?.get("category") ?? null,
  );
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams?.get("q") ?? "",
  );
  const [status, setStatus] = useState<string | null>(
    () => searchParams?.get("status") ?? null,
  );
  const [mounted, setMounted] = useState(false);

  const dashboardTutorial = useTutorial({
    steps: UNDERSTANDING_DASHBOARD_STEPS,
    lessonKey: "understanding-dashboard",
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

  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }

    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) {
      params.set("q", trimmedSearch);
    } else {
      params.delete("q");
    }

    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams?.toString() ?? "";
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, {
        scroll: false,
      });
    }
  }, [category, searchQuery, status, mounted, pathname, router, searchParams]);

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
