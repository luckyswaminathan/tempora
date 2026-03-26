"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usersApi, type UserProfile } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { User as UserIcon, Wallet, Calendar, CreditCard } from "lucide-react";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { USER_PROFILE_STEPS } from "@/lib/tutorial-steps";
import { useSearchParams } from "next/navigation";

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const [displayNameInput, setDisplayNameInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [depositAmount, setDepositAmount] = useState("");
  const [addingFunds, setAddingFunds] = useState(false);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(false);
  const [savingEmailPrefs, setSavingEmailPrefs] = useState(false);

  const userProfileTutorial = useTutorial({
    steps: USER_PROFILE_STEPS,
    lessonKey: "user-profile",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const profileData = await usersApi.getProfile();
        setProfile(profileData);
        setDisplayNameInput(profileData.displayName || "");
        setEmailNotificationsEnabled(!!profileData.emailNotificationsEnabled);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load your profile",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  useEffect(() => {
    if (mounted && !loading && user) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "user-profile") {
        userProfileTutorial.start();
      }
    }
  }, [mounted, searchParams, loading, user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      setSavingProfile(true);
      // Use sync-profile endpoint to update display name
      await usersApi.syncProfile(displayNameInput);

      // Refresh profile data
      const updated = await usersApi.getProfile();
      setProfile(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddFunds = async () => {
    if (!user) return;
    const amount = Number.parseFloat(depositAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }

    try {
      setAddingFunds(true);
      const updated = await usersApi.addFunds(amount);
      setProfile(updated);
      toast.success(`Added $${amount.toFixed(2)} to your balance`);
      setDepositAmount("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add funds");
    } finally {
      setAddingFunds(false);
    }
  };

  const handleToggleEmailNotifications = async () => {
    if (!user) return;

    const nextEnabled = !emailNotificationsEnabled;
    try {
      setSavingEmailPrefs(true);
      const updated =
        await usersApi.updateEmailNotificationsPreference(nextEnabled);
      setProfile(updated);
      setEmailNotificationsEnabled(!!updated.emailNotificationsEnabled);
      toast.success(
        nextEnabled
          ? "Email notifications enabled"
          : "Email notifications disabled",
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update notification preference",
      );
    } finally {
      setSavingEmailPrefs(false);
    }
  };

  if (!mounted) {
    return null;
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-sm text-muted-foreground">
          Loading your profile...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-xl mx-auto text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <UserIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">
            Sign in to manage your account
          </h1>
          <p className="text-muted-foreground">
            Create an account or log in to update your profile and view account
            details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-5 space-y-4">
      <TutorialOverlay
        steps={USER_PROFILE_STEPS}
        currentStep={userProfileTutorial.currentStep}
        isActive={userProfileTutorial.isActive}
        elementRect={userProfileTutorial.elementRect}
        onNext={userProfileTutorial.next}
        onClose={userProfileTutorial.close}
      />

      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <UserIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            Profile & Account
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your account settings and view your profile information.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Card className="p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Profile Information</h2>
              <p className="text-xs text-muted-foreground">
                Update your public profile details.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email
            </Label>
            <Input id="profile-email" value={profile?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">
              Your email address cannot be changed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-xs">
              Role
            </Label>
            <Input
              id="profile-role"
              value={
                profile?.role
                  .replace("_", " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase()) ?? ""
              }
              disabled
            />
            <p className="text-xs text-muted-foreground">
              Your account role determines your permissions.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName" className="text-xs">
              Display Name
            </Label>
            <Input
              id="profile-display-name"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Your username"
            />
            <p className="text-xs text-muted-foreground">
              This is how you'll appear on the leaderboard and in public
              profiles.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Joined
            </span>
            <span>
              {profile?.joinedAt
                ? new Date(profile.joinedAt).toLocaleDateString()
                : "—"}
            </span>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            id="profile-save-button"
            size="sm"
          >
            {savingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </Card>

        <Card className="p-3.5 space-y-2.5" id="profile-account-statistics">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Account Statistics</h2>
              <p className="text-xs text-muted-foreground">
                View balance and manage funds.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
              <div>
                <div className="text-xs text-muted-foreground">
                  Wallet Balance
                </div>
                <div
                  className="text-xl font-semibold"
                  id="profile-wallet-balance"
                >
                  ${((profile?.wallet || 0) / 100.0).toFixed(2)}
                </div>
              </div>
              <Wallet className="w-7 h-7 text-muted-foreground" />
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center gap-1.5 mb-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Add Funds</p>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Instantly top up your balance (USD).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="amount" className="text-xs">
                  Amount to add (USD)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="250.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="sm:text-right">
                <Button
                  onClick={handleAddFunds}
                  disabled={addingFunds}
                  className="w-full sm:w-auto"
                  size="sm"
                >
                  {addingFunds ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-3.5 space-y-2.5" id="profile-security-section">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 text-muted-foreground">🔒</div>
          <div>
            <h2 className="text-lg font-semibold">Security</h2>
            <p className="text-xs text-muted-foreground">
              Manage your account security settings.
            </p>
          </div>
        </div>

        <div className="p-2 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            Password management and additional security features will be
            available soon. For now, your account is secured with the password
            you set during registration.
          </p>
        </div>
      </Card>

      <Card className="p-3.5 space-y-2.5" id="profile-notification-settings">
        <div>
          <h2 className="text-lg font-semibold">Notification Preferences</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose whether to receive an email for every notification event.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-2.5">
          <div>
            <p className="font-medium">Email notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Send an email whenever a new in-app notification is generated.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground min-w-12 text-right">
              {savingEmailPrefs
                ? "Saving..."
                : emailNotificationsEnabled
                  ? "On"
                  : "Off"}
            </span>
            <Switch
              checked={emailNotificationsEnabled}
              onCheckedChange={() => handleToggleEmailNotifications()}
              disabled={savingEmailPrefs}
              aria-label="Toggle email notifications"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
