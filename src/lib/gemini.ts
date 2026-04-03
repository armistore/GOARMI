
import { GoogleGenAI } from "@google/genai";
import { db, OperationType, handleFirestoreError } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const apiKey = process.env.GEMINI_API_KEY as string;
const genAI = new GoogleGenAI({ apiKey });

export interface PricingSettings {
  basePrice: number;
  perKmRide: number;
  perKmFood: number;
  perKmSend: number;
  perKmJastip: number;
}

const DEFAULT_PRICING: PricingSettings = {
  basePrice: 5000,
  perKmRide: 2500,
  perKmFood: 3000,
  perKmSend: 2000,
  perKmJastip: 4000,
};

export async function getPricingSettings(): Promise<PricingSettings> {
  const path = 'settings/global';
  try {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as PricingSettings;
    }
    return DEFAULT_PRICING;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return DEFAULT_PRICING;
  }
}

export async function getMapGrounding(prompt: string, userLocation?: { latitude: number, longitude: number }) {
  try {
    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (userLocation) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
          }
        }
      };
    }

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config,
    });

    return {
      text: response.text || "Tidak ada informasi rute tambahan.",
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
}

export function calculatePrice(distanceKm: number, service: string, settings: PricingSettings): number {
  const { basePrice, perKmRide, perKmFood, perKmSend, perKmJastip } = settings;
  let perKm = perKmRide;
  
  if (service === 'food') perKm = perKmFood;
  if (service === 'send') perKm = perKmSend;
  if (service === 'jastip') perKm = perKmJastip;
  
  return basePrice + (distanceKm * perKm);
}
