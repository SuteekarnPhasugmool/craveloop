import DeliveryHome from "@/components/group-order/DeliveryHome";
import { homeCatalog } from "@/components/group-order/home-catalog";
export default function Home() {
  return <DeliveryHome catalog={homeCatalog} />;
}
