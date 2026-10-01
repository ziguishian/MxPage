import { HomeCreateWorkspace } from "@/components/projects/home-create-workspace";
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return (
    <div className="space-y-6" data-home-workspace>
      <HomeCreateWorkspace />
    </div>
  );
}
