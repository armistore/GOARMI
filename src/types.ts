
export type ServiceType = 'ride' | 'food' | 'send' | 'jastip';

export interface Location {
  address: string;
  lat?: number;
  lng?: number;
}

export interface BookingState {
  service: ServiceType | null;
  origin: Location | null;
  destination: Location | null;
  price: number | null;
  distance: string | null;
  duration: string | null;
  status: 'idle' | 'searching' | 'estimated' | 'booked';
}

export interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
  };
}
