import { afterEach, describe, expect, it } from "vitest";
import { can } from "../../lib/admin-auth";
import { getStorageBucketName, MAX_PRODUCT_IMAGE_BYTES } from "../../lib/storage/config";
import {
  detectProductImageMimeType,
  ProductImageValidationError,
  readValidatedProductImage,
} from "../../lib/storage/validation";
import { moveProductImageInOrder } from "../../lib/storage/order";

const originalBucket = process.env.STORAGE_BUCKET;

afterEach(() => {
  if (originalBucket === undefined) delete process.env.STORAGE_BUCKET;
  else process.env.STORAGE_BUCKET = originalBucket;
});

describe("product image authorization", () => {
  it("allows OWNER/ADMIN and blocks STAFF", () => {
    expect(can("OWNER", "images:write")).toBe(true);
    expect(can("ADMIN", "images:write")).toBe(true);
    expect(can("STAFF", "images:write")).toBe(false);
  });
});

describe("product image validation", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
  ] as const)("accepts %s by declared type and signature", async (type, signature) => {
    const file = new File([new Uint8Array(signature)], "ignored-name", { type });
    const result = await readValidatedProductImage(file);
    expect(result.contentType).toBe(type);
    expect(detectProductImageMimeType(result.bytes)).toBe(type);
  });

  it("rejects SVG even when it claims to be an image", async () => {
    const file = new File(["<svg><script>alert(1)</script></svg>"], "attack.svg", {
      type: "image/svg+xml",
    });
    await expect(readValidatedProductImage(file)).rejects.toMatchObject({
      code: "UNSUPPORTED_TYPE",
    } satisfies Partial<ProductImageValidationError>);
  });

  it("rejects a forged MIME type", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "fake.jpg",
      {
        type: "image/jpeg",
      },
    );
    await expect(readValidatedProductImage(file)).rejects.toMatchObject({ code: "TYPE_MISMATCH" });
  });

  it("rejects files above the documented limit before reading bytes", async () => {
    const file = new File([new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1)], "large.png", {
      type: "image/png",
    });
    await expect(readValidatedProductImage(file)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
});

describe("storage configuration", () => {
  it("uses the product bucket and rejects unsafe names", () => {
    delete process.env.STORAGE_BUCKET;
    expect(getStorageBucketName()).toBe("product-images");
    process.env.STORAGE_BUCKET = "product-images; drop table storage.objects";
    expect(() => getStorageBucketName()).toThrow("STORAGE_BUCKET inválido");
  });
});

describe("product image order", () => {
  const images = [{ id: "first" }, { id: "second" }, { id: "third" }];

  it("moves the persisted first image and keeps edge operations stable", () => {
    expect(moveProductImageInOrder(images, "second", "up")?.map((image) => image.id)).toEqual([
      "second",
      "first",
      "third",
    ]);
    expect(moveProductImageInOrder(images, "first", "up")).toEqual(images);
    expect(moveProductImageInOrder(images, "missing", "down")).toBeNull();
  });
});
