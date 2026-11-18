# Shop notes

The shop is a lightweight service-order system built into the worker (D1 + Stripe Checkout), not a physical-goods store.

- Built-in services: `TOUMYOU_SERVICE_PRODUCTS` (trilingual). Only the diagnostic has a fixed price and online checkout.
- Additional products can be created in `/admin/products`; published, checkout-enabled items with a price can be bought online.
- Stripe webhooks (`/api/stripe/webhook`) mark orders paid; the customer sees order status in `/account`.
- If physical products are ever sold, set `weight_grams` above 0 to enable shipping options and address collection at checkout (`SHIPPING_STANDARD_CENTS`, `SHIPPING_EXPRESS_CENTS`).
