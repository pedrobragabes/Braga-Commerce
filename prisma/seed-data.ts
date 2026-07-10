type SeedCategory = {
  name: string;
  slug: string;
  sortOrder: number;
};

type SeedVariant = {
  name: string;
  sku: string;
  size: string;
  color: string;
  stockQuantity: number;
};

type SeedProduct = {
  categorySlug: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  basePriceCents: number;
  compareAtCents?: number;
  isFeatured?: boolean;
  variants: readonly SeedVariant[];
};

export const PV_MODA_CATEGORIES: readonly SeedCategory[] = [
  { name: "Camisetas", slug: "camisetas", sortOrder: 10 },
  { name: "Camisas", slug: "camisas", sortOrder: 20 },
  { name: "Polos", slug: "polos", sortOrder: 30 },
  { name: "Calças", slug: "calcas", sortOrder: 40 },
  { name: "Bermudas", slug: "bermudas", sortOrder: 50 },
  { name: "Acessórios", slug: "acessorios", sortOrder: 60 },
] as const;

export const PV_MODA_PRODUCTS: readonly SeedProduct[] = [
  {
    categorySlug: "camisetas",
    name: "Camiseta Essential Premium",
    slug: "camiseta-essential-premium",
    sku: "PV-TEE-ESSENTIAL",
    shortDescription: "Algodão macio, modelagem regular e acabamento premium.",
    description: "Camiseta essencial para o dia a dia, com caimento confortável e tecido de algodão.",
    basePriceCents: 7990,
    compareAtCents: 9990,
    isFeatured: true,
    variants: [
      { name: "Preto / P", sku: "PV-TEE-ESSENTIAL-PRETO-P", size: "P", color: "Preto", stockQuantity: 8 },
      { name: "Preto / M", sku: "PV-TEE-ESSENTIAL-PRETO-M", size: "M", color: "Preto", stockQuantity: 12 },
      { name: "Branco / G", sku: "PV-TEE-ESSENTIAL-BRANCO-G", size: "G", color: "Branco", stockQuantity: 6 },
    ],
  },
  {
    categorySlug: "camisas",
    name: "Camisa Oxford Slim",
    slug: "camisa-oxford-slim",
    sku: "PV-SHIRT-OXFORD",
    shortDescription: "Camisa social slim em Oxford de algodão.",
    description: "Camisa de manga longa para ocasiões casuais ou sociais, com corte slim e gola estruturada.",
    basePriceCents: 14990,
    compareAtCents: 17990,
    isFeatured: true,
    variants: [
      { name: "Azul / M", sku: "PV-SHIRT-OXFORD-AZUL-M", size: "M", color: "Azul", stockQuantity: 5 },
      { name: "Azul / G", sku: "PV-SHIRT-OXFORD-AZUL-G", size: "G", color: "Azul", stockQuantity: 7 },
      { name: "Branco / G", sku: "PV-SHIRT-OXFORD-BRANCO-G", size: "G", color: "Branco", stockQuantity: 4 },
    ],
  },
  {
    categorySlug: "polos",
    name: "Polo Piquet Classic",
    slug: "polo-piquet-classic",
    sku: "PV-POLO-CLASSIC",
    shortDescription: "Polo de piquet com gola e acabamento canelado.",
    description: "Peça versátil em malha piquet, ideal para um visual alinhado sem abrir mão do conforto.",
    basePriceCents: 10990,
    isFeatured: true,
    variants: [
      { name: "Marinho / M", sku: "PV-POLO-CLASSIC-MARINHO-M", size: "M", color: "Marinho", stockQuantity: 9 },
      { name: "Marinho / G", sku: "PV-POLO-CLASSIC-MARINHO-G", size: "G", color: "Marinho", stockQuantity: 9 },
    ],
  },
  {
    categorySlug: "calcas",
    name: "Calça Chino Sarja",
    slug: "calca-chino-sarja",
    sku: "PV-PANTS-CHINO",
    shortDescription: "Sarja com modelagem slim e elastano para mobilidade.",
    description: "Calça chino de sarja para compor looks casuais com conforto durante todo o dia.",
    basePriceCents: 16990,
    compareAtCents: 19990,
    isFeatured: true,
    variants: [
      { name: "Caqui / 40", sku: "PV-PANTS-CHINO-CAQUI-40", size: "40", color: "Caqui", stockQuantity: 4 },
      { name: "Caqui / 42", sku: "PV-PANTS-CHINO-CAQUI-42", size: "42", color: "Caqui", stockQuantity: 7 },
      { name: "Preto / 42", sku: "PV-PANTS-CHINO-PRETO-42", size: "42", color: "Preto", stockQuantity: 6 },
    ],
  },
  {
    categorySlug: "bermudas",
    name: "Bermuda Sarja Casual",
    slug: "bermuda-sarja-casual",
    sku: "PV-SHORTS-SARJA",
    shortDescription: "Bermuda de sarja com bolsos funcionais.",
    description: "Bermuda casual de comprimento equilibrado, para dias quentes e combinações leves.",
    basePriceCents: 9990,
    variants: [
      { name: "Bege / 40", sku: "PV-SHORTS-SARJA-BEGE-40", size: "40", color: "Bege", stockQuantity: 5 },
      { name: "Bege / 42", sku: "PV-SHORTS-SARJA-BEGE-42", size: "42", color: "Bege", stockQuantity: 5 },
    ],
  },
  {
    categorySlug: "acessorios",
    name: "Cinto de Couro Clássico",
    slug: "cinto-couro-classico",
    sku: "PV-BELT-CLASSIC",
    shortDescription: "Cinto em couro sintético com fivela escovada.",
    description: "Acessório clássico para completar produções casuais e sociais.",
    basePriceCents: 6990,
    variants: [
      { name: "Preto / Único", sku: "PV-BELT-CLASSIC-PRETO-U", size: "Único", color: "Preto", stockQuantity: 10 },
    ],
  },
] as const;

function assertUnique(values: readonly string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error(`Seed da PV Moda contém ${label} duplicado.`);
  }
}

export function validatePvModaSeed() {
  assertUnique(PV_MODA_CATEGORIES.map((category) => category.slug), "slug de categoria");
  assertUnique(PV_MODA_PRODUCTS.map((product) => product.slug), "slug de produto");
  assertUnique(PV_MODA_PRODUCTS.map((product) => product.sku), "SKU de produto");
  assertUnique(
    PV_MODA_PRODUCTS.flatMap((product) => product.variants.map((variant) => variant.sku)),
    "SKU de variação",
  );

  for (const product of PV_MODA_PRODUCTS) {
    if (product.basePriceCents <= 0 || product.variants.length === 0) {
      throw new Error(`Produto inválido no seed: ${product.slug}.`);
    }
  }
}
