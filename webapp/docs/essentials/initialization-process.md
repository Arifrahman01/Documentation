# Initialization Process

The initialization process covers the entire lifecycle from loading the SAPUI5 bootstrap script to rendering the root UI components in the browser DOM.

> [!NOTE]
> For optimal performance, always load SAPUI5 asynchronously by setting `data-sap-ui-async="true"` in the bootstrap script tag.

---

## Overview

When an HTML page referencing SAPUI5 is loaded in a web browser, the framework executes several sequential steps to initialize the runtime environment:

1. **Bootstrap Script Evaluation:** The core framework loader (`sap-ui-core.js`) is fetched and executed.
2. **Configuration Settings Parsing:** Attributes specified in the `data-sap-ui-*` bootstrap configuration are processed.
3. **Core Module Loading:** Essential dependencies (such as Core, Base, Theming, and EventProvider) are initialized.
4. **Library Loading:** Defined UI libraries (`sap.m`, `sap.ui.core`, `sap.f`) are loaded.
5. **Component Instantiation:** The application `ComponentSupport` module starts the root component defined in `manifest.json`.

---

## Bootstrapping Configuration

The framework is typically loaded in the `<head>` section of `index.html` using a `<script>` tag.

```html
<script
  id="sap-ui-bootstrap"
  src="https://sdk.openui5.org/resources/sap-ui-core.js"
  data-sap-ui-theme="sap_horizon"
  data-sap-ui-resourceroots='{
    "sap.ui.demo": "./"
  }'
  data-sap-ui-oninit="module:sap/ui/core/ComponentSupport"
  data-sap-ui-compatVersion="edge"
  data-sap-ui-async="true">
</script>
```

### Key Bootstrap Parameters

| Parameter | Type | Description |
|---|---|---|
| `data-sap-ui-theme` | string | Specifies the active SAP Fiori theme (e.g., `sap_horizon`, `sap_horizon_dark`, `sap_fiori_3`). |
| `data-sap-ui-async` | boolean | Enables asynchronous loading of modules and preload bundles for fast page startup. |
| `data-sap-ui-resourceroots` | object | Maps module namespaces to relative or absolute filesystem URLs. |
| `data-sap-ui-oninit` | string | Declares the startup module executed after the Core finishes initialization. |
| `data-sap-ui-compatVersion` | string | Enforces compatibility mode, typically set to `edge`. |

---

## Asynchronous Module Loading

SAPUI5 leverages modern AMD-like module definition through `sap.ui.define` and `sap.ui.require`. This ensures dependencies are loaded on demand without blocking the browser main thread.

```javascript
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("sap.ui.demo.controller.Main", {
    onInit: function () {
      var oViewModel = new JSONModel({
        title: "Hello SAPUI5",
        status: "Ready"
      });
      this.getView().setModel(oViewModel, "view");
    }
  });
});
```

> [!TIP]
> Always enable `Component-preload.js` in production to bundle all views, controllers, and i18n bundles into a single HTTP payload.

---

## Component Startup Lifecycle

When using declarative component startup with `ComponentSupport`, the following lifecycle events occur:

1. **`Component.js` constructor:** Framework initializes base properties and reads `manifest.json`.
2. **`init()` method:** Custom application models, i18n bundles, and device models are instantiated.
3. **`Router initialization:`** Hash changer monitors URL navigation and routes to the initial target view.
4. **`createContent()`:** Root view container (`App.view.xml`) is rendered into the hosting DOM element.

```xml
<body class="sapUiBody" id="content">
  <div
    data-sap-ui-component
    data-name="sap.ui.demo"
    data-id="container"
    data-settings='{"id" : "rootDemo"}'
    style="height: 100%;">
  </div>
</body>
```

---

## Related Information

- [Model View Controller (MVC) Concept](file://#)
- [Declarative Component Configuration](file://#)
- [Performance Optimization Best Practices](file://#)
