sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/Link",
  "sap/m/MessageToast",
  "doc/portal/util/Utils"
], function (Controller, JSONModel, Filter, FilterOperator, Link, MessageToast, Utils) {
  "use strict";

  return Controller.extend("doc.portal.controller.Topic", {
    onInit: function () {
      var oTopicViewModel = new JSONModel({
        title: "Loading...",
        category: "",
        filename: "",
        prevTitle: "Previous",
        nextTitle: "Next",
        hasPrev: false,
        hasNext: false,
        prevPath: "",
        nextPath: "",
        headings: [],
        hasHeadings: false,
        matchCountText: "8 topics available",
        hasAiSummary: false,
        aiSummaryHtml: "",
        isAiLoading: false
      });
      this.getView().setModel(oTopicViewModel, "topicView");

      var oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("topic").attachPatternMatched(this._onTopicMatched, this);
    },

    _onTopicMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      var sPath = oArgs.path || oArgs["path*"] || "";
      if (sPath) {
        this._loadTopicByPath(sPath);
      }
    },

    _loadTopicByPath: function (sPath) {
      this._currentPath = sPath;
      var oDocsModel = this.getOwnerComponent().getModel("docs");
      var oData = oDocsModel ? oDocsModel.getData() : null;

      // Reset headings
      this.getView().getModel("topicView").setProperty("/headings", []);
      this.getView().getModel("topicView").setProperty("/hasHeadings", false);

      var fnLoad = function (aArticles) {
        this._loadTopicData(sPath, aArticles);
      }.bind(this);

      if (oData && oData.articles && oData.articles.length > 0) {
        fnLoad(oData.articles);
      } else if (oDocsModel) {
        var fnCheckLoaded = function () {
          var oNewData = oDocsModel.getData();
          if (oNewData && oNewData.articles && oNewData.articles.length > 0) {
            fnLoad(oNewData.articles);
          }
        }.bind(this);
        oDocsModel.attachRequestCompleted(fnCheckLoaded);
        setTimeout(fnCheckLoaded, 300);
        setTimeout(fnCheckLoaded, 800);
      }

      // Set src on MarkdownViewer
      var sFileUrl = "./docs/" + sPath + ".md";
      var oViewer = this.byId("markdownViewer");
      if (oViewer) {
        oViewer.setSrc(sFileUrl);
      }

      // Expand matching branch and highlight in Tree
      setTimeout(function () {
        this._highlightTreeNode(sPath);
      }.bind(this), 250);
    },

    _loadTopicData: function (sPath, aArticles) {
      var oTopicView = this.getView().getModel("topicView");
      var nIndex = -1;

      for (var i = 0; i < aArticles.length; i++) {
        if (aArticles[i].path === sPath) {
          nIndex = i;
          break;
        }
      }

      var oCurrent = nIndex >= 0 ? aArticles[nIndex] : null;

      if (oCurrent) {
        oTopicView.setProperty("/title", oCurrent.title);
        oTopicView.setProperty("/category", oCurrent.category || "");
        oTopicView.setProperty("/filename", sPath.split("/").pop() + ".md");

        // Rebuild Breadcrumbs
        this._buildBreadcrumbs(oCurrent);
      } else {
        // Fallback title from path
        var sFallbackTitle = sPath.split("/").pop().replace(/-/g, " ");
        sFallbackTitle = sFallbackTitle.charAt(0).toUpperCase() + sFallbackTitle.slice(1);
        oTopicView.setProperty("/title", sFallbackTitle);
        oTopicView.setProperty("/filename", sPath.split("/").pop() + ".md");
      }

      // Prev & Next Calculation
      var bHasPrev = nIndex > 0;
      var bHasNext = nIndex >= 0 && nIndex < aArticles.length - 1;

      oTopicView.setProperty("/hasPrev", bHasPrev);
      oTopicView.setProperty("/hasNext", bHasNext);

      if (bHasPrev) {
        oTopicView.setProperty("/prevTitle", aArticles[nIndex - 1].title);
        oTopicView.setProperty("/prevPath", aArticles[nIndex - 1].path);
      } else {
        oTopicView.setProperty("/prevTitle", "Previous");
        oTopicView.setProperty("/prevPath", "");
      }

      if (bHasNext) {
        oTopicView.setProperty("/nextTitle", aArticles[nIndex + 1].title);
        oTopicView.setProperty("/nextPath", aArticles[nIndex + 1].path);
      } else {
        oTopicView.setProperty("/nextTitle", "Next");
        oTopicView.setProperty("/nextPath", "");
      }
    },

    _buildBreadcrumbs: function (oArticle) {
      var oBreadcrumbs = this.byId("topicBreadcrumbs");
      if (!oBreadcrumbs) return;

      oBreadcrumbs.destroyLinks();

      // 1. Documentation root link
      oBreadcrumbs.addLink(new Link({
        text: "Documentation",
        press: this.onNavDocumentationRoot.bind(this)
      }));

      // 2. Category link
      if (oArticle.category) {
        oBreadcrumbs.addLink(new Link({
          text: oArticle.category,
          enabled: false
        }));
      }
    },

    _highlightTreeNode: function (sPath) {
      var oTree = this.byId("topicNavTree");
      if (!oTree) return;

      // Expand first level so category children are rendered and selectable
      oTree.expandToLevel(1);

      setTimeout(function () {
        var aItems = oTree.getItems();
        for (var i = 0; i < aItems.length; i++) {
          var oCtx = aItems[i].getBindingContext("docs");
          if (oCtx && oCtx.getProperty("path") === sPath) {
            oTree.setSelectedItem(aItems[i], true);
            break;
          }
        }
      }, 100);
    },

    onSelectTreeNode: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) return;

      var oCtx = oItem.getBindingContext("docs");
      if (oCtx) {
        var sPath = oCtx.getProperty("path");
        if (!sPath) {
          var aNodes = oCtx.getProperty("nodes");
          if (aNodes && aNodes.length > 0 && aNodes[0].path) {
            sPath = aNodes[0].path;
          }
        }
        if (sPath) {
          this.getOwnerComponent().getRouter().navTo("topic", {
            path: sPath
          });
        }
      }
    },

    onFilterTree: function (oEvent) {
      var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
      var oTree = this.byId("topicNavTree");
      if (!oTree) return;

      var oBinding = oTree.getBinding("items");
      if (!oBinding) return;

      var oTopicView = this.getView().getModel("topicView");

      if (sQuery.trim().length > 0) {
        var oFilter = new Filter("title", FilterOperator.Contains, sQuery.trim());
        oBinding.filter([oFilter]);
        oTree.expandAll();
        oTopicView.setProperty("/matchCountText", "Filtering: '" + sQuery + "'");
      } else {
        oBinding.filter([]);
        oTopicView.setProperty("/matchCountText", "8 topics available");
      }
    },

    onSummarizeTopic: function () {
      var oTopicView = this.getView().getModel("topicView");
      var sTitle = oTopicView.getProperty("/title") || "Initialization Process";
      var sPath = this._currentPath;
      if (!sPath) {
        var oRouter = this.getOwnerComponent().getRouter();
        var sHash = oRouter && oRouter.getHashChanger ? oRouter.getHashChanger().getHash() : "";
        sPath = (sHash && sHash.indexOf("topic/") === 0) ? sHash.replace(/^topic\//, "") : "essentials/initialization-process";
      }

      MessageToast.show("Menghubungi AI Copilot...");
      oTopicView.setProperty("/hasAiSummary", true);
      oTopicView.setProperty("/aiSummaryHtml", "<div class='sdkAiSummaryBody' style='color: #38bdf8; padding: 0.5rem 0;'><em>⏳ AI Copilot sedang menganalisis dokumen dan menyusun ringkasan eksekutif...</em></div>");

      fetch("./docs/" + sPath + ".md")
        .then(function (res) {
          if (!res.ok) {
            throw new Error("Gagal membaca dokumen (" + res.status + " " + res.statusText + ")");
          }
          return res.text();
        })
        .then(function (sMarkdown) {
          return fetch("/api/ai/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: sTitle,
              content: sMarkdown
            })
          });
        })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var sAiReply = data.message || "Gagal mendapatkan ringkasan.";
          var sHtml = window.markdownit ? window.markdownit().render(sAiReply) : sAiReply;
          oTopicView.setProperty("/aiSummaryHtml", "<div class='sdkAiSummaryBody'>" + sHtml + "</div>");
        })
        .catch(function (err) {
          oTopicView.setProperty("/aiSummaryHtml", "<div class='sdkAiSummaryBody' style='color: #ef4444;'>Gagal membuat ringkasan: " + err.message + "</div>");
        });
    },

    onAskAiAboutTopic: function () {
      var oTopicView = this.getView().getModel("topicView");
      var sTitle = oTopicView.getProperty("/title") || "Dokumen Ini";
      
      // Access root App Controller
      var oComponent = this.getOwnerComponent();
      var oRootControl = oComponent.getRootControl();
      var oAppController = oRootControl ? oRootControl.getController() : null;

      var sPrompt = "Jelaskan konsep inti, contoh implementasi dan best practices untuk: " + sTitle;
      if (oAppController && typeof oAppController.onOpenAiCopilot === "function") {
        oAppController.onOpenAiCopilot(sPrompt);
      } else {
        MessageToast.show("Membuka AI Copilot...");
      }
    },

    onCloseAiSummary: function () {
      this.getView().getModel("topicView").setProperty("/hasAiSummary", false);
    },

    onCollapseAll: function () {
      var oTree = this.byId("topicNavTree");
      if (oTree) {
        oTree.collapseAll();
      }
    },

    onExpandAll: function () {
      var oTree = this.byId("topicNavTree");
      if (oTree) {
        oTree.expandAll();
      }
    },

    onNavDocumentationRoot: function () {
      this.getOwnerComponent().getRouter().navTo("topic", {
        path: "essentials/initialization-process"
      });
    },

    onNavPrev: function () {
      var sPrevPath = this.getView().getModel("topicView").getProperty("/prevPath");
      if (sPrevPath) {
        this.getOwnerComponent().getRouter().navTo("topic", { path: sPrevPath });
      }
    },

    onNavNext: function () {
      var sNextPath = this.getView().getModel("topicView").getProperty("/nextPath");
      if (sNextPath) {
        this.getOwnerComponent().getRouter().navTo("topic", { path: sNextPath });
      }
    },

    onCopyTopicLink: function () {
      var sUrl = window.location.href;
      Utils.copyToClipboard(sUrl).then(function () {
        MessageToast.show("Link copied to clipboard!");
      }).catch(function (err) {
        MessageToast.show("Gagal menyalin link: " + (err.message || err));
      });
    },

    onFooterAction: function () {
      MessageToast.show("SAP Standard Policy Information");
    },

    onContentLoaded: function (oEvent) {
      var aHeadings = oEvent.getParameter("headings") || [];
      var oTopicView = this.getView().getModel("topicView");
      oTopicView.setProperty("/headings", aHeadings);
      oTopicView.setProperty("/hasHeadings", aHeadings.length > 0);

      // Scroll detail pane to top
      var oScrollContainer = this.byId("sdkContentScrollContainer");
      if (oScrollContainer && oScrollContainer.getDomRef()) {
        oScrollContainer.getDomRef().scrollTop = 0;
      }
    },

    onScrollToHeading: function (oEvent) {
      var oItem = oEvent.getSource().getBindingContext("topicView").getObject();
      if (oItem && oItem.id) {
        var elem = document.getElementById(oItem.id);
        if (elem) {
          elem.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    },

    onLoadFailed: function (oEvent) {
      var sError = oEvent.getParameter("error");
      MessageToast.show("Failed to load document: " + sError);
    }
  });
});
