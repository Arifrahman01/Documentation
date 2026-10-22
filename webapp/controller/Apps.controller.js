sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Title",
  "sap/m/Text",
  "sap/m/Button",
  "sap/m/ObjectStatus",
  "sap/ui/core/Icon"
], function (Controller, Filter, FilterOperator, MessageToast, VBox, HBox, Title, Text, Button, ObjectStatus, Icon) {
  "use strict";

  return Controller.extend("doc.portal.controller.Apps", {
    onInit: function () {
      this._sCurrentCategory = "all";
      this._sSearchQuery = "";
    },

    _createAppCard: function (sId, oContext) {
      var oData = oContext.getObject();
      var that = this;

      // 1. Icon in Container
      var oIcon = new Icon({
        src: oData.icon || "sap-icon://grid",
        size: "1.4rem"
      }).addStyleClass("sdkAppIconGlyph " + (oData.iconColor || "sdkIconBlue"));

      var oIconWrap = new HBox({
        alignItems: "Center",
        justifyContent: "Center",
        items: [oIcon]
      }).addStyleClass("sdkAppIconBox");

      // 2. Title & Subtitle
      var oTitle = new Title({
        text: oData.title,
        level: "H3"
      }).addStyleClass("sdkAppCardTitle");

      var oSubtitle = new Text({
        text: oData.subtitle
      }).addStyleClass("sdkAppCardSubtitle");

      var oTitleGroup = new VBox({
        items: [oTitle, oSubtitle]
      }).addStyleClass("sapUiSmallMarginBegin");

      // 3. Status Badge
      var oStatus = new ObjectStatus({
        text: oData.status,
        state: oData.statusState || "None",
        inverted: true
      }).addStyleClass("sdkAppStatusPill");

      // 4. Header Row
      var oHeaderLeft = new HBox({
        alignItems: "Center",
        items: [oIconWrap, oTitleGroup]
      });

      var oHeaderRow = new HBox({
        justifyContent: "SpaceBetween",
        alignItems: "Start",
        width: "100%",
        items: [oHeaderLeft, oStatus]
      }).addStyleClass("sdkAppCardHeader");

      // 5. Description
      var oDesc = new Text({
        text: oData.description
      }).addStyleClass("sdkAppCardDesc sapUiSmallMarginTop");

      // 6. Tags
      var aTagControls = [];
      if (oData.tags && Array.isArray(oData.tags)) {
        oData.tags.forEach(function (sTag) {
          aTagControls.push(new ObjectStatus({
            text: sTag,
            state: "None"
          }).addStyleClass("sdkAppTagPill sapUiTinyMarginEnd sapUiTinyMarginBottom"));
        });
      }

      var oTagsRow = new HBox({
        wrap: "Wrap",
        items: aTagControls
      }).addStyleClass("sdkAppTagsRow sapUiSmallMarginTop");

      // 7. Actions Row
      var oBtnLaunch = new Button({
        text: "Access Program",
        icon: "sap-icon://action",
        iconFirst: false,
        type: "Emphasized",
        press: function (e) {
          e.cancelBubble = true;
          window.open(oData.url, "_blank");
        }
      }).addStyleClass("sdkAppLaunchBtn");

      var oBtnCopy = new Button({
        icon: "sap-icon://copy",
        type: "Transparent",
        tooltip: "Salin Link Program (" + oData.url + ")",
        press: function (e) {
          e.cancelBubble = true;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(oData.url).then(function () {
              MessageToast.show("URL disalin: " + oData.url);
            });
          }
        }
      }).addStyleClass("sdkAppCopyBtn sapUiTinyMarginBegin");

      var oActionsRow = new HBox({
        justifyContent: "SpaceBetween",
        alignItems: "Center",
        width: "100%",
        items: [
          new Text({ text: oData.categoryName || "" }).addStyleClass("sdkAppCategoryLabel"),
          new HBox({ items: [oBtnCopy, oBtnLaunch] })
        ]
      }).addStyleClass("sdkAppActionsRow sapUiMediumMarginTop");

      // 8. Main Card VBox
      var oCard = new VBox(sId, {
        items: [oHeaderRow, oDesc, oTagsRow, oActionsRow]
      }).addStyleClass("sdkAppCard");

      return oCard;
    },

    onSearchApps: function (oEvent) {
      this._sSearchQuery = (oEvent.getParameter("newValue") || oEvent.getParameter("query") || "").trim().toLowerCase();
      this._applyFilters();
    },

    onFilterCategory: function (oEvent) {
      this._sCurrentCategory = oEvent.getParameter("item").getKey();
      this._applyFilters();
    },

    _applyFilters: function () {
      var oGrid = this.byId("appsGrid");
      if (!oGrid) return;

      var oBinding = oGrid.getBinding("content");
      if (!oBinding) return;

      var aFilters = [];

      // Category filter
      if (this._sCurrentCategory && this._sCurrentCategory !== "all") {
        if (this._sCurrentCategory === "finance") {
          aFilters.push(new Filter({
            filters: [
              new Filter("category", FilterOperator.EQ, "finance"),
              new Filter("category", FilterOperator.EQ, "storage")
            ],
            and: false
          }));
        } else {
          aFilters.push(new Filter("category", FilterOperator.EQ, this._sCurrentCategory));
        }
      }

      // Search Query filter
      if (this._sSearchQuery) {
        var sQ = this._sSearchQuery;
        aFilters.push(new Filter({
          filters: [
            new Filter("title", FilterOperator.Contains, sQ),
            new Filter("subtitle", FilterOperator.Contains, sQ),
            new Filter("description", FilterOperator.Contains, sQ),
            new Filter("categoryName", FilterOperator.Contains, sQ)
          ],
          and: false
        }));
      }

      oBinding.filter(aFilters);
    },

    onNavHome: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    }
  });
});