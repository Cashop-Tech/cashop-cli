# P1 Endpoint Calibration (captured 2026-04-14)

Authoritative source for Task 11, 16, 19-22 DTOs. Captured by live probes against `http://159.138.7.47` plus inspection of bash scripts in `cashop-ai/cli/consumer/` and `cashop-ai/cli/lib/common.sh`.

## Gateway conventions (all endpoints)

- Base: `http://159.138.7.47` (stable; port 80 → iptables REDIRECT → gatekeeper:8989).
- Response envelope: `{code, success, message, extAttrs, data}`. HTTP is **always 200** (even for business failures).
  - Success: `code === "00000" && success === true`.
  - Failure: `code !== "00000"` OR `success === false`. http-client MUST raise `BusinessError(code, message, body)`.
  - Re-auth codes: `701001`, `702001`, `702101`, `702102` → raise `ReauthRequired`.
- Required headers (all requests): `X-Country: JP`, `X-Currency: JPY`, `X-Language: en`. (Bash default is `ja`; we standardise on `en` for CLI.)
- Auth: `Authorization: <raw-access-token>` — **no** `Bearer ` prefix.
- Login additionally sends `Login-Channel: app`, `Device-ID: <stable-per-install>`.

## 1. `member/auth/v1/login` (password login)

```
POST /member/cashop-member-auth/open/auth/v1/login
Headers: X-Country, X-Currency, X-Language, Login-Channel: app, Device-ID: cli-<uuid>
Body: {"email":"1@1.cn","password":"1234qwer","loginType":"emailPassword","channel":"app"}
```

Captured response `data`:

```json
{
  "nickname": "User#648199",
  "accessToken": "<32-char hex>",
  "refreshToken": "<32-char hex>",
  "userId": "531499234320648199",
  "shopId": "17689916896645",
  "userRole": "Consumer",
  "channel": "app",
  "language": "en",
  "currencyType": "USD",
  "stationId": "JP",
  "loginType": "emailPassword",
  "loginTime": "2026-04-14T10:04:01Z",
  "expireTime": "2026-04-14T12:04:01Z",          // ← 2h validity
  "refreshExpireTime": "2026-04-21T10:04:01Z",    // ← 7d validity
  "redirectUri": null
}
```

Wrong-credential failure: `{"code":"702021","success":false,"message":"账号或密码错误","data":null}` (HTTP 200).

## 2. `product.search`

```
POST /business/cashop-business-aggr-prod/open/product/list
Headers: X-Country, X-Currency, X-Language (no auth)
Body: {
  "pageId":"search-result",
  "searchParams":{
    "scene":"SEARCH_PRODUCT",
    "keyword":"<kw>",
    "searchRequestId":"cli-<ts>-<rand>",
    "pageSize":<n>,
    "pageNum":<n>
  },
  "pageSize":<n>
}
```

Response `data`:

```jsonc
{
  "pageIndexStartZero": false,
  "pageIndex": null,
  "pageSize": null,
  "currentPageSize": null,
  "total": 23,                // may be null when keyword matches nothing
  "totalCount": null,
  "pages": 23,
  "data": [Product, ...],     // may be null — treat as []
  "extra": { "currencyType":"JPY", "traceId":"...", "language":"en", "searchRequestId":"..." },
  "hasNext": null
}
```

`Product` (minimal fields used by CLI output):

```jsonc
{
  "uniqueId": "JP_506379367274803200",
  "spuCode": "JP_506379367274803200",
  "productNum": "5918972",
  "suppInfoVO": { "title":"...", "sellOut":false, "spuOnline":true },
  "skuMainImageUrls": [],
  "skuCurrentPriceInfo": { "tagPrice":2387, "standPrice":2372.0, "memberPrice":1945, "promoStatus":2, "taxIncludedPrice":2372.0 },
  "brandInfo": { "brandName":"...", "brandLogo":"..." },   // may be absent
  "slug": "..."
}
```

## 3. `product.get`

```
POST /business/cashop-business-aggr-prod/open/product/v2
Headers: X-Country, X-Currency, X-Language (no auth)
Body: {"spuCode":"JP_506379367274803200"}
```

Response `data` extends `Product` with full detail (images, SKUs, descriptions). For P1 CLI, treat the full object as opaque and only pretty-print top-level key fields.

## 4. `cart.list`

```
POST /trade/cashop-order-prod/api/cart/list
Headers: Authorization + X-Country/Currency/Language
Body: {}
```

Captured response `data` (empty cart):

```jsonc
{
  "effectiveCartGroupList": [],
  "invalidCartLineList": [],
  "totalProductCount": 0,
  "totalProductAmount": 0,
  "totalFreightAmount": 0,
  "totalDiscountAmount": 0,
  "totalSettleAmount": 0,
  "cartCount": 0,
  "currency": null,
  "ddpEnabled": false
}
```

## 5. `cart.add`

```
POST /trade/cashop-order-prod/api/cart/add
Headers: Authorization + X-Country/Currency/Language
Body: {"skuId":"<sku>","spuCode":"<spu>","quantity":1}
```

Response `data`: the updated cart object (same shape as cart.list).

## 6. `order.list`

```
POST /trade/cashop-order-prod/api/order/list
Headers: Authorization + X-Country/Currency/Language
Body: {"pageIndex":1,"pageSize":10}
```

Response `data` shape (inferred from bash help text in `cashop-order-list`):

```jsonc
{
  "pageIndex": 1,
  "pageSize": 10,
  "total": <n>,
  "data": [
    { "orderId":"...", "orderStatus":"...", "productList":[...], "totalAmount":..., "createTime":"..." }
  ]
}
```

**Confirm against live response during Task 22 implementation** — we did not probe this endpoint live because the test account has no orders.

## 7. `order.get`

Bash has no standalone `cashop-order-get` script — list + client filter is the legacy path. For P1, we introduce:

```
POST /trade/cashop-order-prod/api/order/detail   (TO VERIFY — see Task 22 Step 1)
Body: {"orderId":"<id>"}
```

Task 22 Step 1 MUST probe this (or the real equivalent) before writing the code.
