import type { Metadata } from "next";
import { StorefrontFrame } from "../../storefront/components/storefront-frame";
import { getStoreNavigation } from "../../storefront/data";
import { getRequestStore, getStoreRequestOrigin } from "../../lib/store-context";
import { getStorePresentation } from "../../lib/store-theme";
import { canStoreReceiveOrders } from "../../lib/store-lifecycle";
import "../../storefront/storefront.css";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const current = await getRequestStore();
  const { content } = await getStorePresentation(current.id);
  return { metadataBase: new URL(await getStoreRequestOrigin()), ...(current.isActive ? {} : { robots: { index: false, follow: false } }), title: { default: content.name, template: "%s | " + content.name }, description: content.heroDescription,
    openGraph: { siteName: content.name, title: content.name, description: content.heroDescription },
    twitter: { title: content.name, description: content.heroDescription } };
}
export default async function PublicStoreLayout({ children }: { children: React.ReactNode }) {
  const current = await getRequestStore();
  const [navigation, presentation, commerceEnabled] = await Promise.all([getStoreNavigation(current.slug), getStorePresentation(current.id), canStoreReceiveOrders(current.id)]);
  return <StorefrontFrame commerceEnabled={commerceEnabled} categories={current.isActive ? navigation?.categories ?? [] : []} config={presentation.config} store={presentation.store}>{children}</StorefrontFrame>;
}
