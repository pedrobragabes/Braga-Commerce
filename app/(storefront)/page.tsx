import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BenefitStrip,
  CategorySection,
  FeaturedSection,
  StoreHero,
  StoreStory,
} from "../../storefront/components/home-sections";
import { pvModaConfig } from "../../storefront/config/pv-moda";
import { getFeaturedProducts, getStoreNavigation } from "../../storefront/data";

export const metadata: Metadata = {
  title: "PV Moda Masculina",
  description: "Moda masculina essencial e atual, com curadoria local e atendimento próximo.",
  alternates: { canonical: "/" },
};

export default async function StoreHomePage() {
  const [navigation, products] = await Promise.all([
    getStoreNavigation(pvModaConfig.storeSlug),
    getFeaturedProducts(pvModaConfig.storeSlug),
  ]);

  if (!navigation) notFound();

  return (
    <>
      <StoreHero config={pvModaConfig} />
      <BenefitStrip config={pvModaConfig} />
      <CategorySection categories={navigation.categories} />
      <FeaturedSection products={products} />
      <StoreStory config={pvModaConfig} store={navigation.store} />
    </>
  );
}
