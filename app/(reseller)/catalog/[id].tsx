// app/(reseller)/catalog/[id].tsx
import { CatalogProductDetail } from '../../../lib/components/CatalogProductDetail';

export default function ResellerCatalogDetail() {
  return <CatalogProductDetail priceLabel="Your price to customers" capToPurchasedStock />;
}
