// lib/components/AppLogo.tsx
import { Image } from 'react-native';

// Source art is a portrait crop (900x1238) - scale width to match so it
// never looks squashed regardless of what height a caller asks for.
const ASPECT = 900 / 1238;

export function AppLogo({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/jageer-logo.png')}
      style={{ width: size * ASPECT, height: size }}
      resizeMode="contain"
    />
  );
}
