# Quick Start

Get started building modern, enterprise-ready web applications using the SAPUI5 framework.

---

## What is SAPUI5?

SAPUI5 is a JavaScript UI framework built to create cross-platform, enterprise-grade business applications that run seamlessly across desktop, tablet, and mobile browsers.

Key characteristics include:
- **Consistent Design:** Native support for the SAP Horizon and Quartz design systems.
- **Model-View-Controller:** Strict separation of data, UI presentation, and application logic.
- **Rich Control Library:** Hundreds of accessible, responsive UI controls (`sap.m`).
- **OData & JSON Data Binding:** Two-way data binding with OData V2/V4 and REST endpoints.

---

## Setting Up Your Project

A standard modern SAPUI5 application includes the following directory layout:

```text
webapp/
├── Component.js           # Application root component
├── manifest.json          # App descriptor configuration
├── index.html             # HTML entry point with bootstrap
├── i18n/
│   └── i18n.properties    # Translatable texts
├── view/
│   └── App.view.xml       # Root XML View
└── controller/
    └── App.controller.js  # Root Controller
```

---

## Defining Views in XML

SAP recommends declarative XML Views for defining UI layouts:

```xml
<mvc:View
  controllerName="sap.ui.demo.controller.App"
  xmlns:mvc="sap.ui.core.mvc"
  xmlns="sap.m">
  <Page title="My First App">
    <content>
      <VBox class="sapUiMediumMargin">
        <Title text="Welcome to SAPUI5!" level="H2" />
        <Button text="Click Me" type="Emphasized" press=".onPressButton" />
      </VBox>
    </content>
  </Page>
</mvc:View>
```

> [!NOTE]
> All UI strings should be stored in resource bundles (`i18n.properties`) rather than hardcoded in views.
