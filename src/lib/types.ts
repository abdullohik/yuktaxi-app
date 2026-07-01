// YukTaxi shared types

export type Role = "CUSTOMER" | "DRIVER" | "FLEET";
export type Language = "uz" | "ru" | "en";

export type CargoType =
  | "truck_small"
  | "truck_medium"
  | "truck_large"
  | "pickup"
  | "van";

export type OrderStatus =
  | "SEARCHING"
  | "ACCEPTED"
  | "ARRIVING"
  | "ARRIVED"
  | "LOADED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPoint extends LatLng {
  address: string;
}

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  language: Language;
  avatar: string | null;
  createdAt?: string;
}

export interface Driver {
  id: string;
  userId: string;
  isOnline: boolean;
  rating: number;
  totalTrips: number;
  trustScore: number;
  vehicleType: CargoType;
  vehiclePlate: string | null;
  city: string;
  balance: number;
}

export interface NearbyDriver {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating: number;
  vehicleType: CargoType;
  vehiclePlate: string;
  etaMin: number;
  online: boolean;
  trustScore: number;
}

export interface Order {
  id: string;
  customerPhone: string;
  customerName: string | null;
  driverPhone: string | null;
  driverName: string | null;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  pickupApt?: string | null;
  pickupEntrance?: string | null;
  pickupFloor?: string | null;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  dropoffApt?: string | null;
  dropoffEntrance?: string | null;
  dropoffFloor?: string | null;
  cargoType: CargoType;
  weightKg: number;
  note: string | null;
  priceSom: number;
  distanceKm: number;
  durationMin: number;
  // Cargo manifest (optional, populated when customer fills the form)
  cargoTitle?: string | null;
  cargoDescription?: string | null;
  cargoCategory?: string | null;
  cargoLengthCm?: number | null;
  cargoWidthCm?: number | null;
  cargoHeightCm?: number | null;
  cargoValueSom?: number | null;
  isFragile?: boolean;
  needsLoadingHelp?: boolean;
  status: OrderStatus;
  cancelReason: string | null;
  createdAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderPhone: string;
  senderRole: "CUSTOMER" | "DRIVER";
  senderName: string | null;
  text: string;
  createdAt: string;
}

export interface SavedAddress {
  id: string;
  userPhone: string;
  label: string;
  lat: number;
  lng: number;
  address: string;
}

export interface EarningsSummary {
  today: number;
  week: number;
  month: number;
  balance: number;
  totalTrips: number;
  avgRating: number;
  history: { date: string; label: string; total: number; count: number }[];
  payouts: { id: string; amount: number; status: "PENDING" | "DONE"; createdAt: string }[];
}

export interface PriceEstimate {
  priceSom: number;
  etaMin: number;
  breakdown: { base: number; distance: number; cargo: number; weight: number };
}

export type PhotoStage = "BEFORE_PICKUP" | "AT_PICKUP" | "IN_TRANSIT" | "AT_DELIVERY";
export type PhotoSide = "FRONT" | "BACK" | "LEFT" | "RIGHT";

export interface OrderPhoto {
  id: string;
  orderId: string;
  uploaderPhone: string;
  uploaderRole: "CUSTOMER" | "DRIVER";
  stage: PhotoStage;
  side?: PhotoSide | null;
  driverOnly?: boolean;
  dataUrl: string;
  note: string | null;
  createdAt: string;
}

export interface AIComparison {
  id: string;
  orderId: string;
  customerPhotoIds: string[];
  driverPhotoIds: string[];
  matchPercentage: number;       // 0-100: same item confidence
  conditionPercentage: number;   // 0-100: cargo condition
  observedItem: string | null;
  damageNotes: string | null;
  recommendation: "OK_TO_PROCEED" | "INSPECT_WITH_CUSTOMER" | "REFUSE_PICKUP" | string;
  provider: "gemini" | "z-ai" | "heuristic";
  createdAt: string;
}

export type PaymentMethod = "CARD" | "CASH";
export type PaymentStatus = "PENDING" | "AUTHORIZED" | "CAPTURED" | "REFUNDED" | "FAILED";
export type CardBrand = "visa" | "mastercard" | "uzcard" | "humo" | "unknown";

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  cardLast4?: string | null;
  cardBrand?: CardBrand | null;
  cardHolderName?: string | null;
  transactionId?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIAnalysis {
  recommendedCargoType: CargoType;
  estimatedWeightKg: number;
  recommendedPriceSom: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  cargoDescription: string;
  routeNotes: string;
  loadingTips: string;
  riskLevel: "low" | "medium" | "high";
  provider: "gemini" | "z-ai" | "heuristic";
}
