# Tutorial System

A modular and reusable tutorial overlay system for the Tempora trading platform.

## Components

### `TutorialOverlay`

A presentational component that renders the tutorial UI overlay, highlighting elements and displaying tooltips.

### `useTutorial` Hook

A custom hook that manages tutorial state and logic, including step navigation and element tracking.

### Tutorial Steps

Centralized tutorial step definitions in `lib/tutorial-steps.ts`.

## Usage

### Basic Example

```tsx
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";

// Define your tutorial steps
const myTutorialSteps = [
  {
    id: 1,
    elementId: "target-element-1",
    title: "Step 1 Title",
    description: "Step 1 description",
  },
  {
    id: 2,
    elementId: "target-element-2",
    title: "Step 2 Title",
    description: "Step 2 description",
  },
];

function MyComponent() {
  const tutorial = useTutorial({
    steps: myTutorialSteps,
    autoStart: false, // Optional: start tutorial automatically
    onComplete: () => {
      console.log("Tutorial completed!");
    },
  });

  return (
    <div>
      <button onClick={tutorial.start}>Start Tutorial</button>

      <TutorialOverlay
        steps={myTutorialSteps}
        currentStep={tutorial.currentStep}
        isActive={tutorial.isActive}
        elementRect={tutorial.elementRect}
        onNext={tutorial.next}
        onClose={tutorial.close}
      />

      <div id="target-element-1">Element 1</div>
      <div id="target-element-2">Element 2</div>
    </div>
  );
}
```

### Using Pre-defined Tutorial Steps

```tsx
import { UNDERSTANDING_PNL_STEPS } from "@/lib/tutorial-steps";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";

function PortfolioPage() {
  const pnlTutorial = useTutorial({
    steps: UNDERSTANDING_PNL_STEPS,
  });

  return (
    <div>
      <button onClick={pnlTutorial.start}>Learn About P&L</button>

      <TutorialOverlay
        steps={UNDERSTANDING_PNL_STEPS}
        currentStep={pnlTutorial.currentStep}
        isActive={pnlTutorial.isActive}
        elementRect={pnlTutorial.elementRect}
        onNext={pnlTutorial.next}
        onClose={pnlTutorial.close}
      />

      {/* Your component content */}
    </div>
  );
}
```

## Hook API

### `useTutorial(options)`

**Options:**

- `steps`: Array of tutorial steps (required)
- `autoStart`: Boolean to start tutorial automatically (default: `false`)
- `onComplete`: Callback function called when tutorial completes

**Returns:**

- `isActive`: Boolean indicating if tutorial is active
- `currentStep`: Current step index
- `elementRect`: DOMRect of the currently highlighted element
- `start()`: Function to start/restart the tutorial
- `next()`: Function to advance to next step
- `close()`: Function to close the tutorial
- `goToStep(step)`: Function to jump to a specific step

## Component Props

### `TutorialOverlay`

- `steps`: Array of tutorial steps
- `currentStep`: Current step index
- `isActive`: Boolean to show/hide overlay
- `elementRect`: DOMRect of element to highlight
- `onNext`: Callback for next button
- `onClose`: Callback for close/skip button

## Adding New Tutorial Steps

1. Define your steps in `lib/tutorial-steps.ts`:

```typescript
export const MY_NEW_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    elementId: "element-id-in-dom",
    title: "Step Title",
    description: "Step description text",
  },
  // ... more steps
];
```

2. Ensure target elements have the corresponding IDs:

```tsx
<div id="element-id-in-dom">Target content</div>
```

3. Use the tutorial in your component as shown in the examples above.

## Features

- ✅ Automatic element highlighting with yellow border
- ✅ Responsive tooltip positioning
- ✅ Window resize and scroll handling
- ✅ Keyboard-friendly navigation
- ✅ Dark mode support
- ✅ Completion callbacks
- ✅ Step navigation controls
