import { notFound } from "next/navigation";
import { DetailWorkspace } from "@/components/editor/detail-workspace";
import { getProjectDetail } from "@/lib/services/project-service";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: { id: string } }) {
  const project = await getProjectDetail(params.id);
  if (!project) notFound();
  return <DetailWorkspace initialProject={JSON.parse(JSON.stringify(project))}/>;
}
