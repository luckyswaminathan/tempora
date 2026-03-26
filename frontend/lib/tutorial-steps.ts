import type { TutorialStep } from "@/components/tutorial-overlay";

export const WELCOME_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "dashboard-title",
    title: "Welcome to Tempora!",
    description:
      "You've just created your account with $1,000 in play money. This is the Markets Dashboard — your starting point for browsing and trading on prediction markets.",
  },
  {
    id: 2,
    elementId: "dashboard-market-card",
    title: "Browse Prediction Markets",
    description:
      "Each card represents a prediction market with a question, outcomes, and live probabilities. Click on any market to learn more or place a trade.",
  },
  {
    id: 3,
    elementId: "nav-portfolio",
    title: "Track Your Portfolio",
    description:
      "After you place trades, visit your Portfolio to see your positions, profit & loss, and order history.",
  },
  {
    id: 4,
    elementId: "nav-leaderboard",
    title: "Compete on the Leaderboard",
    description:
      "See how you stack up against other traders. Make smart predictions to climb the rankings!",
  },
  {
    id: 5,
    elementId: "nav-tutorial",
    title: "Learn More Anytime",
    description:
      "Visit the Tutorial section for guided walkthroughs on trading, portfolio management, and more. Ready to explore? Click on a market to get started!",
  },
];

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
    elementId: "portfolio-summary",
    title: "Your Wallet & Balance",
    description:
      "Your spendable balance is your wallet total minus any collateral locked in open orders or short positions. This is how much you can use for new trades right now.",
  },
  {
    id: 2,
    elementId: "portfolio-tabs",
    title: "Portfolio Tabs",
    description:
      "This page is split into tabs so you can inspect P&L from different angles: Open Positions, Collateral, Settled Positions, and Order History.",
  },
  {
    id: 3,
    elementId: "portfolio-tab-collateral",
    title: "Open Collateral",
    description:
      "Click the Collateral tab to continue. This shows funds locked by open orders and short exposure, which directly affects how much capital is available for new trades.",
  },
  {
    id: 4,
    elementId: "portfolio-collateral-panel",
    title: "Collateral And Spendable Cash",
    description:
      "Collateral is locked cash. Even with positive unrealized P&L, your spendable balance can stay tight if collateral is tied up in pending orders or shorts.",
  },
  {
    id: 5,
    elementId: "portfolio-tab-history",
    title: "Open Order History",
    description:
      "Click the Order History tab to continue. You need fill status and execution prices to understand when P&L becomes realized.",
  },
  {
    id: 6,
    elementId: "portfolio-history-panel",
    title: "Realized Vs Unrealized P&L",
    description:
      "Filled trades and settlements determine realized P&L. Open positions remain unrealized and move with market prices. Use this tab to reconcile both.",
  },
  {
    id: 7,
    elementId: "portfolio-tab-holdings",
    title: "Return To Open Positions",
    description:
      "Click Open Positions to continue. This is where cost basis, mark value, and unrealized P&L are shown per outcome.",
  },
  {
    id: 8,
    elementId: "portfolio-holdings-panel",
    title: "Per-Position P&L",
    description:
      "Each row shows quantity, average entry price, mark price, and unrealized P&L. P&L is mark value minus cost basis for that position.",
  },
  {
    id: 9,
    elementId: "portfolio-title",
    title: "P&L And ROI Recap",
    description:
      "Portfolio P&L is aggregate market value minus total cost basis. ROI is P&L divided by cost basis. Use tabs together to monitor risk, liquidity, and performance.",
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

export const FIRST_TRADE_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "market-detail-question",
    title: "The Market Question",
    description:
      "Each market poses a question about a future outcome. Traders buy shares in the outcomes they think are most likely. If you're right, each share pays $1.",
  },
  {
    id: 2,
    elementId: "market-detail-stats",
    title: "Market Activity",
    description:
      "Volume shows total dollars traded. Shares outstanding shows how many shares are in circulation. Higher activity typically means more reliable pricing.",
  },
  {
    id: 3,
    elementId: "market-security-picker",
    title: "Pick an Outcome",
    description:
      "Each bar represents a possible outcome with its current probability. The probability reflects the market's collective belief. Click any outcome to open the trade dialog.",
  },
  {
    id: 4,
    elementId: "market-detail-tabs",
    title: "After You Trade",
    description:
      "Once you've placed a trade, check 'My Position' to see your holdings and P&L. 'My History' shows all your orders. You can also discuss the market in Comments.",
  },
  {
    id: 5,
    elementId: "market-security-picker",
    title: "Ready to Trade!",
    description:
      "Click on any outcome bar to open the trade dialog. Enter a positive number to buy (long) or negative to sell (short). Each share pays $1 if the outcome occurs, $0 otherwise.",
  },
];

export const MARKET_LIMIT_ORDERS_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "market-security-picker",
    title: "Two Ways to Trade",
    description:
      "When you click an outcome, the trade dialog opens with two order types: Market and Limit. Each has different advantages depending on your strategy.",
  },
  {
    id: 2,
    elementId: "market-detail-stats",
    title: "Market Orders",
    description:
      "Market orders execute instantly at the current LMSR price. The price is calculated by the automated market maker based on demand. Best when you want immediate execution.",
  },
  {
    id: 3,
    elementId: "market-detail-question",
    title: "Limit Orders",
    description:
      "Limit orders let you set a maximum total price. Your order waits in a queue and fills when the market price reaches your limit. Set expiration to 1h, 6h, 24h, or no expiration.",
  },
  {
    id: 4,
    elementId: "market-security-picker",
    title: "Try It Out",
    description:
      "Click an outcome, then toggle between 'Market Order' and 'Limit Order' tabs in the trade dialog. Market orders show the live price; limit orders let you enter your own maximum price.",
  },
];

export const PRICES_PROBABILITIES_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "market-detail-question",
    title: "How Prices Work",
    description:
      "Tempora uses an LMSR (Logarithmic Market Scoring Rule) automated market maker. Prices move automatically based on trading — buying pushes prices up, selling pushes them down.",
  },
  {
    id: 2,
    elementId: "market-security-picker",
    title: "Reading Probabilities",
    description:
      "Each outcome's price corresponds to its implied probability. A price of 60¢ means the market estimates a 60% chance of that outcome. All probabilities always sum to 100%.",
  },
  {
    id: 3,
    elementId: "market-detail-stats",
    title: "Volume & Open Interest",
    description:
      "Volume tracks total dollar value traded. Open interest shows outstanding shares. Higher numbers mean more market participation and typically more accurate pricing.",
  },
  {
    id: 4,
    elementId: "market-security-picker",
    title: "Profit Potential",
    description:
      "Buy at 30¢ and if the outcome wins, you receive $1 per share — a 70¢ profit. If it loses, you lose your 30¢. Lower probability outcomes offer higher returns but are riskier.",
  },
];

export const MANAGING_ORDERS_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "portfolio-title",
    title: "Your Order History",
    description:
      "The Order History tab shows every order you've placed — filled, open, cancelled, and expired. It's your complete trading record.",
  },
  {
    id: 2,
    elementId: "portfolio-tabs",
    title: "Filter Orders",
    description:
      "Use the order state filter (All, Open, Filled, Cancelled) to quickly find what you need. Click any order to see its full details.",
  },
  {
    id: 3,
    elementId: "portfolio-summary",
    title: "Open Orders & Collateral",
    description:
      "Open limit orders lock collateral from your spendable balance. This ensures funds are available when the order fills. See locked amounts in the Collateral tab.",
  },
  {
    id: 4,
    elementId: "portfolio-tabs",
    title: "Cancelling Orders",
    description:
      "Click any open order to view details and cancel it. Cancelling returns locked collateral to your spendable balance immediately.",
  },
];

export const HOLDINGS_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "portfolio-title",
    title: "Your Open Positions",
    description:
      "The Open Positions tab shows all active positions across markets. Each shows the outcome, quantity, average price, current value, and unrealized P&L.",
  },
  {
    id: 2,
    elementId: "portfolio-summary",
    title: "Portfolio Summary",
    description:
      "Spendable balance, wallet total, and locked collateral are shown at the top. Spendable balance = wallet minus collateral locked in short positions and limit orders.",
  },
  {
    id: 3,
    elementId: "portfolio-tabs",
    title: "Positions by Market",
    description:
      "Holdings are grouped by market. Each group shows the question, resolution date, and your positions within it. Click any position for detailed trade history.",
  },
  {
    id: 4,
    elementId: "portfolio-summary",
    title: "Performance Analytics",
    description:
      "Once you place your first trade, a Performance Analytics section appears above the tabs with portfolio-wide stats: cost basis, market value, P&L, ROI, and category breakdowns.",
  },
];

export const COLLATERAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "portfolio-title",
    title: "Understanding Collateral",
    description:
      "Collateral is the portion of your wallet locked to guarantee obligations. It covers short positions, open limit orders, and market maker liquidity commitments.",
  },
  {
    id: 2,
    elementId: "portfolio-summary",
    title: "Locked vs Spendable",
    description:
      "Wallet balance minus locked collateral equals spendable balance. Locked collateral cannot be used for new trades until positions are closed or orders cancelled.",
  },
  {
    id: 3,
    elementId: "portfolio-tabs",
    title: "Collateral Breakdown",
    description:
      "The Collateral tab shows a detailed breakdown: short position collateral, limit order reserves, and market maker obligations. Each category explains why funds are locked.",
  },
  {
    id: 4,
    elementId: "portfolio-tabs",
    title: "Freeing Collateral",
    description:
      "Cancel open limit orders to free their collateral. Close short positions by buying back shares. Collateral from settled markets is automatically returned.",
  },
];

export const SETTLED_POSITIONS_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "portfolio-title",
    title: "Settled Positions",
    description:
      "When a market is resolved, winning positions pay $1 per share and losing positions expire worthless. The Settled Positions tab shows all your resolved results.",
  },
  {
    id: 2,
    elementId: "portfolio-tabs",
    title: "Resolution Results",
    description:
      "Each settled position shows: the winning outcome, your cost basis, your payout, and P&L (payout minus cost). Positions are grouped by market.",
  },
  {
    id: 3,
    elementId: "portfolio-summary",
    title: "Wallet Impact",
    description:
      "Payouts from winning positions are automatically credited to your wallet. Use the funds for new trades right away.",
  },
  {
    id: 4,
    elementId: "portfolio-summary",
    title: "Track Your Performance",
    description:
      "Payouts from settlements are reflected in your wallet balance. Once you have active positions, the Performance Analytics section above the tabs tracks your overall ROI and realized gains.",
  },
];

export const COMMENTS_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "market-detail-question",
    title: "Market Discussion",
    description:
      "Every market has a comments section where traders share analysis, debate outcomes, and exchange ideas. A great way to gather insights before trading.",
  },
  {
    id: 2,
    elementId: "market-detail-tabs",
    title: "Comments Tab",
    description:
      "Comments is the default tab on every market page. Sort by 'Most Reactions' or 'Most Recent' to find the most valuable discussions.",
  },
  {
    id: 3,
    elementId: "market-detail-tabs",
    title: "Threaded Replies & Reactions",
    description:
      "Reply to any comment to start a thread. React with 👍 Like, ❤️ Love, 📈 Bullish, 📉 Bearish, or 😂 Laugh to surface valuable contributions.",
  },
];

export const LEADERBOARD_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "leaderboard-title",
    title: "Top Traders",
    description:
      "The leaderboard ranks traders by wallet balance. Starting with $1,000, your balance grows from profitable trades and market settlements.",
  },
  {
    id: 2,
    elementId: "leaderboard-list",
    title: "Rankings",
    description:
      "Each row shows rank, display name, role (User, Market Maker, or Admin), and current wallet balance. The top 10 traders are displayed.",
  },
  {
    id: 3,
    elementId: "leaderboard-title",
    title: "Climbing the Ranks",
    description:
      "Make accurate predictions and manage risk to grow your balance. Focus on markets where you have insight or expertise for the best results.",
  },
];

export const NOTIFICATIONS_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "notifications-title",
    title: "Stay Informed",
    description:
      "Notifications alert you to important events: limit orders being filled, markets being settled, and position payouts. Never miss a trading opportunity.",
  },
  {
    id: 2,
    elementId: "notifications-tabs",
    title: "Unread & Read",
    description:
      "Switch between Unread and Read tabs. Each notification shows the event type, details, timestamp, and a link to the relevant market.",
  },
  {
    id: 3,
    elementId: "notifications-mark-all",
    title: "Quick Actions",
    description:
      "Mark individual notifications as read, or use 'Mark all read' to clear everything. Enable email notifications from your Profile settings for alerts outside the app.",
  },
];

export const MARKET_MAKING_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "market-making-title",
    title: "Market Making",
    description:
      "Market makers create and fund prediction markets. You provide initial liquidity so traders can buy and sell shares from the start.",
  },
  {
    id: 2,
    elementId: "market-making-tabs",
    title: "Dashboard & Proposals",
    description:
      "The Dashboard shows your active markets with revenue, P&L, and performance. The Proposals tab tracks submissions and their approval status.",
  },
  {
    id: 3,
    elementId: "market-making-tabs",
    title: "Creating Markets",
    description:
      "Use the Create tab to propose new markets. Define the question, outcomes, category, resolution date, and liquidity parameter. Higher liquidity means less price impact but requires more capital.",
  },
  {
    id: 4,
    elementId: "market-making-title",
    title: "The Approval Process",
    description:
      "Submit a proposal, then an admin reviews it. Once approved, publish it — this locks your collateral and makes the market live for trading.",
  },
];
