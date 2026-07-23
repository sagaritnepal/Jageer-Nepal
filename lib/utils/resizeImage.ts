// lib/utils/resizeImage.ts
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Downscales a picked image before upload so it fits comfortably under the
 * storage bucket's file_size_limit - a phone camera photo can be 4000px+
 * wide and several MB even at low JPEG quality, which is what was tripping
 * the "limit exceeded" upload error.
 */
export async function resizeImageForUpload(
  uri: string,
  sourceWidth: number | undefined,
  maxDimension: number,
  compress = 0.7
): Promise<string> {
  if (sourceWidth != null && sourceWidth <= maxDimension) return uri;

  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: maxDimension });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return result.uri;
}
