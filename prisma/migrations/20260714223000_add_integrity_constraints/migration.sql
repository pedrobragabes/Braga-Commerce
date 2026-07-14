-- Database invariants keep manual scripts and future integrations from creating
-- prices, inventory or order totals that the application would reject.
ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_localDeliveryFeeCents_nonnegative" CHECK ("localDeliveryFeeCents" IS NULL OR "localDeliveryFeeCents" >= 0),
  ADD CONSTRAINT "StoreSettings_freeShippingFromCents_nonnegative" CHECK ("freeShippingFromCents" IS NULL OR "freeShippingFromCents" >= 0);

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_basePriceCents_nonnegative" CHECK ("basePriceCents" >= 0),
  ADD CONSTRAINT "Product_compareAtCents_nonnegative" CHECK ("compareAtCents" IS NULL OR "compareAtCents" >= 0),
  ADD CONSTRAINT "Product_stockQuantity_nonnegative" CHECK ("stockQuantity" >= 0);

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_priceCents_nonnegative" CHECK ("priceCents" IS NULL OR "priceCents" >= 0),
  ADD CONSTRAINT "ProductVariant_stockQuantity_nonnegative" CHECK ("stockQuantity" >= 0);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amounts_nonnegative" CHECK (
    "subtotalCents" >= 0 AND "shippingCents" >= 0 AND "discountCents" >= 0 AND "totalCents" >= 0
  ),
  ADD CONSTRAINT "Order_total_consistent" CHECK (
    "discountCents" <= "subtotalCents" + "shippingCents"
    AND "totalCents" = "subtotalCents" + "shippingCents" - "discountCents"
  );

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "OrderItem_amounts_consistent" CHECK (
    "unitPriceCents" >= 0 AND "totalCents" >= 0 AND "totalCents" = "unitPriceCents" * "quantity"
  );

ALTER TABLE "RateLimitBucket"
  ADD CONSTRAINT "RateLimitBucket_count_positive" CHECK ("count" > 0),
  ADD CONSTRAINT "RateLimitBucket_window_valid" CHECK ("expiresAt" > "windowStart");

ALTER TABLE "EmailOutbox"
  ADD CONSTRAINT "EmailOutbox_attempts_valid" CHECK ("attempts" >= 0 AND "attempts" <= 5);
