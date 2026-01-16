# Coding Style Guide

## Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Variables/functions | camelCase | `selectedCameras`, `handleDataWorkerReady` |
| Components/Classes | PascalCase | `FaceDetectorComponent`, `CameraFrameCaptureController` |
| Constants | UPPERCASE_SNAKE_CASE | `READINESS_TIMEOUT`, `DEFAULT_SETTINGS` |
| Type/Interface names | PascalCase | `DetectionResult`, `WorkerConfig` |
| Private/internal | underscore prefix | `_circleROI`, `_toGrayscale` |
| Callbacks | `on` or `handle` prefix | `onDetect`, `handleFrame` |
| Redux slices | Interface with `I` | `IScreen`, `ICamera` |
| File names | Component: PascalCase, Utils: camelCase | `FaceDetector.tsx`, `faceDetectorHelpers.ts` |
| Workers | `.worker.ts` suffix | `FaceDetector.worker.ts` |

## File Structure

```typescript
// 1. Imports (external, then internal)
import React, { useCallback } from 'react';
import type { Position } from '../shared/Sample';

// 2. Constants
const READINESS_TIMEOUT = 3000;

// 3. Types/Interfaces
interface Props { /* ... */ }
type Point = { x: number; y: number };

// 4. Main component/function/class
export function MyComponent(props: Props) { /* ... */ }
```

## TypeScript Patterns

- **All parameters and returns typed** - No `any` or `unknown` in signatures
- **Type definitions first** - Define types before functions, not in signatures
- **`type` for unions/simple aliases** - `type Position = { x: number; y: number }`
- **`interface` for complex extensible objects**
- **Typed refs** - `useRef<HTMLVideoElement | null>(null)`
- **Typed Maps** - `new Map<string, WorkerStats>()`
- **No casting unless `unknown`** - Always cast through `unknown`: `value as unknown as Type`

## React Patterns

- Functional components + hooks only
- Props destructured with typing: `function Component({ prop1, prop2 }: Props)`
- Multiple effects for separate concerns
- Refs for non-render-triggering objects (managers, workers, refs)
- `useCallback` for callbacks passed to children (include all deps)
- **Redux**: Use `connect()` HOC (not hooks), inline simple mappers
- Effect dependencies explicit and complete (no stale closures)

**Redux State Pattern**: Store nested objects as JSON strings, parse in selectors:
```typescript
// Redux state
configJson: '{"key":"value"}'

// Selector (memoized)
export const selectConfig = (state) => JSON.parse(state.app.configJson);
```

## Error Handling & Null Safety

- Validation in constructors with throw
- try-catch for async with error context
- Explicit null checks before operations: `if (!instance) return`
- Never use `!` non-null assertions - use proper checks instead
- Optional chaining: `obj?.property?.value`
- Nullish coalescing: `value ?? defaultValue`

## Code Organization

- Constants → Types → Helpers → Main → Exports
- One concern per file
- Comments explain *why*, not *what*
- No magic numbers (extract to constants)
- JSDoc headers on files

## File Size Limits: Refactor & Split

**The Core Rule**: Files must not exceed 500 lines. Files over 500 lines are candidates for refactoring and splitting into focused modules.

```typescript
// ❌ WRONG - 750-line monolithic file
// FaceDetectorWorkerManager.ts (all concerns mixed)
export class FaceDetectorWorkerManager {
  // Message routing (100 lines)
  // Stats aggregation (100 lines)
  // Worker lifecycle (100 lines)
  // Config broadcasting (100 lines)
  // Rate limiting (100 lines)
  // ... 250 more lines of mixed concerns
}

// ✅ CORRECT - Split into focused modules
// FaceDetectorWorkerManager.ts (220 lines - main orchestrator)
// FaceDetectorWorkerManager/messageHandler.ts (80 lines)
// FaceDetectorWorkerManager/statsAggregator.ts (90 lines)
// FaceDetectorWorkerManager/configBroadcaster.ts (70 lines)
```

**Why 500-Line Limit**:
- 500 lines = ~20-30 minutes to read thoroughly
- Easier to understand one concern per file
- Smaller files have fewer reasons to change
- Reduced cognitive load in code reviews
- Tests become faster and more focused
- Easier to refactor and maintain

**Warning Signs - File Needs Splitting**:
- ❌ Class has 5+ main responsibilities (methods that could be helper classes)
- ❌ Over 100 lines of imports (too many dependencies)
- ❌ Test file has 10+ describe blocks (too many concerns)
- ❌ One method/function is 100+ lines (extract helpers)
- ❌ Multiple developers editing same file frequently (merge conflicts)
- ❌ File doesn't fit on 2 screens (vertical scrolling beyond reason)

**Refactoring Strategies**:

**1. Extract Helper Classes**
```typescript
// Before (500+ lines in one class)
export class Manager {
  private stats: Map<string, WorkerStats>;

  // 100 lines of stats aggregation logic
  updateStats(workerId: string, data: StatsData) { /* ... */ }
  getStats(): AggregatedStats { /* ... */ }
  aggregateFromMultipleWorkers() { /* ... */ }
}

// After (split concerns)
// manager.ts (200 lines - orchestration only)
export class Manager {
  private statsAggregator: StatsAggregator;
  getStats() { return this.statsAggregator.getStats(); }
}

// statsAggregator.ts (100 lines - stats logic only)
export class StatsAggregator {
  private stats: Map<string, WorkerStats>;
  updateStats(workerId: string, data: StatsData) { /* ... */ }
  getStats(): AggregatedStats { /* ... */ }
}
```

**2. Extract Utility Functions**
```typescript
// Before (200 lines of unrelated functions in utils.ts)
export function calculateDistance() { /* 30 lines */ }
export function interpolatePoints() { /* 40 lines */ }
export function optimizePath() { /* 50 lines */ }
export function validateBounds() { /* 30 lines */ }
export function formatOutput() { /* 20 lines */ }

// After (split by domain)
// geometry.ts (60 lines)
export function calculateDistance() { /* ... */ }
export function interpolatePoints() { /* ... */ }

// validation.ts (60 lines)
export function validateBounds() { /* ... */ }
export function optimizePath() { /* ... */ }

// formatting.ts (20 lines)
export function formatOutput() { /* ... */ }
```

**3. Extract Message Handlers**
```typescript
// Before (300+ lines handling multiple message types)
export class Manager {
  private onWorkerMessage(event: MessageEvent) {
    if (data.type === 'frame') { /* 60 lines */ }
    if (data.type === 'stats') { /* 50 lines */ }
    if (data.type === 'error') { /* 40 lines */ }
    if (data.type === 'config') { /* 50 lines */ }
    // ... more handlers
  }
}

// After (delegated to handler classes)
// manager.ts (100 lines)
export class Manager {
  private handlers = new Map<string, MessageHandler>();

  private onWorkerMessage(event: MessageEvent) {
    const handler = this.handlers.get(event.data.type);
    handler?.handle(event.data);
  }
}

// handlers/frameHandler.ts (60 lines)
export class FrameHandler implements MessageHandler {
  handle(data: FrameData) { /* ... */ }
}
```

**How to Refactor Without Breaking**:

1. **Create new file** with extracted code (unchanged logic)
2. **Update imports** in main file to use new module
3. **Run tests** - all should pass (logic hasn't changed)
4. **Delete** old code from main file
5. **Verify** imports are clean, no unused dependencies

**Real Example from This Project**:

`FaceDetectorWorkerManager.ts` approaches 400 lines. Before hitting 500, candidates for extraction:
- Stats aggregation logic → `StatsAggregator` class
- Message type routing → `MessageHandlers` map
- Config broadcasting → `ConfigBroadcaster` class
- Camera lifecycle → `CameraManager` class

This keeps main manager at ~150 lines (pure orchestration).

**File Size Checklist**:
- [ ] Does file exceed 500 lines?
- [ ] Can any class be extracted to its own file?
- [ ] Can utility functions be grouped by domain?
- [ ] Are there 5+ test describe blocks (split test file)?
- [ ] Would another developer need to read 30+ minutes to understand?
- [ ] Do unrelated features live in same file?

If yes to any: **Refactor and split**. Small, focused files are easier to maintain.

## Resource Management

- Explicit cleanup: `frame.close()`, `stream.stop()`, `worker.terminate()`
- useEffect return cleanup functions for unmount
- Track resources in Maps/Sets
- Cleanup should be idempotent (safe to call multiple times)

## Anti-Patterns

❌ `any` types in production — define proper types instead
❌ Complex single effects — split into multiple
❌ Non-null assertions (`!`) — use proper null checks
❌ Array indices as React keys — use stable identifiers
❌ Memoized callbacks used only locally — overhead > benefit
❌ Silent failures — log or throw with context

---

# Type Safety Essentials

## 1. All Function Parameters Must Be Typed

```typescript
// ❌ WRONG
function uniform(min, max) { return min + Math.random() * (max - min); }
function clip(value, min, max) { if (value < min) return min; /* ... */ }

// ✅ CORRECT
function uniform(min: number, max: number): number { /* ... */ }
function clip(value: number, min: number, max: number): number { /* ... */ }

// ✅ Arrays typed by items
function calcDistance(points: Point[]): number[] { /* ... */ }
```

## 2. Never Use Non-Null Assertions (`!`)

```typescript
// ❌ WRONG
const bucket = this.buckets.get(key)!;

// ✅ CORRECT
const bucket = this.buckets.get(key);
if (!bucket) return;
// Now safe to use bucket
```

## 3. Casting Through `unknown` (2-Step Pattern)

```typescript
// ❌ WRONG - Direct cast fails
gameMode.onKeyDown(event as KeyboardEvent);

// ✅ CORRECT - Cast through unknown
gameMode.onKeyDown(event as unknown as KeyboardEvent);
```

**Browser APIs with vendor prefixes:**
```typescript
function enableFullscreen(canvas: HTMLElement): void {
  const el = canvas as unknown as {
    requestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => void;
    webkitRequestFullscreen?: () => void;
  };
  if (el.requestFullscreen) { el.requestFullscreen(); }
  else if (el.mozRequestFullScreen) { el.mozRequestFullScreen(); }
}
```

## 4. Typed Message Handlers (Workers)

```typescript
// ❌ WRONG
const handleFrame = (data: any) => { /* ... */ };

// ✅ CORRECT
type FrameMessage = { frame: VideoFrame; time: number; goal: Position | null };
const handleFrame = ({ frame, time, goal }: FrameMessage) => { /* ... */ };
```

## 5. Web Worker Imports

```typescript
// In worker file
export default null;  // ✅ REQUIRED for TypeScript

// In main file
import Worker from './FaceDetector.worker';  // ✅ NO .ts extension
```

## 6. Canvas Type Safety

```typescript
// ✅ Canvas-compatible images must extend CanvasImageSource
type FrameData = CanvasImageSource & { height: number; width: number };

function processImage(image: FrameData, canvas: OffscreenCanvas) {
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);  // Type-safe
}
```

## 7. Define Types, Don't Use `unknown` in Signatures

```typescript
// ❌ WRONG - Using unknown as cop-out
function results2sample(results: unknown, frame: unknown): SampleData | null {
  const typedResults = results as FaceLandmarkerResult;  // Still unsafe
  // ...
}

// ✅ CORRECT - Define proper types upfront
type FaceLandmarkerResult = { faceLandmarks: NormalizedLandmark[][] };
type FrameData = { height: number; width: number };

function results2sample(
  results: FaceLandmarkerResult,
  frame: FrameData
): SampleData | null {
  if (!results.faceLandmarks) return null;  // Type-safe
  // ...
}
```

**Type sources:**
1. Define yourself: `type Sample = { time: number; goal: Position }`
2. Import from libraries: `import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'`
3. Derive from existing: `type SampleData = ConstructorParameters<typeof Sample>[0]`
4. Extend existing: `type MyMessage = BaseMessage & { extra: string }`

## 8. Avoid Dynamic Property Access Without Types

```typescript
// ❌ WRONG
const reducers: Record<string, any> = {};

// ✅ CORRECT
const reducers: Record<string, unknown> = {};
```

(`unknown` = "I don't know", `any` = "I don't care")

## 9. Collections Must Have Item Types

```typescript
// ❌ WRONG
const items: any[] = [];
const map = new Map<string, any>();

// ✅ CORRECT
type ManagerMessageHandler = (cameraId: string, data: WorkerMessageData) => void;
const map = new Map<string, ManagerMessageHandler>();
```

## 10. Test Data Types Must Match Production

```typescript
// ✅ Type test data exactly like production
type SampleConstructorData = ConstructorParameters<typeof Sample>[0];
let sampleData: SampleConstructorData = {
  time: 1000,
  leftEye: new Uint8ClampedArray(EYE_SIZE * EYE_SIZE).fill(128),
};

// ✅ For incomplete test objects, explicit casting
const incomplete = { uuid: 'abc-123' } as unknown as { uuid: string; samples: number };
```

---

# Linting & Code Quality

## Never Use Lint Disable Comments

```typescript
// ❌ WRONG - Hiding the problem
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

// ✅ CORRECT - Make intent explicit
// Intentionally empty - used as default handler
const noop = () => {};

// ✅ CORRECT - Extract to constant with clear name
const NO_OP = async () => {};
```

**For empty function patterns, extract to module constant:**
```typescript
// ✅ Define once, use many times
const emptyAsyncFn = async () => {};  // Intentionally empty - used for testing

// In tests
jest.fn(emptyAsyncFn);  // Clean, reusable
jest.fn(emptyAsyncFn);
jest.fn(emptyAsyncFn);
```

**Problem-specific fixes:**

| Problem | Wrong | Right |
|---------|-------|-------|
| Unused param | `// eslint-disable` | `const test = (_event) => { }` |
| Type assertion | `data as any; // @ts-ignore` | `type DataShape = {...}; data as DataShape` |
| Empty function | `// eslint-disable-next-line` | Comment above explaining *why* |
| `any` type | `// eslint-disable` | Define proper type instead |

**Acceptable disable comments (rare):**
```typescript
// ✅ With clear explanation
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => setupStream(), []);  // Intentionally empty - effect runs once on mount
```

---

# React State & Callbacks

## Setting Callback Functions in State

```typescript
// ❌ WRONG - React treats it as state initializer
setCallback(onConfirm);  // onConfirm gets called immediately

// ✅ CORRECT - Wrap in function to store callback
setCallback(() => onConfirm);  // Callback stored as state value
```

Real example from this project:
```typescript
// ❌ ORIGINAL
const openGameConfirmDialog = useCallback((gameMode, onConfirm) => {
  setOnGameStartConfirm(onConfirm);  // ❌ Treated as initializer
}, []);

// ✅ FIXED
const openGameConfirmDialog = useCallback((gameMode, onConfirm) => {
  setOnGameStartConfirm(() => onConfirm);  // ✅ Stored as value
}, []);
```
