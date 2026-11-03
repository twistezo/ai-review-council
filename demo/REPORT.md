# demo/bug-farm has 13 confirmed defects, as expected for an intentionally buggy fixture

13 confirmed: 0 critical, 6 high, 7 medium, 0 low. Fix the four data-access and injection defects in `orders.ts` and `order-cache.ts` first, then the HTML injection in `order-view.ts`. All 4 reviews finished, and none failed. The review covered only `demo/bug-farm/`, as the prompt asked. `AGENTS.md` describes this folder as a fixture with planted defects that must be kept, so these findings confirm the planted bugs can be found. They are not regressions in the app. I verified every claim by reading the four source files. I ran nothing, so no tests, browser or database were used.

### high · security · Search input is concatenated into SQL

- **Location:** `demo/bug-farm/orders.ts:31`
- **Evidence:** `` `... customer_id = '${session.customerId}' AND id LIKE '%${search}%'` `` is passed with an empty parameter array. `listMyOrders` at line 20 shows the parameterized pattern this code should follow.
- **Impact:** A `search` value that contains `'` can rewrite the query, skip the customer filter and read other customers' orders.
- **Fix:** Use `customer_id = ? AND id LIKE ?` with `[session.customerId, `%${search}%`]`.
- **Confidence:** high. **Reported by:** Reviewers 1, 2, 3, 4.

### high · security · A customer can cancel another customer's order

- **Location:** `demo/bug-farm/orders.ts:44-46`
- **Evidence:** The only guard is `!session.customerId`. The `UPDATE` filters by `id` alone.
- **Impact:** Any signed-in user who knows an order id can cancel that order.
- **Fix:** Use `WHERE id = ? AND customer_id = ?` with `[orderId, session.customerId]`.
- **Confidence:** high. **Reported by:** Reviewers 1, 2, 3, 4.

### high · security · Order cache serves one customer's order to another

- **Location:** `demo/bug-farm/order-cache.ts:14`, `demo/bug-farm/order-cache.ts:19`
- **Evidence:** Entries are read and written with `orderId` as the only key. `loadOrder` receives `customerId`, which suggests it checks ownership, but a cache hit skips `loadOrder` entirely.
- **Impact:** Once customer A has loaded an order, customer B gets it for the same id, with no ownership check.
- **Fix:** Use `` `${customerId}:${orderId}` `` as the key.
- **Confidence:** high. **Reported by:** Reviewers 1, 2, 3, 4.

### high · security · Customer note is rendered as raw HTML

- **Location:** `demo/bug-farm/order-view.ts:22`
- **Evidence:** Every other interpolated value is escaped, but `<p>${customerNote}</p>` is not.
- **Impact:** A note such as `<img src=x onerror=...>` runs script for whoever views the card (stored XSS).
- **Fix:** Use `escapeHtml(customerNote)`.
- **Confidence:** high. **Reported by:** Reviewers 1, 2, 3, 4.

### high · security · HTML escaping does not protect the inline `onclick` string

- **Location:** `demo/bug-farm/order-view.ts:25`
- **Evidence:** `escapeHtml` turns `'` into `&#39;`. The browser decodes entities in an attribute value before it runs the handler, so `cancelOrder('...')` sees a literal `'` again.
- **Impact:** An order id containing `');alert(1);('` runs code on click. This depends on order ids being controllable, which the fixture does not show, so confidence is medium.
- **Fix:** Drop the inline handler. Render `<button type="button" data-order-id="${escapeHtml(order.id)}">` and attach a listener that reads `dataset.orderId`.
- **Confidence:** medium. **Reported by:** Reviewers 2, 3, 4.

### high · behaviour · Checkout subtotal ignores quantity

- **Location:** `demo/bug-farm/checkout.ts:19-21`
- **Evidence:** `subtotalCents += item.unitPriceCents`. The `quantity` field is never read.
- **Impact:** Any line with quantity above 1 is undercharged. The discount and the 5 000-cent free-shipping threshold also come out wrong. Reviewers rated this medium or high; I rated it high because it gives the wrong charge on every multi-unit order.
- **Fix:** `subtotalCents += item.unitPriceCents * item.quantity`.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · behaviour · Split payment loses remainder cents

- **Location:** `demo/bug-farm/checkout.ts:38-40`
- **Evidence:** `Math.floor(totalCents / participants)` is repeated for every participant. Splitting 1000 among 3 gives `[333, 333, 333]`, which sums to 999.
- **Impact:** The shares do not add up to the total, so the order is underpaid.
- **Fix:** Add 1 cent to the first `totalCents % participants` shares.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · behaviour · Paid revenue includes cancelled orders

- **Location:** `demo/bug-farm/orders.ts:53`
- **Evidence:** `x.status !== "pending"` also matches `"cancelled"`. The type at line 8 has exactly three statuses.
- **Impact:** `totalPaidRevenue` is inflated by every cancelled order.
- **Fix:** `x.status === "paid"`.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · behaviour · `refreshOrders` returns before any order is loaded

- **Location:** `demo/bug-farm/order-cache.ts:31-36`
- **Evidence:** `forEach(async ...)` does not wait for its callbacks. `results` is returned empty and filled in later. Load errors become unhandled rejections and never reach the caller.
- **Impact:** Callers get an empty list for any input that is not empty, and they see no errors.
- **Fix:** `return Promise.all(orderIds.map((orderId) => loadOrder(orderId, customerId)))`.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · behaviour · `waitForOrder` retries every error forever with no delay

- **Location:** `demo/bug-farm/order-cache.ts:43-49`
- **Evidence:** It runs `for (;;)`, catches every error and calls `delay(0)`. There is no attempt limit, and it never rethrows.
- **Impact:** A permanent failure (for example access denied or not found) hangs the caller and keeps hitting the backend.
- **Fix:** Cap the number of attempts, increase the delay between them, and rethrow the last error.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · ui-ux · A failed cancellation is announced as success

- **Location:** `demo/bug-farm/order-view.ts:35-36`
- **Evidence:** The `{ ok }` result of `await request(orderId)` is ignored, and `announce("Order cancelled successfully")` always runs.
- **Impact:** The user believes the order is cancelled when the server refused. Reviewer 1 rated this high; I kept medium because the harm depends on what happens to the order afterwards.
- **Fix:** `const response = await request(orderId)`. Announce success only when `response.ok`; otherwise announce a failure with a next step.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · ui-ux · Cancel control cannot be used with a keyboard

- **Location:** `demo/bug-farm/order-view.ts:25`
- **Evidence:** The control is a `<span onclick>` with no `tabindex`, no role and no key handler.
- **Impact:** Keyboard and screen reader users cannot cancel an order.
- **Fix:** Use `<button type="button">`. This is the same change as the inline `onclick` fix above.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

### medium · ui-ux · Receipt email label does not point at its input

- **Location:** `demo/bug-farm/order-view.ts:23-24`
- **Evidence:** The label has `for="email"` but the input has `id="receipt-email"`. The fixed id is also repeated on every card that is rendered.
- **Impact:** The input has no accessible name, and clicking the label does not focus it. Reviewers 3 and 4 rated this low; I kept medium because a required form field with no name blocks screen reader users.
- **Fix:** Use `id="receipt-email-${escapeHtml(order.id)}"` and the same value in `for`.
- **Confidence:** high. **Reported by:** Reviewers 1, 3, 4.

## Smells

- **Unclear names** in `demo/bug-farm/orders.ts:50-52`: `n` and `x` hide the meaning, and an index loop is used where `for...of` would do. Rename to `paidRevenueCents` and `order`. This is a judgement call. Reported by Reviewers 3 and 4.
- **No confirmation before an irreversible cancel** at `demo/bug-farm/order-view.ts:25`. This is a design choice, not a defect. Reported by Reviewer 1.

## Rejected claims

- **Price formatting fixed to USD and en-US** (`demo/bug-farm/checkout.ts:44-47`, Reviewer 1, low). The fixture states no locale or currency requirement, and `Order` has no currency field, so a fixed format is consistent with the data model. Reviewer 1 also could not confirm this was a problem.

## Unresolved questions

- **Cache TTL unit** (`demo/bug-farm/order-cache.ts:19`, Reviewer 3): `now() + ttlSeconds` mixes seconds with whatever unit `now` returns. If callers pass `Date.now`, entries expire 1000 times too early. Missing evidence: no caller or contract defines the unit of `now`. Safest fix: rename the parameter to `ttlMilliseconds`, or convert the value.

## Coverage gaps

- I only read the code. Nothing ran in a browser or against a database, and the fixture has no tests.
- No code mounts the HTML or defines the global `cancelOrder` and `announce`, so how these behave at runtime is inferred, not observed.
