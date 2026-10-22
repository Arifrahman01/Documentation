sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Theming",
  "sap/m/MessageToast",
  "sap/m/Dialog",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/SearchField",
  "sap/m/Toolbar",
  "sap/m/ToolbarSpacer",
  "sap/m/Button",
  "sap/m/Input",
  "sap/m/FormattedText",
  "sap/m/ScrollContainer",
  "sap/m/VBox",
  "sap/m/HBox",
  "sap/m/Title",
  "sap/m/Text",
  "sap/m/ObjectStatus",
  "sap/ui/core/Icon"
], function (Controller, Theming, MessageToast, Dialog, List, StandardListItem, SearchField, Toolbar, ToolbarSpacer, Button, Input, FormattedText, ScrollContainer, VBox, HBox, Title, Text, ObjectStatus, Icon) {
  "use strict";

  return Controller.extend("doc.portal.controller.App", {
    onInit: function () {
      var oComponent = this.getOwnerComponent();
      var oRouter = oComponent.getRouter();
      this._lastTopicPath = "essentials/initialization-process";

      // Track router matches
      oRouter.attachRouteMatched(this._onRouteMatched, this);

      // Apply saved theme to prism
      var sSavedTheme = localStorage.getItem("portal_theme") || "sap_horizon";
      this._updatePrismTheme(sSavedTheme);

      // Register global Ctrl+K shortcut for search and Ctrl+J for AI Copilot
      document.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          this.onShellSearchPressed();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === "j" || e.key === "J")) {
          e.preventDefault();
          this.onOpenAiCopilot();
        }
      }.bind(this));
    },

    _onRouteMatched: function (oEvent) {
      var sRouteName = oEvent.getParameter("name");
      var oAppView = this.getModel("appView");
      if (!oAppView) return;

      if (sRouteName === "home" || sRouteName === "homeDirect") {
        oAppView.setProperty("/selectedTab", "home");
        oAppView.setProperty("/isSideExpanded", false);
        oAppView.setProperty("/selectedTopicKey", "");
      } else if (sRouteName === "topic" || sRouteName === "topicRoot") {
        oAppView.setProperty("/selectedTab", "documentation");
        oAppView.setProperty("/isSideExpanded", true);

        var oArgs = oEvent.getParameter("arguments") || {};
        var sPath = oArgs.path || oArgs["path*"] || "";
        if (sPath) {
          this._lastTopicPath = sPath;
          oAppView.setProperty("/selectedTopicKey", sPath);
        } else if (sRouteName === "topicRoot" || !sPath) {
          this.getOwnerComponent().getRouter().navTo("topic", {
            path: this._lastTopicPath || "essentials/initialization-process"
          }, true);
        }
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
        "topic": "navTabDocumentation",
        "topicRoot": "navTabDocumentation",
        "apps": "navTabApps",
        "demoapps": "navTabApps",
        "resources": "navTabResources"
      };
      var sTargetId = mTabMap[sRouteName] || "navTabHome";

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
      this.getOwnerComponent().getRouter().navTo("topic", {
        path: this._lastTopicPath || "essentials/initialization-process"
      });
    },

    onNavApiReference: function () {
      this.getOwnerComponent().getRouter().navTo("topic", {
        path: "essentials/model-view-controller"
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

    onToggleSideNav: function () {
      var oAppView = this.getModel("appView");
      var bCurrent = oAppView.getProperty("/isSideExpanded");
      oAppView.setProperty("/isSideExpanded", !bCurrent);
    },

    onShowVersionDialog: function () {
      MessageToast.show("OpenUI5 Version 1.120.0 (LTS)");
    },

    onHeaderAction: function () {
      MessageToast.show("UI5 Demo Kit Standard Action");
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

    onShellSearchPressed: function () {
      if (!this._oSearchDialog) {
        var that = this;
        this._oSearchInput = new SearchField({
          placeholder: "Search documentation, apps, or ask AI... (Ctrl+K)",
          width: "100%",
          search: function (oEvt) {
            that._doSearch(oEvt.getParameter("query"));
          },
          liveChange: function (oEvt) {
            that._doSearch(oEvt.getParameter("newValue"));
          }
        });

        this._oSearchList = new List({
          mode: "None",
          itemPress: function (oEvt) {
            var oItem = oEvt.getParameter("listItem");
            if (oItem.data("isAiPrompt")) {
              var sPrompt = oItem.data("query");
              that._oSearchDialog.close();
              that.onOpenAiCopilot(sPrompt);
              return;
            }
            var sPath = oItem.data("path");
            if (sPath) {
              that.getOwnerComponent().getRouter().navTo("topic", { path: sPath });
            }
            that._oSearchDialog.close();
          }
        });

        this._oSearchDialog = new Dialog({
          title: "Search Documentation & System",
          contentWidth: "580px",
          contentHeight: "440px",
          subHeader: new Toolbar({
            content: [this._oSearchInput]
          }),
          content: [this._oSearchList],
          endButton: new Button({
            text: "Close",
            press: function () {
              that._oSearchDialog.close();
            }
          })
        });

        this.getView().addDependent(this._oSearchDialog);
      }

      this._oSearchDialog.open();
      setTimeout(function () {
        if (this._oSearchInput) {
          this._oSearchInput.focus();
        }
      }.bind(this), 300);
    },

    onGlobalSearch: function (oEvent) {
      var sQuery = oEvent.getParameter("query");
      this.onShellSearchPressed();
      if (sQuery && sQuery.trim().length >= 2) {
        setTimeout(function () {
          if (this._oSearchInput) {
            this._oSearchInput.setValue(sQuery);
            this._doSearch(sQuery);
          }
        }.bind(this), 350);
      }
    },

    _doSearch: function (sQuery) {
      var oDocsModel = this.getModel("docs");
      var aAllArticles = (oDocsModel.getData() && oDocsModel.getData().articles) || [];

      if (!sQuery || sQuery.trim().length < 2) {
        if (this._oSearchList) this._oSearchList.destroyItems();
        return;
      }

      var sQ = sQuery.toLowerCase();
      var aResults = aAllArticles.filter(function (art) {
        return (art.title && art.title.toLowerCase().indexOf(sQ) >= 0) ||
               (art.category && art.category.toLowerCase().indexOf(sQ) >= 0) ||
               (art.snippet && art.snippet.toLowerCase().indexOf(sQ) >= 0);
      }).slice(0, 7);

      this._oSearchList.destroyItems();

      // 1. Proactive AI Option for every search query
      var oAiSearchItem = new StandardListItem({
        title: "✨ Tanya Jhonlin AI: \"" + sQuery + "\"",
        description: "Dapatkan analisis komprehensif langsung dari AI Copilot",
        icon: "sap-icon://learning-assistant",
        type: "Active"
      }).addStyleClass("sdkSearchAiItem");
      oAiSearchItem.data("isAiPrompt", true);
      oAiSearchItem.data("query", sQuery);
      this._oSearchList.addItem(oAiSearchItem);

      // 2. Direct Documentation matches
      if (aResults.length === 0) {
        this._oSearchList.addItem(new StandardListItem({
          title: "Tidak ada halaman yang cocok persis",
          description: "Klik pilihan AI di atas untuk mendapatkan panduan otomatis.",
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
          this._oSearchList.addItem(oItem);
        }.bind(this));
      }
    },

    onOpenAiCopilot: function (sInitialPrompt) {
      if (!this._oAiDialog) {
        this._initAiDialog();
      }

      this._updateAiContextLabel();
      this._oAiDialog.open();

      if (sInitialPrompt && typeof sInitialPrompt === "string") {
        this._oAiInput.setValue(sInitialPrompt);
        this._sendAiQuestion(sInitialPrompt);
      } else {
        setTimeout(function () {
          if (this._oAiInput) this._oAiInput.focus();
        }.bind(this), 300);
      }
    },

    _updateAiContextLabel: function () {
      if (!this._oAiContextText) return;
      var oAppView = this.getModel("appView");
      var sTab = oAppView ? oAppView.getProperty("/selectedTab") : "home";
      var sTopicKey = oAppView ? oAppView.getProperty("/selectedTopicKey") : "";

      var aPrompts = [];
      if (sTab === "documentation" && sTopicKey) {
        this._oAiContextText.setText("📄 Konteks Dokumen: " + sTopicKey);
        aPrompts = [
          "⚡ Rangkum konsep utama dokumen ini",
          "💻 Buatkan contoh kode implementasi",
          "⚠️ Potensi masalah teknis & solusinya",
          "🔍 Best practices enterprise"
        ];
      } else if (sTab === "apps") {
        this._oAiContextText.setText("🚀 Konteks: Jhonlin Program Navigator (7 Apps Aktif)");
        aPrompts = [
          "🚗 Alur kerja Fuel Management System (FMS)",
          "📊 Integrasi CDS Views ke SAC Dev & Prod",
          "💼 Alur approval di Jhonlin Marketing",
          "🛡️ Modul K3 di KPI Safety (SHE)",
          "💳 Mekanisme validasi penagihan PPPN"
        ];
      } else if (sTab === "resources") {
        this._oAiContextText.setText("🛠️ Konteks: Developer Resources & SDK");
        aPrompts = [
          "📖 Arsitektur SAPUI5 Evening Horizon",
          "🔧 Panduan CLI & tooling deployment",
          "🌐 Reverse proxy Nginx & SSL configuration",
          "💡 Security guidelines & CSRF protection"
        ];
      } else {
        this._oAiContextText.setText("🏢 Konteks: Portal Dokumentasi & Sistem PT Jhonlin Group");
        aPrompts = [
          "🚗 Apa fungsi FMS & linknya?",
          "📊 Cara integrasi CDS ke SAC?",
          "🛡️ Modul K3 di KPI Safety (SHE)",
          "💳 Apa fungsi PPPN?",
          "📁 Akses File Manager Jhonlin"
        ];
      }

      this._renderPromptChips(aPrompts);
    },

    _renderPromptChips: function (aPrompts) {
      if (!this._oPromptChipsBar) return;
      this._oPromptChipsBar.destroyItems();
      var that = this;
      aPrompts.forEach(function (sP) {
        var oBtn = new Button({
          text: sP,
          type: "Transparent",
          press: function () {
            that._oAiInput.setValue(sP);
            that._sendAiQuestion(sP);
          }
        }).addStyleClass("sdkAiChipBtn");
        that._oPromptChipsBar.addItem(oBtn);
      });
    },

    _initAiDialog: function () {
      var that = this;
      this._aAiMessages = [];

      // 1. Header Toolbar
      var oTitle = new Title({ text: "Jhonlin AI Copilot", level: "H3" });
      var oStatus = new ObjectStatus({ text: "● Claude Sonnet (Online)", state: "Success" }).addStyleClass("sdkAiOnlineBadge sapUiSmallMarginBegin");
      var oBtnClear = new Button({
        icon: "sap-icon://delete",
        tooltip: "Bersihkan Riwayat Percakapan",
        type: "Transparent",
        press: function () { that._clearAiChat(); }
      });
      var oBtnClose = new Button({
        icon: "sap-icon://decline",
        tooltip: "Tutup AI Copilot",
        type: "Transparent",
        press: function () { that._oAiDialog.close(); }
      });

      var oHeaderBar = new Toolbar({
        content: [
          new Icon({ src: "sap-icon://learning-assistant", size: "1.2rem", color: "#38bdf8" }),
          oTitle,
          oStatus,
          new ToolbarSpacer(),
          oBtnClear,
          oBtnClose
        ]
      }).addStyleClass("sdkAiHeaderBar");

      // 2. Context Indicator Bar
      this._oAiContextText = new Text({ text: "🏢 Konteks: Portal Dokumentasi PT Jhonlin Group" });
      this._oAiContextBar = new HBox({
        alignItems: "Center",
        items: [this._oAiContextText]
      }).addStyleClass("sdkAiContextBar");

      // 3. Messages Container inside ScrollContainer
      this._oAiMessagesBox = new VBox({}).addStyleClass("sdkAiMessagesBox");
      this._oAiScroll = new ScrollContainer("aiChatScroll", {
        height: "380px",
        vertical: true,
        horizontal: false,
        content: [this._oAiMessagesBox]
      }).addStyleClass("sdkAiChatScroll");

      // 4. Initial Greeting Bubble
      this._appendChatBubble("assistant", "Halo! Saya adalah **Jhonlin AI Copilot** (Claude 4.6). Saya siap membantu Anda mengenai:\n* Panduan teknis & link sistem **FMS, SAC, JMS, SHE, PPPN, & File Manager**\n* Arsitektur integrasi **SAPUI5, CDS Views, ABAP RAP & Nginx**\n* Tanya jawab & ringkasan dokumen yang sedang dibuka.\n\nSilakan klik salah satu pertanyaan cepat di bawah atau ketik pertanyaan Anda!");

      // 5. Prompt Chips Container (populated dynamically)
      this._oPromptChipsBar = new HBox({
        wrap: "Wrap"
      }).addStyleClass("sdkAiPromptChips");

      // 6. Input Bar
      this._oAiInput = new Input({
        placeholder: "Tanya AI Copilot tentang sistem atau dokumentasi... (Enter untuk kirim)",
        width: "100%",
        submit: function (oEvt) {
          that._sendAiQuestion(oEvt.getParameter("value"));
        }
      }).addStyleClass("sdkAiInput");

      var oBtnSend = new Button({
        icon: "sap-icon://paper-plane",
        type: "Emphasized",
        tooltip: "Kirim Pertanyaan",
        press: function () {
          that._sendAiQuestion(that._oAiInput.getValue());
        }
      }).addStyleClass("sdkAiSendBtn");

      var oInputBar = new HBox({
        alignItems: "Center",
        width: "100%",
        items: [this._oAiInput, oBtnSend]
      }).addStyleClass("sdkAiInputBar");

      // 7. Full Dialog
      this._oAiDialog = new Dialog({
        showHeader: false,
        contentWidth: "680px",
        stretch: sap.ui.Device.system.phone,
        content: [
          new VBox({
            items: [oHeaderBar, this._oAiContextBar, this._oAiScroll, this._oPromptChipsBar, oInputBar]
          })
        ]
      }).addStyleClass("sdkAiDialog");

      this.getView().addDependent(this._oAiDialog);
    },

    _appendChatBubble: function (sRole, sText) {
      var isUser = (sRole === "user");
      var sHtml = isUser ? ("<strong>Anda:</strong><br>" + sText) : (window.markdownit ? window.markdownit().render(sText) : sText);

      var oBubble = new FormattedText({
        htmlText: sHtml
      }).addStyleClass(isUser ? "sdkAiMsgUser" : "sdkAiMsgAssistant");

      this._oAiMessagesBox.addItem(oBubble);

      setTimeout(function () {
        var oDom = document.getElementById("aiChatScroll");
        if (oDom) {
          if (window.Prism) {
            window.Prism.highlightAllUnder(oDom);
          }
          oDom.scrollTop = oDom.scrollHeight;
        }
      }, 60);

      return oBubble;
    },

    _sendAiQuestion: function (sText) {
      if (!sText || !sText.trim()) return;

      var sClean = sText.trim();
      this._oAiInput.setValue("");

      // Append user bubble
      this._appendChatBubble("user", sClean);

      // Add to conversation history
      this._aAiMessages.push({ role: "user", content: sClean });

      // Append thinking bubble
      var oThinkingBubble = this._appendChatBubble("assistant", "<em>⏳ Jhonlin AI sedang menyusun jawaban...</em>");

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
            model: "claude-sonnet-4-6"
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
            var oDom = document.getElementById("aiChatScroll");
            if (oDom) {
              if (window.Prism) {
                window.Prism.highlightAllUnder(oDom);
              }
              oDom.scrollTop = oDom.scrollHeight;
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

      // Append thinking bubble
      var oThinkingBubble = this._appendChatBubble("assistant", "<em>⏳ Jhonlin AI sedang menyusun jawaban...</em>");

      var that = this;
      var oAppView = this.getModel("appView");
      var sTopicKey = oAppView ? oAppView.getProperty("/selectedTopicKey") : "";

      var fnFetchAi = function (sDocContext) {
        fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: that._aAiMessages,
            documentContext: sDocContext || "",
            model: "claude-sonnet-4-6"
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
            var oDom = document.getElementById("aiChatScroll");
            if (oDom) oDom.scrollTop = oDom.scrollHeight;
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

    _clearAiChat: function () {
      this._aAiMessages = [];
      this._oAiMessagesBox.destroyItems();
      this._appendChatBubble("assistant", "Riwayat percakapan telah dibersihkan. Silakan tanyakan hal baru seputar program dan dokumentasi PT Jhonlin Group.");
      MessageToast.show("Riwayat percakapan dibersihkan");
    },

    getModel: function (sName) {
      return this.getView().getModel(sName) || this.getOwnerComponent().getModel(sName);
    }
  });
});
