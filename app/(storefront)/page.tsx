import type { Metadata } from "next";
import { BenefitStrip, CategorySection, FeaturedSection, StoreHero, StoreStory } from "../../storefront/components/home-sections";
import { getRequestStore } from "../../lib/store-context";
import { getStorePresentation } from "../../lib/store-theme";
import { getFeaturedProducts, getStoreNavigation } from "../../storefront/data";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getRequestStore();
  const { content } = await getStorePresentation(store.id);
  return { title: content.name, description: content.heroDescription, alternates: { canonical: "/" } };
}
export default async function StoreHomePage() {
  const current = await getRequestStore();
  if (!current.isActive) return <section className="store-container storefront-state"><h1>Loja indisponível</h1><p>Consulte seu pedido ou entre em contato com o atendimento.</p></section>;
  const [navigation, products, presentation] = await Promise.all([
    getStoreNavigation(current.slug), getFeaturedProducts(current.slug), getStorePresentation(current.id),
  ]);
  if (!navigation) return null;
  const { config, store } = presentation;
  const sections = {
    benefits: <BenefitStrip config={config} />,
    categories: <CategorySection categories={navigation.categories} />,
    featured: <FeaturedSection products={products} />,
    story: <StoreStory config={config} store={store} />,
  };
  return <><StoreHero config={config} products={products} />{config.presentation?.sections.map((name) => <div key={name}>{sections[name]}</div>)}</>;
}
