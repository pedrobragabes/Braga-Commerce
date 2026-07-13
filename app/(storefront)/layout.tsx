import { notFound } from "next/navigation";
import { StorefrontFrame } from "../../storefront/components/storefront-frame";
import { pvModaConfig } from "../../storefront/config/pv-moda";
import { getStoreNavigation } from "../../storefront/data";

export const dynamic = "force-dynamic";

export default async function PublicStoreLayout({ children }: { children: React.ReactNode }) {
  const navigation = await getStoreNavigation(pvModaConfig.storeSlug);

  if (!navigation) notFound();

  return (
    <StorefrontFrame categories={navigation.categories} config={pvModaConfig} store={navigation.store}>
      {children}
    </StorefrontFrame>
  );
}
