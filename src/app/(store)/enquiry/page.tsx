import { getLoyaltyPublicSettings } from "@/lib/shop-settings";
import EnquiryClient from "./enquiry-client";

export default async function EnquiryPage() {
  const loyalty = await getLoyaltyPublicSettings();
  return <EnquiryClient loyalty={loyalty} />;
}
