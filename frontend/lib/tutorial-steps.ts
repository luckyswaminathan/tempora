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
