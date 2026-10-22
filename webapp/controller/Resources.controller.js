sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("doc.portal.controller.Resources", {
    onInit: function () {
    },

    onOpenExternal: function (sUrl) {
      window.open(sUrl, "_blank");
    }
  });
});
