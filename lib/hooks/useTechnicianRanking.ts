// lib/hooks/useTechnicianRanking.ts
import { useMemo } from 'react';
import { useSupabaseQuery } from './useSupabase';
import { distanceKm } from '../utils/distance';
import type { RequestLocation } from '../../types/database.types';

export function useRankedTechnicians(requestLocation: RequestLocation | null | undefined) {
  const { data: technicians, isLoading } = useSupabaseQuery('profiles', {
    filters: { role: 'technician' },
  });

  const rankedTechnicians = useMemo(() => {
    const list = technicians ?? [];
    const withDistance = list.map((t) => {
      const distance =
        requestLocation?.latitude != null &&
        requestLocation?.longitude != null &&
        t.latitude != null &&
        t.longitude != null
          ? distanceKm(
              { latitude: requestLocation.latitude, longitude: requestLocation.longitude },
              { latitude: t.latitude, longitude: t.longitude }
            )
          : null;
      return { ...t, distance };
    });
    return withDistance.sort((a, b) => {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
      if (a.distance == null && b.distance == null) return 0;
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }, [technicians, requestLocation]);

  return { rankedTechnicians, isLoading };
}
