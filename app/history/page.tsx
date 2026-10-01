import { RecentProjectList } from "@/components/projects/recent-project-list";
import { PageHeader } from "@/components/shared/page-header";
import { listProjects } from "@/lib/services/project-service";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const projects = await listProjects();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="创作画廊"
        title="我的作品"
        description="点击作品继续创作、修改或下载。"
      />

      <RecentProjectList initialProjects={projects} />
    </div>
  );
}
