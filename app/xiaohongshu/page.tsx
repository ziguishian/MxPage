import { XiaohongshuQuickCreate } from "@/components/xiaohongshu/xiaohongshu-quick-create";

export default function XiaohongshuPage({ searchParams }: { searchParams: { project?: string } }) {
  return <XiaohongshuQuickCreate initialProjectId={searchParams.project}/>;
}
