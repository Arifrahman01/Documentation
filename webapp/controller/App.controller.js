sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/core/Theming",
  "sap/m/MessageToast",
  "sap/m/StandardListItem",
  "sap/m/Button",
  "sap/m/FormattedText"
], function (Controller, Fragment, Theming, MessageToast, StandardListItem, Button, FormattedText) {
  "use strict";

  return Controller.extend("doc.portal.controller.App", {

    /* =========================================================== */
    /* Lifecycle Methods                                           */
    /* =========================================================== */

    onInit: function () {
      var oRouter = this.getOwnerComponent().getRouter();
      this._lastTopicPath = "get-started/quick-start";
      this._aAiMessages = [];

      // Track router matches
      oRouter.attachRouteMatched(this._onRouteMatched, this);

      // Apply saved theme to prism syntax highlighter
      var sSavedTheme = localStorage.getItem("portal_theme") || "sap_horizon";
      this._updatePrismTheme(sSavedTheme);

      // Register global keyboard shortcuts (Ctrl+K for search, Ctrl+J for AI Copilot)
      this._registerKeyboardShortcuts();
    },

    _registerKeyboardShortcuts: function () {
      document.addEventListener("keydown", function (e) {
        var bModifier = e.ctrlKey || e.metaKey;
        if (!bModifier) return;

        if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          this.onShellSearchPressed();
        } else if (e.key === "j" || e.key === "J") {
          e.preventDefault();
          this.onOpenAiCopilot();
        }
      }.bind(this));
    },

    /* =========================================================== */
    /* Routing & Navigation Handlers                               */
    /* =========================================================== */

    _onRouteMatched: function (oEvent) {
      var sRouteName = oEvent.getParameter("name");
      var oAppView = this.getModel("appView");
      if (!oAppView) return;

      if (sRouteName === "home" || sRouteName === "homeDirect") {
        oAppView.setProperty("/selectedTab", "home");
        oAppView.setProperty("/isSideExpanded", false);
        oAppView.setProperty("/selectedTopicKey", "");
      } else if (sRouteName === "topic" || sRouteName === "topicRoot") {
        var oArgs = oEvent.getParameter("arguments") || {};
        var sPath = oArgs.path || oArgs["path*"] || "";

        if (sPath) {
          this._lastTopicPath = sPath;
          oAppView.setProperty("/selectedTopicKey", sPath);
        } else if (sRouteName === "topicRoot" || !sPath) {
          this.getOwnerComponent().getRouter().navTo("topic", {
            path: this._lastTopicPath || "get-started/quick-start"
          }, true);
        }

        var isApi = (this._lastTopicPath && this._lastTopicPath.indexOf("api-reference") === 0);
        oAppView.setProperty("/selectedTab", isApi ? "api" : "documentation");
        oAppView.setProperty("/isSideExpanded", true);
      } else if (sRouteName === "apps" || sRouteName === "demoapps") {
        oAppView.setProperty("/selectedTab", "apps");
        oAppView.setProperty("/isSideExpanded", false);
        oAppView.setProperty("/selectedTopicKey", "");
      } else if (sRouteName === "resources") {
        oAppView.setProperty("/selectedTab", "resources");
        oAppView.setProperty("/isSideExpanded", false);
        oAppView.setProperty("/selectedTopicKey", "");
      }

      this._updateActiveNavTab(sRouteName);
    },

    _updateActiveNavTab: function (sRouteName) {
      var aTabs = ["navTabHome", "navTabDocumentation", "navTabApi", "navTabApps", "navTabResources"];
      var mTabMap = {
        "home": "navTabHome",
        "homeDirect": "navTabHome",
        "apps": "navTabApps",
        "demoapps": "navTabApps",
        "resources": "navTabResources"
      };

      var sTargetId = mTabMap[sRouteName];
      if (!sTargetId) {
        if (sRouteName === "topic" || sRouteName === "topicRoot") {
          var isApi = (this._lastTopicPath && this._lastTopicPath.indexOf("api-reference") === 0);
          sTargetId = isApi ? "navTabApi" : "navTabDocumentation";
        } else {
          sTargetId = "navTabHome";
        }
      }

      aTabs.forEach(function (sId) {
        var oBtn = this.byId(sId);
        if (oBtn) {
          if (sId === sTargetId) {
            oBtn.addStyleClass("sdkNavTabActive");
          } else {
            oBtn.removeStyleClass("sdkNavTabActive");
          }
        }
      }.bind(this));
    },

    onNavHome: function () {
      this.getOwnerComponent().getRouter().navTo("home");
    },

    onNavDocumentation: function () {
      var sPath = this._lastTopicPath;
      if (!sPath || sPath.indexOf("api-reference") === 0) {
        sPath = "get-started/quick-start";
      }
      this.getOwnerComponent().getRouter().navTo("topic", { path: sPath });
    },

    onNavApiReference: function () {
      this.getOwnerComponent().getRouter().navTo("topic", { path: "api-reference/api-overview" });
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

    onToggleSideNav: function () {
      var oAppView = this.getModel("appView");
      var bCurrent = oAppView.getProperty("/isSideExpanded");
      oAppView.setProperty("/isSideExpanded", !bCurrent);
    },

    /* =========================================================== */
    /* Theme & Shell Bar Controls                                  */
    /* =========================================================== */

    onShowVersionDialog: function () {
      MessageToast.show("Documentation Portal v2025 (OpenUI5 1.120 LTS)");
    },

    onHeaderAction: function () {
      MessageToast.show("Portal Action");
    },

    onToggleTheme: function () {
      var oAppView = this.getModel("appView");
      var sCurrent = oAppView.getProperty("/selectedTheme");
      var sNewTheme = (sCurrent === "sap_horizon_dark") ? "sap_horizon" : "sap_horizon_dark";

      Theming.setTheme(sNewTheme);
      oAppView.setProperty("/selectedTheme", sNewTheme);
      localStorage.setItem("portal_theme", sNewTheme);
      this._updatePrismTheme(sNewTheme);

      MessageToast.show(sNewTheme === "sap_horizon_dark" ? "Mode Gelap aktif" : "Mode Terang aktif");
    },

    _updatePrismTheme: function (sTheme) {
      var oLink = document.getElementById("prismThemeLink");
      if (oLink) {
        oLink.href = (sTheme === "sap_horizon_dark") ? "lib/prism/prism-dark.css" : "lib/prism/prism.css";
      }
    },

    /* =========================================================== */
    /* Global Search Dialog                                        */
    /* =========================================================== */

    onShellSearchPressed: function () {
      var that = this;
      if (!this._oSearchDialog) {
        return Fragment.load({
          id: this.getView().getId(),
          name: "doc.portal.view.fragment.SearchDialog",
          controller: this
        }).then(function (oDialog) {
          that._oSearchDialog = oDialog;
          that.getView().addDependent(oDialog);
          that._oSearchDialog.open();
          that._focusSearchInput();
          return oDialog;
        });
      } else {
        this._oSearchDialog.open();
        this._focusSearchInput();
        return Promise.resolve(this._oSearchDialog);
      }
    },

    _focusSearchInput: function () {
      setTimeout(function () {
        var oInput = this.byId("shellSearchField");
        if (oInput) oInput.focus();
      }.bind(this), 300);
    },

    onCloseSearchDialog: function () {
      if (this._oSearchDialog) {
        this._oSearchDialog.close();
      }
    },

    onGlobalSearch: function (oEvent) {
      var sQuery = oEvent.getParameter("query");
      this.onShellSearchPressed();
      if (sQuery && sQuery.trim().length >= 2) {
        setTimeout(function () {
          var oInput = this.byId("shellSearchField");
          if (oInput) {
            oInput.setValue(sQuery);
            this._doSearch(sQuery);
          }
        }.bind(this), 350);
      }
    },

    onExecuteSearch: function (oEvent) {
      this._doSearch(oEvent.getParameter("query"));
    },

    onExecuteSearchLive: function (oEvent) {
      this._doSearch(oEvent.getParameter("newValue"));
    },

    onSelectSearchResult: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) return;

      if (oItem.data("isAiPrompt")) {
        var sPrompt = oItem.data("query");
        this.onCloseSearchDialog();
        this.onOpenAiCopilot(sPrompt);
        return;
      }

      var sPath = oItem.data("path");
      if (sPath) {
        this.getOwnerComponent().getRouter().navTo("topic", { path: sPath });
      }
      this.onCloseSearchDialog();
    },

    _doSearch: function (sQuery) {
      var oSearchList = this.byId("shellSearchList");
      if (!oSearchList) return;

      var oDocsModel = this.getModel("docs");
      var aAllArticles = (oDocsModel.getData() && oDocsModel.getData().articles) || [];

      if (!sQuery || sQuery.trim().length < 2) {
        oSearchList.destroyItems();
        return;
      }

      var sQ = sQuery.toLowerCase();
      var aResults = aAllArticles.filter(function (art) {
        return (art.title && art.title.toLowerCase().indexOf(sQ) >= 0) ||
               (art.category && art.category.toLowerCase().indexOf(sQ) >= 0) ||
               (art.snippet && art.snippet.toLowerCase().indexOf(sQ) >= 0);
      }).slice(0, 7);

      oSearchList.destroyItems();

      // Proactive AI Search Recommendation
      var oAiSearchItem = new StandardListItem({
        title: "✨ Tanya AI: \"" + sQuery + "\"",
        description: "Dapatkan analisis cerdas langsung dari AI Copilot",
        icon: "sap-icon://learning-assistant",
        type: "Active"
      }).addStyleClass("sdkSearchAiItem");
      oAiSearchItem.data("isAiPrompt", true);
      oAiSearchItem.data("query", sQuery);
      oSearchList.addItem(oAiSearchItem);

      // Direct Documentation Matches
      if (aResults.length === 0) {
        oSearchList.addItem(new StandardListItem({
          title: "Tidak ada halaman yang cocok persis",
          description: "Gunakan pilihan AI di atas untuk mendapatkan panduan otomatis.",
          type: "Inactive"
        }));
      } else {
        aResults.forEach(function (res) {
          var oItem = new StandardListItem({
            title: res.title,
            description: res.category || "Documentation",
            icon: "sap-icon://document-text",
            type: "Active"
          });
          oItem.data("path", res.path);
          oSearchList.addItem(oItem);
        });
      }
    },

    /* =========================================================== */
    /* AI Copilot Dialog                                           */
    /* =========================================================== */

    onOpenAiCopilot: function (sInitialPrompt) {
      var that = this;
      if (!this._oAiDialog) {
        return Fragment.load({
          id: this.getView().getId(),
          name: "doc.portal.view.fragment.AiCopilotDialog",
          controller: this
        }).then(function (oDialog) {
          that._oAiDialog = oDialog;
          that.getView().addDependent(oDialog);
          that._setupAiDialogInitialState();
          that._openAiDialog(sInitialPrompt);
          return oDialog;
        });
      } else {
        this._openAiDialog(sInitialPrompt);
        return Promise.resolve(this._oAiDialog);
      }
    },

    _setupAiDialogInitialState: function () {
      // Append initial assistant greeting
      this._appendChatBubble(
        "assistant",
        "Halo! Saya adalah **AI Copilot** (Gemini 3.8 Flash Medium). Saya siap membantu Anda mengenai:\n" +
        "* Panduan teknis & navigasi sistem aplikasi enterprise\n" +
        "* Arsitektur integrasi **SAPUI5, CDS Views, ABAP RAP & Nginx**\n" +
        "* Tanya jawab & ringkasan dokumen yang sedang dibuka.\n\n" +
        "Silakan klik salah satu pertanyaan cepat di bawah atau ketik pertanyaan Anda!"
      );
    },

    _openAiDialog: function (sInitialPrompt) {
      this._updateAiContextLabel();
      this._oAiDialog.open();

      var oInput = this.byId("aiInput");
      if (sInitialPrompt && typeof sInitialPrompt === "string") {
        if (oInput) oInput.setValue(sInitialPrompt);
        this._sendAiQuestion(sInitialPrompt);
      } else {
        setTimeout(function () {
          if (oInput) oInput.focus();
        }, 300);
      }
    },

    onCloseAiDialog: function () {
      if (this._oAiDialog) {
        this._oAiDialog.close();
      }
    },

    onClearAiChat: function () {
      this._aAiMessages = [];
      var oMessagesBox = this.byId("aiMessagesBox");
      if (oMessagesBox) {
        oMessagesBox.destroyItems();
      }
      this._appendChatBubble("assistant", "Riwayat percakapan telah dibersihkan. Silakan tanyakan hal baru seputar program dan dokumentasi.");
      MessageToast.show("Riwayat percakapan dibersihkan");
    },

    onSendAiQuestionFromInput: function (oEvt) {
      this._sendAiQuestion(oEvt.getParameter("value"));
    },

    onSendAiQuestionFromButton: function () {
      var oInput = this.byId("aiInput");
      if (oInput) {
        this._sendAiQuestion(oInput.getValue());
      }
    },

    _updateAiContextLabel: function () {
      var oContextText = this.byId("aiContextText");
      if (!oContextText) return;

      var oAppView = this.getModel("appView");
      var sTab = oAppView ? oAppView.getProperty("/selectedTab") : "home";
      var sTopicKey = oAppView ? oAppView.getProperty("/selectedTopicKey") : "";

      var aPrompts = [];
      if (sTab === "documentation" && sTopicKey) {
        oContextText.setText("📄 Konteks Dokumen: " + sTopicKey);
        aPrompts = [
          "⚡ Rangkum konsep utama dokumen ini",
          "💻 Buatkan contoh kode implementasi",
          "⚠️ Potensi masalah teknis & solusinya",
          "🔍 Best practices enterprise"
        ];
      } else if (sTab === "apps") {
        oContextText.setText("🚀 Konteks: Program Navigator (7 Apps Aktif)");
        aPrompts = [
          "🚗 Alur kerja Fuel Management System (FMS)",
          "📊 Integrasi CDS Views ke SAC Dev & Prod",
          "💼 Alur approval di Marketing System",
          "🛡️ Modul K3 di KPI Safety (SHE)",
          "💳 Mekanisme validasi penagihan PPPN"
        ];
      } else if (sTab === "resources") {
        oContextText.setText("🛠️ Konteks: Developer Resources & SDK");
        aPrompts = [
          "📖 Arsitektur SAPUI5 Evening Horizon",
          "🔧 Panduan CLI & tooling deployment",
          "🌐 Reverse proxy Nginx & SSL configuration",
          "💡 Security guidelines & CSRF protection"
        ];
      } else {
        oContextText.setText("🏢 Konteks: Portal Dokumentasi & Sistem Enterprise");
        aPrompts = [
          "🚗 Apa fungsi FMS & linknya?",
          "📊 Cara integrasi CDS ke SAC?",
          "🛡️ Modul K3 di KPI Safety (SHE)",
          "💳 Apa fungsi PPPN?",
          "📁 Akses File Manager Enterprise"
        ];
      }

      this._renderPromptChips(aPrompts);
    },

    _renderPromptChips: function (aPrompts) {
      var oChipsBar = this.byId("aiPromptChipsBar");
      if (!oChipsBar) return;

      oChipsBar.destroyItems();
      var that = this;

      aPrompts.forEach(function (sP) {
        var oBtn = new Button({
          text: sP,
          type: "Transparent",
          press: function () {
            var oInput = that.byId("aiInput");
            if (oInput) oInput.setValue(sP);
            that._sendAiQuestion(sP);
          }
        }).addStyleClass("sdkAiChipBtn");

        oChipsBar.addItem(oBtn);
      });
    },

    _appendChatBubble: function (sRole, sText) {
      var oMessagesBox = this.byId("aiMessagesBox");
      if (!oMessagesBox) return null;

      var isUser = (sRole === "user");
      var sHtml = isUser
        ? ("<strong>Anda:</strong><br>" + sText)
        : (window.markdownit ? window.markdownit().render(sText) : sText);

      var oBubble = new FormattedText({
        htmlText: sHtml
      }).addStyleClass(isUser ? "sdkAiMsgUser" : "sdkAiMsgAssistant");

      oMessagesBox.addItem(oBubble);

      setTimeout(function () {
        var oDom = document.getElementById(this.byId("aiChatScroll").getId());
        if (oDom) {
          if (window.Prism) {
            window.Prism.highlightAllUnder(oDom);
          }
          oDom.scrollTop = oDom.scrollHeight;
        }
      }.bind(this), 60);

      return oBubble;
    },

    _sendAiQuestion: function (sText) {
      if (!sText || !sText.trim()) return;

      var sClean = sText.trim();
      var oInput = this.byId("aiInput");
      if (oInput) oInput.setValue("");

      // Append user bubble and record in thread history
      this._appendChatBubble("user", sClean);
      this._aAiMessages.push({ role: "user", content: sClean });

      // Append thinking bubble
      var oThinkingBubble = this._appendChatBubble("assistant", "<em>⏳ AI Copilot sedang menyusun jawaban...</em>");

      var that = this;
      var oAppView = this.getModel("appView");
      var sTab = oAppView ? oAppView.getProperty("/selectedTab") : "home";
      var sTopicKey = oAppView ? oAppView.getProperty("/selectedTopicKey") : "";

      var fnFetchAi = function (sDocContext) {
        fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: that._aAiMessages,
            documentContext: sDocContext || "",
            currentRoute: sTab + (sTopicKey ? (" / " + sTopicKey) : ""),
            model: "gemini-3.8-flash-medium"
          })
        })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var sReply = data.message || "Maaf, tidak menerima jawaban dari AI.";
          that._aAiMessages.push({ role: "assistant", content: sReply });

          var sHtml = window.markdownit ? window.markdownit().render(sReply) : sReply;
          oThinkingBubble.setHtmlText(sHtml);

          setTimeout(function () {
            var oScroll = that.byId("aiChatScroll");
            if (oScroll && oScroll.getDomRef()) {
              if (window.Prism) {
                window.Prism.highlightAllUnder(oScroll.getDomRef());
              }
              oScroll.getDomRef().scrollTop = oScroll.getDomRef().scrollHeight;
            }
          }, 80);
        })
        .catch(function (err) {
          oThinkingBubble.setHtmlText("<span style='color: #ef4444;'>⚠️ Gagal menghubungi server AI: " + err.message + "</span>");
        });
      };

      if (sTopicKey) {
        fetch("./docs/" + sTopicKey + ".md")
          .then(function (r) { return r.text(); })
          .then(function (text) { fnFetchAi(text); })
          .catch(function () { fnFetchAi(""); });
      } else {
        fnFetchAi("");
      }
    },

    /* =========================================================== */
    /* Utilities & Model Access                                    */
    /* =========================================================== */

    getModel: function (sName) {
      return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
    }
  });
});
