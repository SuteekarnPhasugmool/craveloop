import GroupRoom from "@/components/group-order/GroupRoom";
export default async function GroupPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return <GroupRoom sessionId={(await params).sessionId} />;
}
