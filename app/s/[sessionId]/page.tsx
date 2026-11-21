import Room from "@/components/Room";
export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <Room sessionId={sessionId} />;
}
