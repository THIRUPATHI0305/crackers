/** Minimum enquiry / cart total (offer price) required to submit. */
export const MIN_ENQUIRY_AMOUNT = 500;

export function meetsMinEnquiryAmount(estimated: number) {
  return estimated >= MIN_ENQUIRY_AMOUNT;
}

export function amountNeededForMinEnquiry(estimated: number) {
  return Math.max(0, MIN_ENQUIRY_AMOUNT - estimated);
}
