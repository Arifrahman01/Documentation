sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Theming"
], function (UIComponent, JSONModel, Theming) {
  "use strict";

  return UIComponent.extend("doc.portal.Component", {
    metadata: {
      manifest: "json"
    },

    init: function () {
      // Call parent init
      UIComponent.prototype.init.apply(this, arguments);

      // Setup app view state model
      var sSavedTheme = localStorage.getItem("portal_theme") || "sap_horizon";
      var oAppViewModel = new JSONModel({
        isSideExpanded: false,
        selectedTab: "home",
        selectedTheme: sSavedTheme,
        selectedTopicKey: "",
        selectedPilar: "all",
        searchQuery: "",
        topicCount: {
          all: 0,
          sap: 0,
          sac: 0,
          web: 0
        }
      });
      this.setModel(oAppViewModel, "appView");

      // Apply saved theme
      Theming.setTheme(sSavedTheme);

      // Setup docs model
      var oDocsModel = new JSONModel();
      oDocsModel.loadData("./docs/docs-index.json").then(function () {
        var oData = oDocsModel.getData();
        if (oData && oData.stats) {
          oAppViewModel.setProperty("/topicCount", oData.stats);
        }
      }).catch(function () {
        console.warn("docs-index.json not yet available. Using empty navigation.");
      });
      this.setModel(oDocsModel, "docs");

      // Setup apps model
      var oAppsModel = new JSONModel();
      oAppsModel.loadData("./model/apps.json");
      this.setModel(oAppsModel, "apps");

      // Initialize router with helper for wildcard routes
      var oRouter = this.getRouter();
      var fnOrigNavTo = oRouter.navTo.bind(oRouter);
      oRouter.navTo = function (sName, oParameters, bReplace) {
        if (sName === "topic" && oParameters) {
          if (oParameters.path && !oParameters["path*"]) {
            oParameters["path*"] = oParameters.path;
          }
        }
        return fnOrigNavTo(sName, oParameters, bReplace);
      };
      oRouter.initialize();
    }
  });
});
