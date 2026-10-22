sap.ui.define([
  "sap/ui/core/Control"
], function (Control) {
  "use strict";

  // Setup global clipboard copy function if not already present
  if (!window._portalCopyCode) {
    window._portalCopyCode = function (sCodeId, oBtn) {
      var oCodeElem = document.getElementById(sCodeId);
      if (!oCodeElem) {
        return;
      }
      var sText = oCodeElem.innerText || oCodeElem.textContent;
      navigator.clipboard.writeText(sText).then(function () {
        var sOriginal = oBtn.innerText;
        oBtn.innerText = "✓ Copied!";
        oBtn.style.background = "#107e3e";
        oBtn.style.color = "#ffffff";
        oBtn.style.borderColor = "#107e3e";
        setTimeout(function () {
          oBtn.innerText = sOriginal;
          oBtn.style.background = "";
          oBtn.style.color = "";
          oBtn.style.borderColor = "";
        }, 2000);
      }).catch(function (err) {
        console.error("Failed to copy text: ", err);
      });
    };
  }

  return Control.extend("doc.portal.control.MarkdownViewer", {
    metadata: {
      properties: {
        src: { type: "string", defaultValue: "" },
        rawContent: { type: "string", defaultValue: "" }
      },
      events: {
        contentLoaded: {
          parameters: {
            headings: { type: "object" }
          }
        },
        loadFailed: { parameters: { error: { type: "string" } } }
      }
    },

    init: function () {
      this._headings = [];
      if (window.markdownit) {
        this._md = window.markdownit({
          html: true,
          linkify: true,
          typographer: true
        });

        // Setup custom code block rendering with Prism
        this._md.renderer.rules.fence = function (tokens, idx, options, env, self) {
          var token = tokens[idx];
          var info = token.info ? token.info.trim() : "";
          var lang = info ? info.split(/\s+/g)[0].toLowerCase() : "text";
          var code = token.content;
          var highlighted = "";

          // Language alias handling
          if (lang === "js") lang = "javascript";
          if (lang === "ps1" || lang === "posh") lang = "powershell";
          if (lang === "sh") lang = "bash";

          if (window.Prism && window.Prism.languages[lang]) {
            try {
              highlighted = window.Prism.highlight(code, window.Prism.languages[lang], lang);
            } catch (e) {
              highlighted = this._md.utils.escapeHtml(code);
            }
          } else {
            highlighted = this._md.utils.escapeHtml(code);
          }

          var codeId = "code_" + Math.random().toString(36).substring(2, 9);

          return '<div class="portalCodeBlockWrapper">' +
                   '<div class="portalCodeHeader">' +
                     '<span>' + (lang.toUpperCase() || "CODE") + '</span>' +
                     '<button class="portalCopyBtn" onclick="window._portalCopyCode(\'' + codeId + '\', this)">📋 Copy</button>' +
                   '</div>' +
                   '<pre><code id="' + codeId + '" class="language-' + lang + '">' + highlighted + '</code></pre>' +
                 '</div>';
        }.bind(this);
      }
    },

    setSrc: function (sSrc) {
      this.setProperty("src", sSrc, true);
      if (sSrc) {
        this._fetchMarkdown(sSrc);
      }
    },

    setRawContent: function (sContent) {
      this.setProperty("rawContent", sContent, true);
      this._renderContent(sContent);
    },

    _fetchMarkdown: function (sUrl) {
      var that = this;
      var oDomRef = this.getDomRef();
      if (oDomRef) {
        oDomRef.innerHTML = '<div class="sapUiMediumMargin" style="color: var(--sapContent_LabelColor);"><span class="sapUiSmallMarginEnd">⏳</span> Loading document...</div>';
      }

      fetch(sUrl)
        .then(function (res) {
          if (!res.ok) {
            throw new Error("HTTP " + res.status + " " + res.statusText);
          }
          return res.text();
        })
        .then(function (sMarkdown) {
          that._renderContent(sMarkdown);
          that.fireContentLoaded({ headings: that._headings });
        })
        .catch(function (err) {
          console.error("Markdown load error:", err);
          if (that.getDomRef()) {
            that.getDomRef().innerHTML = '<div class="portalCallout portalCallout-caution">' +
              '<strong>Failed to load document:</strong> ' + err.message + '<br>' +
              '<small>Path: ' + sUrl + '</small></div>';
          }
          that.fireLoadFailed({ error: err.message });
        });
    },

    _preprocessMarkdown: function (sMarkdown) {
      if (!sMarkdown) return "";

      // 1. Remove YAML frontmatter if present
      var sClean = sMarkdown.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---[\r\n]*/, "");

      // 1b. Remove initial H1 title if present to avoid duplication with page Title control
      sClean = sClean.replace(/^\s*#\s+[^\r\n]+[\r\n]*/, "");

      // 2. Transform Obsidian Image embeds: ![[image.png]] -> ![](docs/attachments/image.png)
      sClean = sClean.replace(/!\[\[(.*?)\]\]/g, function (match, p1) {
        var sFile = p1.trim();
        if (sFile.indexOf("|") >= 0) {
          sFile = sFile.split("|")[0];
        }
        return '![' + sFile + '](./docs/attachments/' + sFile + ')';
      });

      // 3. Transform relative Attachment links: ./Attachment/... or Attachment/...
      sClean = sClean.replace(/\((?:\.?\/)?Attachment\/(.*?)\)/g, '(./docs/attachments/$1)');

      return sClean;
    },

    _postprocessHtml: function (sHtml) {
      if (!sHtml) return "";

      this._headings = [];
      var that = this;

      // Extract and assign IDs to H2 and H3 for "On this page" TOC
      sHtml = sHtml.replace(/<(h[23])>(.*?)<\/\1>/gi, function (match, tag, text) {
        var cleanText = text.replace(/<[^>]*>/g, "").trim();
        var slug = "heading-" + cleanText.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        that._headings.push({
          id: slug,
          text: cleanText,
          level: tag.toLowerCase() === "h2" ? 2 : 3
        });
        return '<' + tag + ' id="' + slug + '" class="sdkSectionHeadingTarget">' + text + '</' + tag + '>';
      });

      // Transform Obsidian Callouts:
      sHtml = sHtml.replace(/<blockquote>\s*<p>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\](?:\s*([^\n\r<]*))?([\s\S]*?)<\/p>\s*<\/blockquote>/gi, function (match, type, title, body) {
        var sTypeLower = type.toLowerCase();
        var sTitleText = (title && title.trim()) ? title.trim() : type.toUpperCase();
        var sIcon = "ℹ️";
        if (sTypeLower === "tip") sIcon = "💡";
        if (sTypeLower === "warning") sIcon = "⚠️";
        if (sTypeLower === "important" || sTypeLower === "caution") sIcon = "🛑";

        return '<div class="portalCallout portalCallout-' + sTypeLower + '">' +
                 '<div style="font-size: 1.25rem; margin-right: 0.8rem; line-height: 1;">' + sIcon + '</div>' +
                 '<div style="flex: 1;">' +
                   '<div class="portalCalloutTitle">' + sTitleText + '</div>' +
                   '<div>' + (body ? body.trim() : "") + '</div>' +
                 '</div>' +
               '</div>';
      });

      return sHtml;
    },

    _renderContent: function (sMarkdown) {
      var oDomRef = this.getDomRef();
      if (!this._md) {
        if (oDomRef) oDomRef.innerText = sMarkdown;
        return;
      }

      var sProcessedMd = this._preprocessMarkdown(sMarkdown);
      var sHtml = this._md.render(sProcessedMd);
      sHtml = this._postprocessHtml(sHtml);

      if (oDomRef) {
        oDomRef.innerHTML = '<div class="portalReaderContainer">' + sHtml + '</div>';
      } else {
        this._pendingHtml = sHtml;
      }
    },

    renderer: function (oRm, oControl) {
      oRm.openStart("div", oControl);
      oRm.class("portalMarkdownViewerRoot");
      oRm.openEnd();

      if (oControl._pendingHtml) {
        oRm.unsafeHtml('<div class="portalReaderContainer">' + oControl._pendingHtml + '</div>');
        oControl._pendingHtml = null;
      } else if (oControl.getSrc()) {
        oRm.unsafeHtml('<div class="sapUiMediumMargin" style="color: var(--sapContent_LabelColor);">Loading...</div>');
      }

      oRm.close("div");
    },

    onAfterRendering: function () {
      if (this.getSrc() && !this._pendingHtml) {
        this._fetchMarkdown(this.getSrc());
      }
    }
  });
});
