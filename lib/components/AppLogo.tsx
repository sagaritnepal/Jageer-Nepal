// lib/components/AppLogo.tsx
import { Image } from 'react-native';

// Source art is a portrait crop (1354x1650) - scale width to match so it
// never looks squashed regardless of what height a caller asks for.
const ASPECT = 1354 / 1650;

export function AppLogo({ size = 44 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/jageer-logo.png')}
      style={{ width: size * ASPECT, height: size }}
      resizeMode="contain"
    />
  );
}
