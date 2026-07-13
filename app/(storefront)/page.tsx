import { notFound } from "next/navigation";
import {
  BenefitStrip,
  CategorySection,
  FeaturedSection,
  StoreHero,
  StoreStory,
} from "../../storefront/components/home-sections";
import { pvModaConfig } from "../../storefront/config/pv-moda";
import { getFeaturedProducts, getStoreNavigation } from "../../storefront/data";

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
