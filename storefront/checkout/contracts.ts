import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99),
}).strict();

export const quoteRequestSchema = z.object({
  storeSlug: z.string().min(1),
  items: z.array(cartItemSchema).min(1).max(50),
}).strict();

const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo.").max(120),
  phone: z.string().trim().min(8, "Informe um telefone válido.").max(24),
  email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.")]).optional(),
}).strict();

const addressSchema = z.object({
  zipCode: z.string().trim().max(12).optional(),
  street: z.string().trim().max(160).optional(),
  number: z.string().trim().max(30).optional(),
  complement: z.string().trim().max(120).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(2).optional(),
}).strict().optional();

export const checkoutRequestSchema = z.object({
  storeSlug: z.string().min(1),
  items: z.array(cartItemSchema).min(1, "Seu carrinho está vazio.").max(50),
  customer: customerSchema,
  deliveryMethod: z.enum(["LOCAL_PICKUP", "LOCAL_DELIVERY"]),
  address: addressSchema,
  notes: z.string().trim().max(500).optional(),
}).strict().superRefine((payload, context) => {
  if (payload.deliveryMethod !== "LOCAL_DELIVERY") return;

  const requiredFields: Array<[keyof NonNullable<typeof payload.address>, string]> = [
    ["zipCode", "Informe o CEP."],
    ["street", "Informe a rua."],
    ["number", "Informe o número."],
    ["neighborhood", "Informe o bairro."],
    ["city", "Informe a cidade."],
    ["state", "Informe o estado."],
  ];

  for (const [field, message] of requiredFields) {
    if (!payload.address?.[field]) {
      context.addIssue({ code: "custom", message, path: ["address", field] });
    }
  }
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutDeliveryMethod = CheckoutRequest["deliveryMethod"];

export type CartQuoteLine = {
  productId: string;
  variantId?: string;
  productName: string;
  productSlug: string;
  variantName: string | null;
  sku: string | null;
  categorySlug: string | null;
  imageUrl: string | null;
  quantity: number;
  stockQuantity: number | null;
  unitPriceCents: number;
  totalCents: number;
  available: boolean;
};

export type CartQuote = {
  items: CartQuoteLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  issues: string[];
};

export type CheckoutSettings = {
  allowLocalPickup: boolean;
  allowLocalDelivery: boolean;
  localDeliveryFeeCents: number;
};
