import LineRoom from "@/components/line/LineRoom";
export default async function LinePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return <LineRoom sessionId={(await params).sessionId} />;
}
