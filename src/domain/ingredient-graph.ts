// Reviewed synthetic facts for specific seed-v2 SKUs. Every edge is directional.
export const GRAPH_VERSION = "thai-ingredients-v1";
export const GRAPH_CATALOG_VERSION = "seed-v2";
export const facts = [
  {
    id: "recipe-03-03",
    from: "r03-m03",
    relation: "CONTAINS",
    to: "paste-x",
    scope: "recipe",
    source: "Fixture recipe for spicy grilled chicken lists paste X.",
  },
  {
    id: "label-x",
    from: "paste-x",
    relation: "CONTAINS",
    to: "shrimp",
    scope: "product",
    source: "Fixture label X lists shrimp.",
  },
  {
    id: "trace-x",
    from: "paste-x",
    relation: "MAY_CONTAIN",
    to: "peanut",
    scope: "product",
    source: "Fixture label X lists possible peanut traces.",
  },
  {
    id: "class-shrimp",
    from: "shrimp",
    relation: "IS_A",
    to: "shellfish",
    scope: "taxonomy",
    source: "Synthetic catalog ingredient taxonomy.",
  },
] as const;

export function describeIngredientPath(menuId: string, ids: string[]) {
  let node = menuId;
  const chain = [menuId],
    sources: string[] = [];
  for (const id of ids) {
    const fact = facts.find((edge) => edge.id === id && edge.from === node);
    if (!fact) return;
    chain.push(fact.to);
    sources.push(
      `${fact.id} (${fact.scope}, ${fact.relation}): ${fact.source}`,
    );
    node = fact.to;
  }
  if (sources.length) return `${chain.join(" → ")} · ${sources.join(" · ")}`;
}
export function ingredientPath(
  menuId: string,
  restriction: string,
  allergy: boolean,
): string[] | undefined {
  const seen = new Set<string>();
  function visit(node: string, path: string[]): string[] | undefined {
    if (node === restriction) return path;
    if (seen.has(node)) return;
    seen.add(node);
    for (const edge of facts) {
      if (edge.from !== node || (edge.relation === "MAY_CONTAIN" && !allergy))
        continue;
      const result = visit(edge.to, [...path, edge.id]);
      if (result) return result;
    }
  }
  return visit(menuId, []);
}
