# Model View Controller (MVC)

SAPUI5 provides a flexible MVC architecture that enforces separation between business data (Model), user interface (View), and behavioral logic (Controller).

---

## Architectural Principles

1. **Model:** Holds the application state and business data (e.g. `JSONModel`, `ODataModel`, `ResourceModel`).
2. **View:** Defines the UI components declaratively using XML, HTML, or JSON.
3. **Controller:** Handles events, triggers business operations, and updates the models.

```javascript
sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
  "use strict";

  return Controller.extend("sap.ui.demo.controller.Detail", {
    onInit: function () {
      // Controller initialization logic
    },

    onSavePress: function () {
      var oModel = this.getView().getModel();
      oModel.submitChanges();
    }
  });
});
```

---

## Types of Views

- **XML View:** Recommended standard for all applications.
- **JSON View:** Alternative declarative notation.
- **JS View:** Programmatic view creation (legacy).
- **HTML View:** HTML template with embedded controls.
