sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("doc.portal.controller.Home", {
    onInit: function () {
    },

    onNavDocumentation: function () {
      this.getOwnerComponent().getRouter().navTo("topic", {
        path: "essentials/initialization-process"
      });
    },

    onNavApps: function () {
      this.getOwnerComponent().getRouter().navTo("apps");
    },

    onNavDemoApps: function () {
      this.getOwnerComponent().getRouter().navTo("apps");
    },

    onNavResources: function () {
      this.getOwnerComponent().getRouter().navTo("resources");
    },

    onOpenTopic: function (sPath) {
      this.getOwnerComponent().getRouter().navTo("topic", {
        path: sPath
      });
    },

    onOpenAiCopilot: function () {
      var oComponent = this.getOwnerComponent();
      var oRootControl = oComponent.getRootControl();
      var oAppController = oRootControl ? oRootControl.getController() : null;
      if (oAppController && typeof oAppController.onOpenAiCopilot === "function") {
        oAppController.onOpenAiCopilot();
      }
    },

    onHeroSearch: function (oEvent) {
      var sQuery = oEvent.getParameter("query");
      var oComponent = this.getOwnerComponent();
      var oRootControl = oComponent ? oComponent.getRootControl() : null;
      var oAppController = oRootControl ? oRootControl.getController() : null;
      if (oAppController && oAppController.onShellSearchPressed) {
        oAppController.onShellSearchPressed();
        if (sQuery && sQuery.trim().length >= 2) {
          setTimeout(function () {
            if (oAppController._oSearchInput) {
              oAppController._oSearchInput.setValue(sQuery);
              oAppController._doSearch(sQuery);
            }
          }, 350);
        }
      }
    }
  });
});
