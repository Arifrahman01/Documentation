# Security Concepts

Enterprise security guidelines: XSS protection, CSRF token handling, and secure data binding.

---

## Overview

Security is a foundational pillar for enterprise web applications running on SAPUI5. The framework provides built-in mechanisms to protect against common web vulnerabilities like Cross-Site Scripting (XSS), Cross-Site Request Forgery (CSRF), and insecure clickjacking.

---

## Cross-Site Scripting (XSS) Prevention

SAPUI5 controls automatically encode output strings rendered into the DOM.

### Safe Binding
Standard data bindings automatically escape HTML characters (`<`, `>`, `&`, `"`, `'`):

```xml
<!-- Safe: Values are automatically HTML-escaped by sap.m.Text -->
<Text text="{user>/fullName}" />
```

### FormattedText & HTML Controls
When using `sap.m.FormattedText` or custom HTML:
- Only an approved whitelist of HTML tags (`<b>`, `<i>`, `<a>`, `<span>`, `<code>`, `<pre>`) is rendered.
- Dangerous attributes such as `onerror`, `onload`, or `<script>` tags are sanitized by default.

---

## CSRF Token Handling

When making mutating requests (POST, PUT, DELETE) against SAP Gateway or OData services:

1. **Token Fetching**: An initial `GET` request with header `x-csrf-token: Fetch` retrieves a valid token.
2. **Token Injection**: The `v2.ODataModel` automatically retains and injects the CSRF token into all subsequent modification requests.

```javascript
// Manual token fetch example in custom REST calls:
fetch("/api/resource", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-token": sCsrfToken
  },
  body: JSON.stringify(oPayload)
});
```

---

## Content Security Policy (CSP)

Ensure your server delivers strict CSP headers:
- Disallow `eval()` where possible (or adopt UI5 CSP compliance mode).
- Restrict scripts to self-hosted sources and trusted CDNs.
- Prevent framing from unknown origins using `frame-ancestors 'self'`.
