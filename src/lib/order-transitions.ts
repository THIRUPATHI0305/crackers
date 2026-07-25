export const ORDER_TRANSITIONS: Record<string, string[]> = {
  ENQUIRY_RECEIVED: ["ORDER_CONFIRMED", "CANCELLED"],
  ORDER_CONFIRMED: ["PACKING", "CANCELLED"],
  PACKING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["LR_SENT"],
  LR_SENT: [],
  CANCELLED: [],
};

/**
 * Full status list for admin dropdown — any can be selected and
 * WhatsApp-notified at any time (not limited to next-step only).
 */
export const ADMIN_STATUS_OPTIONS = [
  "PACKING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "LR_SENT",
  "READY_FOR_PICKUP",
  "ORDER_CONFIRMED",
  "CANCELLED",
] as const;

/** Friendly labels for admin / WhatsApp */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  ENQUIRY_RECEIVED: "Enquiry received",
  ORDER_CONFIRMED: "Order confirmed",
  PACKING: "Packing",
  PACKED: "Packed",
  READY_FOR_PICKUP: "Ready for pickup",
  SHIPPED: "Lorry dispatched",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  LR_SENT: "LR copy sent",
  CANCELLED: "Cancelled",
};

/** Statuses that require LR / proof upload before update */
export const STATUS_REQUIRES_LR = new Set(["LR_SENT"]);

/** Feedback allowed after delivery (including after LR sent) */
export const FEEDBACK_ALLOWED_STATUSES = new Set(["DELIVERED", "LR_SENT"]);
