# Data Binding Overview

Data binding connects UI elements to data models, keeping the user interface automatically synchronized when model data updates.

---

## Binding Modes

| Mode | Syntax / API | Description |
|---|---|---|
| **One-Way Binding** | `{path: '/name', mode: 'OneWay'}` | Data flows only from model to control. |
| **Two-Way Binding** | `{path: '/name', mode: 'TwoWay'}` | User input in controls automatically updates the underlying model. |
| **One-Time Binding** | `{path: '/name', mode: 'OneTime'}` | Data is read once upon initialization and never refreshed. |

---

## Expression Binding

You can evaluate simple expressions and conditions directly in XML view bindings without needing a custom formatter:

```xml
<ObjectStatus
  text="{= ${invoice>ExtendedPrice} > 500 ? 'High' : 'Normal' }"
  state="{= ${invoice>ExtendedPrice} > 500 ? 'Error' : 'Success' }" />
```
