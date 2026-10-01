"use client";

import Link from "next/link";
import { useState } from "react";
import { Layers3, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/utils";
import { platformLabels } from "@/types/domain";

interface RecentProjectListProps {
  initialProjects: Array<{
    id: string;
    name: string;
    status: string;
    platform: string;
    style: string;
    sectionCount: number;
    updatedAt: string | Date;
    coverImageUrl?: string | null;
  }>;
}

export function RecentProjectList({ initialProjects }: RecentProjectListProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    const response = await fetch(`/api/projects/${pendingDelete.id}`, { method: "DELETE" });
    const payload = await response.json();

    if (!payload.success) {
      toast.error(payload.error?.message ?? "项目删除失败");
      setDeleting(false);
      return;
    }

    setProjects((current) => current.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
    setDeleting(false);
    toast.success("项目已删除");
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
        还没有历史项目，先从上方上传一张主商品图开始。
      </div>
    );
  }

  return (
    <div className="columns-1 gap-4 md:columns-2 xl:columns-4">
      {projects.map((project) => (
        <article key={project.id} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg">
          <Link href={project.platform === "xiaohongshu" ? `/xiaohongshu?project=${project.id}` : `/projects/${project.id}/${project.sectionCount ? "editor" : "configure"}`} aria-label={`打开作品：${project.name}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground">
            {project.coverImageUrl ? <img src={project.coverImageUrl} alt={project.name} className="block h-auto min-h-52 w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.02]"/> : <div className="flex aspect-square items-center justify-center bg-muted text-muted-foreground"><Layers3 className="h-8 w-8"/></div>}
            <div className="project-card-overlay pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-5 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
              <h3 className="line-clamp-2 text-lg font-semibold">{project.name}</h3>
              <p className="mt-2 text-sm text-white/90">{platformLabels[project.platform as keyof typeof platformLabels] ?? project.platform} · {project.sectionCount} 个模块</p>
              <p className="mt-2 text-xs text-white/80">{formatDate(project.updatedAt)}</p>
              <span className="mt-3 text-sm">查看详情 ↗</span>
            </div>
          </Link>
          <button type="button" onClick={() => setPendingDelete({id:project.id,name:project.name})} aria-label={`删除项目 ${project.name}`} className="project-card-overlay absolute right-3 top-3 rounded-full border border-border bg-card p-2.5 text-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"><Trash2 className="h-4 w-4"/></button>
        </article>
      ))}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        loading={deleting}
        title={pendingDelete ? `删除项目「${pendingDelete.name}」？` : "删除项目？"}
        description="这会同时删除该项目的关联素材、生成结果与版本记录，操作不可恢复。"
        confirmText="确认删除"
        cancelText="暂不删除"
        destructive
        icon={<Trash2 className="h-5 w-5" />}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
