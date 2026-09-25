import { requireAdminSession } from "../../../../lib/admin-auth";
import { getStorePresentation } from "../../../../lib/store-theme";
import { getFeaturedProducts, getStoreNavigation } from "../../../../storefront/data";
import { StorefrontFrame } from "../../../../storefront/components/storefront-frame";
import { StoreHero, StoreStory, BenefitStrip, CategorySection, FeaturedSection } from "../../../../storefront/components/home-sections";
import "../../../../storefront/storefront.css";

export default async function ThemePreview() {
  const session = await requireAdminSession("settings:write");
  const { config, store } = await getStorePresentation(session.storeId, session);
  const [navigation, products] = await Promise.all([getStoreNavigation(store.slug), getFeaturedProducts(store.slug)]);
  const sections = { benefits: <BenefitStrip config={config} />, categories: <CategorySection categories={navigation?.categories ?? []} />,
    featured: <FeaturedSection products={products} />, story: <StoreStory config={config} store={store} /> };
  return <div inert><StorefrontFrame categories={navigation?.categories ?? []} config={config} store={store}>
    <StoreHero config={config} products={products} />{config.presentation?.sections.map((name) => <div key={name}>{sections[name]}</div>)}
  </StorefrontFrame></div>;
}
