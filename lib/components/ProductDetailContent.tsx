// lib/components/ProductDetailContent.tsx
import { View, Text, Pressable, Image } from 'react-native';
import { useIsWideWeb } from '../hooks/useWideGrid';
import { toSafeImageUri } from '../utils/image';
import type { Product } from '../../types/database.types';

/** The body of a product page (photo, name, price, description, Add to cart),
 * shared by the client and reseller product screens. On a phone: the photo on
 * top, then the details, then the button. On wide web: the photo beside the
 * details, so a full-width square photo never takes over the screen. */
export function ProductDetailContent({ product, onAddToCart }: { product: Product; onAddToCart: () => void }) {
  const wide = useIsWideWeb();
  const outOfStock = product.stock_level <= 0;

  const image = (
    <View className="mb-4 aspect-square items-center justify-center overflow-hidden rounded-2xl bg-blue-50">
      {product.image_url ? (
        <Image source={{ uri: toSafeImageUri(product.image_url)! }} className="h-full w-full" resizeMode="cover" />
      ) : (
        <Text className="text-5xl">🖥️</Text>
      )}
    </View>
  );

  const details = (
    <>
      {product.category && (
        <Text className="text-xs font-bold uppercase tracking-wide text-blue-600">{product.category}</Text>
      )}
      <Text className="mt-1 text-xl font-extrabold text-gray-900">{product.name}</Text>
      <Text className="mt-2 text-2xl font-extrabold text-blue-700">NPR {Number(product.price).toLocaleString()}</Text>

      {product.description && <Text className="mt-3.5 text-sm leading-6 text-gray-600">{product.description}</Text>}

      <Text className="mt-4 text-xs text-gray-400">{outOfStock ? 'Out of stock' : `${product.stock_level} in stock`}</Text>
    </>
  );

  const addButton = (
    <Pressable
      onPress={onAddToCart}
      disabled={outOfStock}
      className="items-center rounded-xl bg-orange-500 py-3.5 disabled:opacity-40"
    >
      <Text className="text-base font-semibold text-white">{outOfStock ? 'Out of stock' : 'Add to cart'}</Text>
    </Pressable>
  );

  if (wide) {
    return (
      <View className="flex-row items-start" style={{ gap: 32, padding: 32, paddingTop: 24 }}>
        <View style={{ width: 420, flexShrink: 0 }}>{image}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {details}
          <View className="mt-6" style={{ maxWidth: 420 }}>
            {addButton}
          </View>
        </View>
      </View>
    );
  }

  return (
    <>
      <View className="px-6 pt-4">
        {image}
        {details}
      </View>

      <View className="mt-6 px-6">{addButton}</View>
    </>
  );
}
