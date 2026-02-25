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
- useCallback for event handlers and effects with dependencies

## Component Architecture

### 1. Single Responsibility Principle

Each component should have **ONE** clear purpose:

```typescript
// ❌ WRONG - Does too much
function GameDashboard() {
  // Handle game state
  const [score, setScore] = useState(0);

  // Handle camera feed
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Handle face detection
  const [faceDetected, setFaceDetected] = useState(false);

  // Handle audio processing
  const [audioLevel, setAudioLevel] = useState(0);

  // Handle UI state
  const [showHelp, setShowHelp] = useState(false);
}

// ✅ CORRECT - Split concerns
// GameDashboard.tsx (200 lines) - Game orchestration only
function GameDashboard() {
  const game = useGameState();
  const cameraFeed = <CameraFeed />;
  const faceDetector = <FaceDetector />;
  const audioProcessor = <AudioLevelIndicator />;
  return { /* UI composition */ };
}
```

### 2. File Size Limits

**Maximum 500 lines per file** (excluding test files)

This includes:
- All imports and exports
- Type definitions and interfaces
- Class/function implementations
- Comments and documentation
- Helper functions

**Examples of good splits:**
```
// FaceDetectorWorkerManager.ts (400 lines)
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
// Before (helper methods mixed with business logic)
class DataProcessor {
  processBatch(items: Item[]) {
    // 50 lines of validation
    const validItems = items.filter(item =>
      item.id && item.value > 0 && item.timestamp
    );

    // 30 lines of transformation
    const transformed = validItems.map(item => ({
      ...item,
      normalized: item.value / 100,
      formatted: new Date(item.timestamp).toISOString()
    }));

    // 40 lines of aggregation
    const stats = transformed.reduce((acc, item) => {
      acc.total += item.normalized;
      acc.count++;
      return acc;
    }, { total: 0, count: 0 });

    return { transformed, stats };
  }
}

// After (extracted utilities)
// dataProcessor.ts (200 lines - business logic only)
class DataProcessor {
  processBatch(items: Item[]) {
    const validItems = ValidationUtils.filterValid(items);
    const transformed = TransformationUtils.transform(validItems);
    const stats = AggregationUtils.aggregate(transformed);
    return { transformed, stats };
  }
}

// validationUtils.ts (50 lines)
export const ValidationUtils = {
  filterValid(items: Item[]): Item[] { /* ... */ }
};

// transformationUtils.ts (30 lines)
export const TransformationUtils = {
  transform(items: Item[]): TransformedItem[] { /* ... */ }
};

// aggregationUtils.ts (40 lines)
export const AggregationUtils = {
  aggregate(items: TransformedItem[]): Stats { /* ... */ }
};
```

**3. Extract Custom Hooks**
```typescript
// Before (mixing state and effects)
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const data = await fetchUser(userId);
        setUser(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [userId]);

  // 50 lines of UI logic...
}

// After (separated concerns)
// UserProfile.tsx (150 lines - UI only)
function UserProfile({ userId }: { userId: string }) {
  const { user, loading, error } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <ErrorDisplay error={error} />;
  return <UserData user={user} />;
}

// useUser.ts (100 lines - data fetching only)
export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Same loading logic...
  }, [userId]);

  return { user, loading, error };
}
```

## JavaScript/TypeScript Patterns

### 1. Async/Await Patterns

```typescript
// ❌ WRONG - Bare async/await without error handling
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoElement.srcObject = stream;
}

// ✅ CORRECT - Proper error handling
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoElement.srcObject = stream;
    return stream;
  } catch (error) {
    console.error('Failed to setup camera:', error);
    throw new Error('Camera access denied');
  }
}
```

### 2. Type Checking Patterns

```typescript
// ❌ WRONG - Type assertions without validation
const data = JSON.parse(response.body) as DataShape;

// ✅ CORRECT - Runtime type validation
function parseData(response: string): DataShape {
  const parsed = JSON.parse(response);
  if (!isValidDataShape(parsed)) {
    throw new Error('Invalid data shape');
  }
  return parsed;
}
```

### 3. Error Handling Patterns

```typescript
// ❌ WRONG - Generic error handling
try {
  // Some operation
} catch (error) {
  console.error(error);
}

// ✅ CORRECT - Specific error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle network errors specifically
    return retryOperation();
  } else if (error instanceof ValidationError) {
    // Handle validation errors
    return showErrorToUser(error.message);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
    throw error;
  }
}
```

### 4. Optional Handling Patterns

```typescript
// ❌ WRONG - Type assertions and null checks
const result = data!.results![0]!.value;

// ✅ CORRECT - Proper null/undefined handling
function getFirstResult(data: Data | null): number | null {
  if (!data || !data.results || data.results.length === 0) {
    return null;
  }
  return data.results[0].value;
}
```

### 5. Test Helper Patterns

```typescript
// ❌ WRONG - Complex test setup in multiple places
describe('Component', () => {
  test('works', () => {
    // 20 lines of setup logic
    // 5 lines of test
    // 10 lines of cleanup logic
  });
});

// ✅ CORRECT - Extracted test helpers
describe('Component', () => {
  const setupTest = () => {
    // 20 lines of setup logic
    return { /* test data */ };
  };

  afterEach(() => {
    // 10 lines of cleanup logic
  });

  test('works', () => {
    const testData = setupTest();
    // 5 lines of test
  });
});
```

### 6. Performance Patterns

```typescript
// ❌ WRONG - Unnecessary re-renders
const MyComponent = ({ data }) => {
  const [filtered, setFiltered] = useState([]);

  useEffect(() => {
    setFiltered(data.filter(item => item.active));
  }, [data]);

  return <List items={filtered} />;
};

// ✅ CORRECT - Memoization and optimization
const MyComponent = ({ data }) => {
  const filtered = useMemo(() =>
    data.filter(item => item.active),
    [data]
  );

  return <List items={filtered} />;
};
```

## Worker Patterns

### 1. Worker Setup

```typescript
// ❌ WRONG - No type safety
const worker = new Worker('./worker.ts');

// ✅ CORRECT - Typed worker setup
type WorkerMessage = { type: 'PROCESS_DATA'; payload: Data };
type WorkerResponse = { type: 'RESULT'; result: ProcessedData } | { type: 'ERROR'; error: string };

const worker = new WorkerWorker<WorkerMessage, WorkerResponse>('./worker.ts');
```

### 2. Worker Communication

```typescript
// ❌ WRONG - Manual serialization
worker.postMessage({ data: complexObject });

// ✅ CORRECT - Structured communication
type ProcessDataMessage = {
  type: 'process_data';
  payload: {
    frame: ImageData;
    timestamp: number;
    config: ProcessingConfig;
  };
};

worker.postMessage<ProcessDataMessage>({
  type: 'process_data',
  payload: { frame, timestamp, config }
});
```

### 3. Worker Lifecycle

```typescript
// ❌ WRONG - No cleanup
useEffect(() => {
  const worker = new Worker('./worker.ts');
  worker.onmessage = (event) => { /* ... */ };
  return () => { /* missing cleanup */ };
}, []);

// ✅ CORRECT - Proper cleanup
useEffect(() => {
  const worker = new Worker('./worker.ts');
  const handler = (event: MessageEvent) => { /* ... */ };
  worker.onmessage = handler;

  return () => {
    worker.onmessage = null;
    worker.terminate();
  };
}, []);
```

## Type Safety Patterns

### 1. Redux State Types

```typescript
// ❌ WRONG - Any types
interface State {
  data: any;
  loading: boolean;
}

// ✅ CORRECT - Proper typing
interface DataState {
  items: Item[];
  loading: boolean;
  error: Error | null;
}

interface UIState {
  selectedId: string | null;
  filter: FilterOptions;
}
```

### 2. Event Handler Types

```typescript
// ❌ WRONG - Untyped events
const handleClick = (event) => {
  console.log(event.target);
};

// ✅ CORRECT - Typed events
const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
  console.log(event.currentTarget);
};
```

### 3. API Response Types

```typescript
// ❌ WRONG - Dynamic typing
const response = await fetch('/api/data');
const data = await response.json();

// ✅ CORRECT - Static typing
interface ApiResponse {
  success: boolean;
  data: Item[];
  metadata: {
    total: number;
    page: number;
  };
}

const response = await fetch('/api/data');
const data = await response.json() as ApiResponse;
```

## Testing Patterns

### 1. Mock Patterns

```typescript
// ❌ WRONG - Manual mocking
jest.mock('./module', () => ({
  function: jest.fn(() => 'mocked')
}));

// ✅ CORRECT - Factory pattern for complex mocks
const createMockModule = () => ({
  function: jest.fn((input: string) => {
    if (input === 'error') {
      throw new Error('Test error');
    }
    return `mocked-${input}`;
  })
});

jest.mock('./module', () => createMockModule());
```

### 2. Async Testing

```typescript
// ❌ WRONG - No async handling
test('async test', async () => {
  const result = await asyncFunction();
  expect(result).toBe(true);
});

// ✅ CORRECT - Proper async handling
test('async test', async () => {
  await act(async () => {
    const result = await asyncFunction();
    expect(result).toBe(true);
  });
});
```

### 3. Component Testing

```typescript
// ❌ WRONG - Render only
test('component renders', () => {
  render(<Component />);
});

// ✅ CORRECT - User interaction testing
test('component handles user interaction', async () => {
  const user = userEvent.setup();
  render(<Component />);

  await user.click(button);
  expect(mockFunction).toHaveBeenCalledTimes(1);
});
```

### 4. Test Data Setup

```typescript
// ❌ WRONG - Hardcoded data
test('test with hardcoded data', () => {
  const data = [
    { id: 1, name: 'test' },
    { id: 2, name: 'test2' }
  ];
  // ...
});

// ✅ CORRECT - Test data factories
const createTestData = (overrides?: Partial<Item>) => ({
  id: 1,
  name: 'test',
  active: true,
  ...overrides
});

test('test with factory data', () => {
  const data = createTestData({ id: 2 });
  // ...
});
```

### 5. Disable Linter Patterns (When Necessary)

**Problem-specific fixes:**

| Problem | Wrong | Right |
|---------|-------|-------|
| Unused param | `// eslint-disable` | `const test = (_event) => { }` |
| Type assertion | `data as any; // @ts-ignore` | `type DataShape = {...}; data as DataShape` |
| Empty function | `// eslint-disable-line` | Comment above explaining *why* |
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

# Neural Network Implementation

## MultiHeadAttention - Python-Parity Fixes

When implementing MultiHeadAttention to match Python TensorFlow, these critical differences must be addressed:

### 1. Scale Factor Application

**❌ WRONG (direct multiplication):**
```typescript
if (this.scaleFactor) {
  scores.mul(this.scaleFactor);  // No softplus wrapper
}
```

**✅ CORRECT (with softplus wrapper):**
```typescript
if (this.scaleFactor) {
  const learnableScale = tf.softplus(this.scaleFactor);
  scores.mul(learnableScale);
}
```

### 2. Hypersphere Normalization

**❌ WRONG (missing normalization):**
```typescript
const scores = tf.matMul(qTransposed, kTransposed, false, true);
```

**✅ CORRECT (with L2 normalization):**
```typescript
let queryNorm = qTransposed;
let keyNorm = kTransposed;
if (this.config.hypersphere) {
  queryNorm = tf.div(qTransposed, tf.norm(qTransposed, 2, -1, true));
  keyNorm = tf.div(kTransposed, tf.norm(kTransposed, 2, -1, true));
}
const scores = tf.matMul(queryNorm, keyNorm, false, true);
```

### 3. Scale Factor Trainable Behavior

**❌ WRONG (always trainable):**
```typescript
this.scaleFactor = tf.variable(
  tf.tensor1d([initVal], 'float32'),
  true,  // Always trainable
  `${this.namePrefix}attention_scale`
);
```

**✅ CORRECT (trainable only when hypersphere=True):**
```typescript
this.scaleFactor = tf.variable(
  tf.tensor1d([initVal], 'float32'),
  this.config.hypersphere,  // Only trainable if hypersphere=True
  `${this.namePrefix}attention_scale`
);
```

### 4. Numerical Precision Considerations

- TensorFlow.js and Python TensorFlow have slight numerical differences
- For testing, use tolerance of `5e-7` instead of `1e-8`
- This accounts for floating-point precision differences between backends
- Example: `assertTensorsClose(actual, expected, 5e-7)`

### 5. TensorFlow.js Function Name Mapping

| Python TensorFlow | TensorFlow.js |
|------------------|--------------|
| `tf.nn.l2_normalize` | `tf.div(tensor, tf.norm(tensor, 2, axis, keepDims))` |
| `tf.keras.layers.Dense` | `tfl.layers.dense` |
| `self.add_weight()` | `tf.variable()` |