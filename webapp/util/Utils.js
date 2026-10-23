sap.ui.define([], function () {
  "use strict";

  return {
    /**
     * Copy text to system clipboard with fallback for non-secure contexts.
     * @param {string} sText Text to copy
     * @returns {Promise<void>}
     */
    copyToClipboard: function (sText) {
      if (!sText) {
        return Promise.resolve();
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(sText);
      }

      return new Promise(function (resolve, reject) {
        try {
          var textArea = document.createElement("textarea");
          textArea.value = sText;
          textArea.style.position = "fixed";
          textArea.style.top = "-9999px";
          textArea.style.left = "-9999px";
          textArea.style.opacity = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          var successful = document.execCommand("copy");
          document.body.removeChild(textArea);
          if (successful) {
            resolve();
          } else {
            reject(new Error("Clipboard copy command failed"));
          }
        } catch (err) {
          reject(err);
        }
      });
    }
  };
});
