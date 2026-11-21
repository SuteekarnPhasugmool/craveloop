import GroupRoom from "@/components/group-order/GroupRoom";

export default async function GroupShopPage({
  params,
}: {
  params: Promise<{ sessionId: string; restaurantId: string }>;
}) {
  const { sessionId, restaurantId } = await params;
  return (
    <GroupRoom key={sessionId} sessionId={sessionId} shopId={restaurantId} />
  );
}
