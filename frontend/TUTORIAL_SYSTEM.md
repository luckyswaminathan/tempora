# Tutorial System

This document describes the current interactive tutorial architecture used across the frontend.

## Overview

The tutorial system is built from three pieces:

1. Step definitions in [lib/tutorial-steps.ts](lib/tutorial-steps.ts)
2. State and persistence logic in [hooks/useTutorial.ts](hooks/useTutorial.ts)
3. UI overlay in [components/tutorial-overlay.tsx](components/tutorial-overlay.tsx)

Pages opt into tutorials by:

1. Creating a tutorial instance with useTutorial
2. Rendering TutorialOverlay
3. Starting the tutorial from query params or user action

## Data Model

Tutorial steps use this shape:

```ts
type TutorialStep = {
  id: number;
  elementId: string;
  title: string;
  description: string;
};
```

The elementId must match an element rendered on the page.

## useTutorial Hook

Defined in [hooks/useTutorial.ts](hooks/useTutorial.ts).

### Options

- steps: TutorialStep[] (required)
- lessonKey: string (required, used for completion tracking)
- autoStart?: boolean (default false)
- onComplete?: () => void

### Return Value

- isActive: boolean
- currentStep: number
- elementRect: DOMRect | null
- isCompleted: boolean
- start(): void
- next(): Promise<void>
- close(): void
- goToStep(step: number): void

### Runtime Behavior

- Tracks the active element by id and updates highlight bounds on resize/scroll.
- Auto-scrolls each target into view with sticky-header-aware offset logic.
- On final step, next() marks completion and invokes onComplete.

### Completion Persistence

- Authenticated users: completion is saved to backend via usersApi.updateTutorialCompletion.
- Unauthenticated users: completion is saved in localStorage under tempora_tutorial_completions.
- Local completions can be migrated after sign-in via migrateLocalCompletions.

## TutorialOverlay Component

Defined in [components/tutorial-overlay.tsx](components/tutorial-overlay.tsx).

### Props

- steps
- currentStep
- isActive
- elementRect
- onNext
- onClose

### UI Behavior

- Renders dimmed full-screen backdrop.
- Draws a highlight border around the active target.
- Shows a tooltip with title, description, step counter, Close, and OK/Done actions.
- Does not close on backdrop click.
- Tutorial closes only through Close (or Done on the last step).

## Page Integration Pattern

Minimal example:

```tsx
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import type { TutorialStep } from "@/components/tutorial-overlay";

const MY_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "my-target",
    title: "My Step",
    description: "Explain this UI area.",
  },
];

const tutorial = useTutorial({
  steps: MY_STEPS,
  lessonKey: "my-lesson-key",
});

<TutorialOverlay
  steps={MY_STEPS}
  currentStep={tutorial.currentStep}
  isActive={tutorial.isActive}
  elementRect={tutorial.elementRect}
  onNext={tutorial.next}
  onClose={tutorial.close}
/>;
```

## Routing and Launching

Interactive tutorials are launched from [app/tutorial/page.tsx](app/tutorial/page.tsx).

- Some tutorials start in-place (platform overview).
- Others navigate using tutorial query params, for example:
  - /portfolio?tutorial=understanding-pnl
  - /portfolio?tutorial=managing-orders
  - /market/{marketId}?tutorial=first-trade

Each destination page reads query params and starts the matching tutorial once mounted.

## Portfolio Tutorials

Portfolio page implementation is in [app/portfolio/page.tsx](app/portfolio/page.tsx).

Supported lesson keys on that page:

- understanding-pnl
- managing-orders
- holdings-positions
- collateral
- settled-positions

Current understanding-pnl flow is tab-aware and includes explicit targets for:

- Portfolio summary area
- Tabs container and tab triggers
- Collateral, order history, and holdings panels

The page also auto-advances specific understanding-pnl steps when users switch to required tabs.

## Adding a New Tutorial

1. Add a step array in [lib/tutorial-steps.ts](lib/tutorial-steps.ts).
2. Add stable DOM ids to every target element.
3. Instantiate useTutorial with a unique lessonKey.
4. Render TutorialOverlay and wire onNext/onClose.
5. Decide how users start it:
   - Direct button action, or
   - query-param route from [app/tutorial/page.tsx](app/tutorial/page.tsx)
6. If needed, add page-specific auto-advance logic for guided interactions.

## Current Guarantees

- Highlight follows active element geometry.
- Highlight position updates on viewport changes.
- Target scrolling accounts for sticky header overlap.
- Background clicks do not dismiss tutorials.
- Completion persists across sessions (backend or local storage).
