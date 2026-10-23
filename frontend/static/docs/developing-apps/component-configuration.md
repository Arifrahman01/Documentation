# Component Configuration

Guide on manifest.json configuration, routing targets, models, and dependencies in SAPUI5.

---

## Overview

In SAPUI5, the application descriptor file (`manifest.json`) serves as the central configuration point for your entire application. It provides metadata about the app, declares dependencies, instantiates models automatically, and configures hash-based routing.

---

## Descriptor Structure (`manifest.json`)

The `manifest.json` file is divided into distinct standard namespaces:

```json
{
  "_version": "1.48.0",
  "sap.app": {
    "id": "com.doc.portal",
    "type": "application",
    "i18n": "i18n/i18n.properties",
    "title": "{{appTitle}}",
    "description": "{{appDescription}}",
    "applicationVersion": {
      "version": "1.0.0"
    }
  },
  "sap.ui": {
    "technology": "UI5",
    "deviceTypes": {
      "desktop": true,
      "tablet": true,
      "phone": true
    }
  },
  "sap.ui5": {
    "rootView": {
      "viewName": "com.doc.portal.view.App",
      "type": "XML",
      "async": true,
      "id": "app"
    },
    "dependencies": {
      "minUI5Version": "1.120.0",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {},
        "sap.ui.layout": {},
        "sap.tnt": {}
      }
    },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "com.doc.portal.i18n.i18n"
        }
      }
    },
    "routing": {
      "config": {
        "routerClass": "sap.m.routing.Router",
        "viewType": "XML",
        "viewPath": "com.doc.portal.view",
        "controlId": "app",
        "controlAggregation": "pages",
        "async": true
      },
      "routes": [],
      "targets": {}
    }
  }
}
```

---

## Key Configuration Sections

### 1. `sap.app`
Defines general application identity and data sources:
- `id`: Unique namespace of the component (e.g. `com.doc.portal`).
- `dataSources`: Backend service definitions (OData, REST endpoints).

### 2. `sap.ui5/models`
Models declared here are automatically instantiated during component initialization:
- **Default model (`""`)**: Bound to main business data.
- **`i18n`**: Resource bundle for localized labels and strings.
- **Device model (`device`)**: Device capabilities (`sap.ui.Device`).

### 3. `sap.ui5/routing`
Controls navigation within single-page applications:
- **`routes`**: URL patterns mapped to targets.
- **`targets`**: Define views to instantiate and place inside containers.
