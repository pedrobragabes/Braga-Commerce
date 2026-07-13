export type StorefrontTheme = {
  ink: string;
  paper: string;
  surface: string;
  accent: string;
  accentStrong: string;
  brand: string;
  brandSoft: string;
  line: string;
  muted: string;
  radius: string;
};
export type StorefrontConfig = {
  storeSlug: string;
  announcement: string;
  brandKicker: string;
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    badge: string;
  };
  benefits: ReadonlyArray<{
    icon: "hanger" | "pin" | "shield";
    title: string;
    description: string;
  }>;
  story: {
    eyebrow: string;
    title: string;
    description: string;
  };
  theme: StorefrontTheme;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
};

export type StorefrontVariant = {
  id: string;
  name: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  priceCents: number | null;
  stockQuantity: number;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePriceCents: number;
  compareAtCents: number | null;
  isFeatured: boolean;
  category: { name: string; slug: string } | null;
  images: ReadonlyArray<{ url: string; alt: string | null }>;
  variants: ReadonlyArray<StorefrontVariant>;
  available: boolean;
};

export type StorefrontStore = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};
