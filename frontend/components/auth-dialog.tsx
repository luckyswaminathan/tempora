"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { ACCOUNT_SETUP_STEPS } from "@/lib/tutorial-steps";
import { useSearchParams } from "next/navigation";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "login" | "register";
}

export function AuthDialog({
  open,
  onOpenChange,
  defaultMode = "login",
}: AuthDialogProps) {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const accountSetupTutorial = useTutorial({
    steps: ACCOUNT_SETUP_STEPS,
  });

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError(null);
    }
  }, [open, defaultMode]);

  useEffect(() => {
    if (open && mode === "register") {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "account-setup") {
        // Small delay to ensure dialog is rendered
        setTimeout(() => {
          accountSetupTutorial.start();
        }, 100);
      }
    }
  }, [open, mode, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await signIn(email, password);
        onOpenChange(false);
        setEmail("");
        setPassword("");
      } else {
        await signUp(email, password, displayName || undefined);
        // If signUp succeeds without throwing, user is logged in
        onOpenChange(false);
        setEmail("");
        setPassword("");
        setDisplayName("");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TutorialOverlay
        steps={ACCOUNT_SETUP_STEPS}
        currentStep={accountSetupTutorial.currentStep}
        isActive={accountSetupTutorial.isActive && mode === "register"}
        elementRect={accountSetupTutorial.elementRect}
        onNext={accountSetupTutorial.next}
        onClose={accountSetupTutorial.close}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? "Sign In" : "Create Account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Sign in to your account to continue"
              : "Create a new account to get started"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="auth-display-name"
                type="text"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              id="auth-submit"
            >
              {loading
                ? "Loading..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="w-full"
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
