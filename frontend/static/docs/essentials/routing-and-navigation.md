# Routing & Navigation

Routing in SAPUI5 enables hash-based navigation between views, bookmarkable deep links, and smooth transitions within single-page applications.

---

## Configuration in manifest.json

Routing is configured declaratively in the `sap.ui5/routing` section of `manifest.json`:

```json
{
  "routing": {
    "config": {
      "routerClass": "sap.m.routing.Router",
      "viewType": "XML",
      "viewPath": "sap.ui.demo.view",
      "controlId": "appContainer",
      "controlAggregation": "pages",
      "transition": "fade",
      "async": true
    },
    "routes": [
      {
        "pattern": "",
        "name": "home",
        "target": "home"
      },
      {
        "pattern": "topic/{path}",
        "name": "topic",
        "target": "topic"
      }
    ]
  }
}
```

---

## Navigating Programmatically

Controllers can trigger route changes through the Router instance:

```javascript
var oRouter = this.getOwnerComponent().getRouter();
oRouter.navTo("topic", {
  path: "essentials/initialization-process"
});
```
