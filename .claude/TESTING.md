# Testing Best Practices

## Core Rules

1. **Test Only Real Code** - Import from source, never define implementations in tests
2. **One Test File Per Component** - `Component.test.ts` tests `Component.ts`
3. **Test Real Behavior** - Will removing the code break the test? If no, don't test it
4. **Import Actual Classes** - Not mocks that differ from real implementation
5. **Test Error Paths** - Null checks, type errors, edge cases, silent failures

## Structure

```typescript
describe('ComponentName', () => {
  beforeEach(() => { /* setup */ });

  describe('Feature', () => {
    it('should do something', () => {
      // Arrange - setup
      // Act - execute
      // Assert - verify
    });
  });
});
```

## Red Flags 🚩

- Test defines its own functions → ❌ Move to source
- No imports from `../` → ❌ Test non-existent code
- Uses `any` type → ❌ Use proper types
- No error testing → ❌ Add edge cases
- Test passes when code is deleted → ❌ Not testing real code

## What to Test

- ✅ Null/undefined handling
- ✅ Type safety
- ✅ Error logging
- ✅ Race conditions
- ✅ Empty collections
- ✅ Graceful degradation

## Never Hack Access to Private Members

**The Core Rule**: Never use type casting to access private properties in tests. If you need to test private state, expose a public getter or restructure the code.

```typescript
// ❌ WRONG - Hacking access to private members
type ManagerInternal = FaceDetectorWorkerManager & {
  cameras: Map<string, CameraState>;  // Private member, exposed via type casting
};

const state = (manager as unknown as ManagerInternal).cameras.get(cameraId);
expect(state.controller).toBeNull();  // Testing private implementation detail
```

**Why This Is Bad**:
- TypeScript's `private` keyword protects encapsulation - casting to `unknown` defeats this
- Tests break when internal implementation changes (brittle tests)
- Signals the class doesn't expose necessary public methods
- Tests become white-box instead of black-box (testing implementation, not behavior)
- Type casting is a code smell - if you need it, the design is wrong

**The Right Approach**:

**Option 1: Expose via public getter**
```typescript
// ✅ In class
export class FaceDetectorWorkerManager {
  private _cameras: Map<string, CameraState> = new Map();

  // Public accessor for testing
  getCameraState(cameraId: string): CameraState | undefined {
    return this._cameras.get(cameraId);
  }
}

// ✅ In test - clean, no casting
const state = manager.getCameraState(cameraId);
expect(state?.controller).toBeNull();
```

**Option 2: Test public methods instead**
```typescript
// ✅ BETTER - Test the public API, not private state
manager.addCamera(cameraId);  // Public method

// Register controller (public method)
const controllersMap = new Map([[cameraId, mockController]]);
manager.setCaptureControllers(controllersMap);

// Verify behavior through public getStats() call
const stats = manager.getStats();
expect(stats.get(cameraId)?.inputFps).toBeDefined();  // Public API
```

**Real Example from This Project**:

Before (hacking private access):
```typescript
// ❌ WRONG - Using type casting to bypass private
type ManagerInternal = FaceDetectorWorkerManager & {
  cameras: Map<string, CameraState>;
};

const internalState = (manager as unknown as ManagerInternal).cameras.get(cameraId);
expect(internalState.controller).toBeNull();
```

After (proper encapsulation):
```typescript
// ✅ CORRECT - Expose what tests need via public method
export class FaceDetectorWorkerManager {
  private _cameras: Map<string, CameraState> = new Map();

  // Public method for getting camera state in tests
  getCameraState(cameraId: string): CameraState | undefined {
    return this._cameras.get(cameraId);
  }
}

// In test
const state = manager.getCameraState(cameraId);
expect(state?.controller).toBeNull();
```

**Signs You Need Public Accessors**:
- Test file uses `as unknown as SomeType` to access properties
- Test file has a `type XInternal = X & { private_field: Type }` helper
- You're accessing private members more than once in tests
- Other tests are copying your type casting pattern

**When to Add Public Getters**:
- Your tests need to verify internal state → Add public getter
- Multiple tests need same access → Add public getter
- The class needs to expose this for external use → Make it public
- Only internal testing needs it → Refactor to test public behavior instead

**Rule of Thumb**: If your test can't verify something via public methods, the class isn't exposing enough. Fix the class API, not the test.
