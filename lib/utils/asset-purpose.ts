/** Missing metadata keeps the meaning of historical REFERENCE/product uploads. */
export function isStyleReference(asset: { metadata?: unknown }) {
  return (asset.metadata as { purpose?: string } | null)?.purpose === "style_reference";
}

export function creativePreferences(snapshot: Record<string, any> = {}) {
  const suggested = snapshot.creationBrief?.recommendedVisualDirection || snapshot.creationBrief?.visualDirection || "";
  if (snapshot.creativePreferences?.version === 2) return {
    version: 2 as const, recommendedDirection: suggested,
    userDirection: String(snapshot.creativePreferences.userDirection || ""),
  };
  const legacy = snapshot.agentVisualStyle || "";
  // Old configuration stored untouched AI suggestions and planner output as user input.
  const generated = legacy === suggested || legacy === snapshot.commercePlan?.style;
  return { version: 2 as const, recommendedDirection: suggested, userDirection: generated ? "" : String(legacy) };
}
