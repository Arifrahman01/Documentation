# Unit Testing with QUnit

Setting up automated unit tests and integration tests using QUnit and OPA5 in SAPUI5.

---

## Testing Strategy in SAPUI5

SAPUI5 provides official support for comprehensive testing across three tiers:
1. **Unit Tests (QUnit)**: Test individual functions, model formatters, and controller utilities in isolation.
2. **Integration Tests (OPA5)**: Test user workflows and UI control interactions without backend latency.
3. **End-to-End Tests (wdi5)**: Full browser automation testing integrated with WebdriverIO.

---

## Writing a QUnit Test

Unit test suites reside under `webapp/test/unit/`:

```javascript
sap.ui.define([
  "com/doc/portal/model/formatter"
], function (formatter) {
  "use strict";

  QUnit.module("Status Formatter Tests");

  QUnit.test("Should return Success state for active status", function (assert) {
    // Arrange
    var sStatus = "Active";

    // Act
    var sState = formatter.statusState(sStatus);

    // Assert
    assert.strictEqual(sState, "Success", "Active status returns Success state");
  });

  QUnit.test("Should return Error state for inactive status", function (assert) {
    var sState = formatter.statusState("Inactive");
    assert.strictEqual(sState, "Error", "Inactive status returns Error state");
  });
});
```

---

## Running Automated Tests

Run test runners through your browser or CLI:

```bash
# Start UI5 development server and visit test runner
npm run dev

# Open unit test suite:
http://localhost:8088/test/unit/unitTests.qunit.html
```
