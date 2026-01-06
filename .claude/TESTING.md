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
