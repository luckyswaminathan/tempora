"use client";

import { useAuth } from "@/contexts/auth-context";
import { MarketCreateForm } from "@/components/market-create-form";

export default function CreatePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Please sign in to access admin panel
          </p>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            You don't have permission to access this page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create a New Market</h1>
        <p className="text-muted-foreground mt-1">
          Set up a new prediction market
        </p>
      </div>

      <MarketCreateForm />
    </div>
  );
}
