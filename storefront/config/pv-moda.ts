import type { StorefrontConfig } from "../types";

/**
 * Identidade e conteúdo do cliente piloto.
 * Uma nova loja pode começar copiando apenas este arquivo; consultas, rotas e
 * componentes do storefront não dependem das cores ou dos textos da PV Moda.
 */
export const pvModaConfig: StorefrontConfig = {
  storeSlug: "pv-moda-masculina",
  announcement: "Moda masculina, atendimento próximo e retirada local.",
  brandKicker: "Masculino · Essencial · Atual",
  hero: {
    eyebrow: "Nova seleção · PV Moda",
    title: "Peças que resolvem o visual.",
    description:
      "Do básico bem-feito ao casual alinhado: uma seleção masculina pensada para combinar mais e complicar menos.",
    primaryCta: "Ver coleção",
    secondaryCta: "Conhecer a loja",
    badge: "Curadoria local",
  },
  benefits: [
    {
      icon: "hanger",
      title: "Escolha sem dúvida",
      description: "Tamanhos e cores organizados para você comparar com clareza.",
    },
    {
      icon: "pin",
      title: "Atendimento local",
      description: "Converse com a loja e combine a melhor forma de receber.",
    },
    {
      icon: "shield",
      title: "Compra acompanhada",
      description: "Da escolha à retirada, você fala com uma pessoa de verdade.",
    },
  ],
  story: {
    eyebrow: "PV Moda Masculina",
    title: "Um guarda-roupa versátil começa por boas escolhas.",
    description:
      "A vitrine reúne peças fáceis de usar, com informação objetiva de preço, tamanho e disponibilidade. O atendimento continua pessoal — agora também no digital.",
  },
  theme: {
    ink: "#151b18",
    paper: "#f2efe8",
    surface: "#fcfbf7",
    accent: "#d16a32",
    accentStrong: "#9e3f1f",
    brand: "#173d30",
    brandSoft: "#d8e0d4",
    line: "#d5cec2",
    muted: "#66665f",
    radius: "0.9rem",
  },
};
