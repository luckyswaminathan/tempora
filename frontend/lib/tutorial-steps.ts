import type { TutorialStep } from "@/components/tutorial-overlay";

export const PLATFORM_OVERVIEW_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "logo-tempora",
    title: "Welcome to Tempora",
    description:
      "This is your trading platform. You can click the logo to return to the main markets page at any time.",
  },
  {
    id: 2,
    elementId: "nav-markets",
    title: "Markets",
    description:
      "Browse and trade on various prediction markets. Track price movements and place your bets here.",
  },
  {
    id: 3,
    elementId: "nav-portfolio",
    title: "Your Portfolio",
    description:
      "View all your active trades, historical performance, and manage your positions.",
  },
  {
    id: 4,
    elementId: "nav-leaderboard",
    title: "Leaderboard",
    description:
      "See how you rank against other traders. Check top performers and compete on the rankings.",
  },
  {
    id: 5,
    elementId: "nav-tutorial",
    title: "Learning Resources",
    description:
      "Access tutorials and guides to improve your trading skills and knowledge.",
  },
];

export const UNDERSTANDING_PNL_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "pnl-cost-basis",
    title: "Cost Basis",
    description:
      "This is the total amount you paid to acquire your positions. It's the sum of all your initial investments in the current holdings.",
  },
  {
    id: 2,
    elementId: "pnl-market-value",
    title: "Market Value",
    description:
      "The current value of all your positions at today's market prices. This changes throughout the day as market prices move.",
  },
  {
    id: 3,
    elementId: "pnl-unrealized",
    title: "Profit & Loss (P&L)",
    description:
      "The difference between your market value and cost basis. Green means you're making money, red means you're losing money. This is unrealized - it's the profit/loss if you close all positions now.",
  },
  {
    id: 4,
    elementId: "pnl-roi",
    title: "Return on Investment (ROI)",
    description:
      "Your P&L expressed as a percentage of your initial investment. This shows your return efficiency. For example, 10% ROI means you've made 10% profit on your initial investment.",
  },
];

export const ACCOUNT_SETUP_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "auth-display-name",
    title: "Create Your Account",
    description:
      "Start by entering a display name (optional). This is how other traders will see you on the leaderboard. You can always change it later.",
  },
  {
    id: 2,
    elementId: "auth-email",
    title: "Enter Your Email",
    description:
      "Use a valid email address to create your account. This will be used for login and account recovery. Make sure it's an email you have access to.",
  },
  {
    id: 3,
    elementId: "auth-password",
    title: "Set a Secure Password",
    description:
      "Choose a strong password with at least 6 characters. This protects your account and trading balance. Remember to keep it secure!",
  },
  {
    id: 4,
    elementId: "auth-submit",
    title: "Complete Registration",
    description:
      "Click 'Create Account' to finish setting up your account. You'll automatically be signed in and ready to start trading!",
  },
];

export const USER_PROFILE_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "profile-email",
    title: "Verify Your Email",
    description:
      "Your email address is shown here for verification. This is the email you used to create your account and is used for login. It cannot be changed.",
  },
  {
    id: 2,
    elementId: "profile-display-name",
    title: "Update Your Display Name",
    description:
      "Set or update your display name here. This is how you'll appear on the leaderboard and in public profiles. It's optional but helps personalize your account.",
  },
  {
    id: 3,
    elementId: "profile-save-button",
    title: "Save Your Changes",
    description:
      "Click 'Save Profile' to update your display name. Changes are saved immediately and will be reflected across the platform.",
  },
  {
    id: 4,
    elementId: "profile-wallet-balance",
    title: "Your Trading Balance",
    description:
      "This is your available cash balance. You start with $1,000.00 to begin trading. Use this balance to place trades on prediction markets.",
  },
  {
    id: 5,
    elementId: "profile-add-funds",
    title: "Add Trading Funds",
    description:
      "Add funds to your account to start trading. Enter the amount you want to deposit (in USD) and click 'Add Funds'. Your balance updates immediately and you can start placing trades right away.",
  },
  {
    id: 6,
    elementId: "profile-security-section",
    title: "Account Security",
    description:
      "Your account security settings are managed here. Password management features will be available soon. For now, your account is secured with the password you set during registration.",
  },
];

export const UNDERSTANDING_DASHBOARD_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "dashboard-title",
    title: "Welcome to the Markets Dashboard",
    description:
      "This is your main trading hub. Here you can browse all available prediction markets, search for specific topics, and filter by category or status.",
  },
  {
    id: 2,
    elementId: "dashboard-search",
    title: "Search Markets",
    description:
      "Use the search bar to find markets by question or category. Type keywords to quickly locate markets you're interested in trading.",
  },
  {
    id: 3,
    elementId: "dashboard-status-filters",
    title: "Filter by Status",
    description:
      "Filter markets by their status: Open (actively trading), Closed (no longer accepting trades), Resolved (outcome determined), or view All markets regardless of status.",
  },
  {
    id: 4,
    elementId: "dashboard-category-filters",
    title: "Filter by Category",
    description:
      "Browse markets by category like Economics, Politics, Technology, Sports, Climate, or General. Click 'All' to see every market.",
  },
  {
    id: 5,
    elementId: "dashboard-market-card",
    title: "Market Cards",
    description:
      "Each card shows a prediction market with its question, outcomes, probabilities, and trading options. Click on outcomes to place trades, or use the Individual/Interval modes for different trading strategies.",
  },
];
