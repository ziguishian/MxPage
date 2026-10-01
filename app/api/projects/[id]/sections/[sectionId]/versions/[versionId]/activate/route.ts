import { activateSectionVersion } from "@/lib/services/generation-service";
import { assertNoDetailRun } from "@/lib/detail-runs/lock";
import { prisma } from "@/lib/db/prisma";
import { handleRouteError, ok } from "@/lib/utils/route";

export async function PATCH(
  _request: Request,
  context: { params: { id: string; sectionId: string; versionId: string } },
) {
  try {
    await assertNoDetailRun(context.params.id);
    await prisma.sectionVersion.findFirstOrThrow({ where: { id: context.params.versionId, sectionId: context.params.sectionId, section: { projectId: context.params.id } } });
    const version = await activateSectionVersion(context.params.sectionId, context.params.versionId);
    return ok(version);
  } catch (error) {
    return handleRouteError(error);
  }
}
