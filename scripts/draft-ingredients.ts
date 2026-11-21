import { fileURLToPath } from "node:url";
import sources from "../data/ingredient-sources.json";
import { catalog, CATALOG_VERSION } from "../src/adapters/catalog";
import {
  facts,
  GRAPH_VERSION,
  GRAPH_CATALOG_VERSION,
} from "../src/domain/ingredient-graph";

type Source = (typeof sources)[number];
const aliases = new Map(
  Object.entries({
    "กะปิสูตร X": "paste-x",
    "กะปิสูตร Y": "paste-y",
    กุ้ง: "shrimp",
    ถั่วลิสง: "peanut",
    ถั่วเหลือง: "soy",
    งา: "sesame",
  }),
);

// Only read the bundled recipe/label corpus. A SKU or product formula is
// always the subject, including when two labels use the same ingredient name.
export function draftIngredientFacts(corpus: Source[] = sources) {
  if (CATALOG_VERSION !== GRAPH_CATALOG_VERSION)
    throw new Error("Catalog snapshot changed");
  const queue = catalog
    .flatMap((r) => r.menus)
    .filter((m) => !m.ingredientsComplete || facts.some((f) => f.from === m.id))
    .map((m) => ({ subject: m.id, scope: "recipe" }));
  const inspected = new Set<string>();
  const proposed = [],
    conflicts = [],
    corroborated = [];
  while (queue.length) {
    const { subject, scope } = queue.shift()!;
    const url = `fixture://${CATALOG_VERSION}/${scope === "recipe" ? "recipes" : "products"}/${subject}`;
    if (inspected.has(url)) continue;
    inspected.add(url);
    const documents = corpus.filter(
      (d) => d.url === url && d.subject === subject && d.scope === scope,
    );
    const entries = documents.flatMap((d) =>
      d.lines.flatMap((quote) => {
        const match = /^(Contains|May contain|Free of): (.+)\.$/.exec(quote);
        const to = match && aliases.get(match[2]);
        if (!match || !to) return [];
        return [
          {
            from: subject,
            to,
            relation:
              match[1] === "Contains"
                ? "CONTAINS"
                : match[1] === "May contain"
                  ? "MAY_CONTAIN"
                  : "FREE_OF",
            scope,
            url,
            quote,
          },
        ];
      }),
    );
    for (const edge of entries) {
      const approved = facts.find(
        (f) => f.from === subject && f.to === edge.to,
      );
      if (
        entries.some((e) => e.to === edge.to && e.relation !== edge.relation) ||
        (approved && approved.relation !== edge.relation)
      ) {
        conflicts.push(edge);
        continue;
      }
      if (edge.relation === "FREE_OF") continue;
      if (approved) corroborated.push({ ...edge, factId: approved.id });
      else proposed.push(edge);
      if (corpus.some((d) => d.scope === "product" && d.subject === edge.to))
        queue.push({ scope: "product", subject: edge.to });
    }
  }
  return {
    catalogVersion: CATALOG_VERSION,
    baseGraphVersion: GRAPH_VERSION,
    status: "needs_human_review",
    searched: [...inspected],
    proposed,
    conflicts,
    corroborated,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(draftIngredientFacts(), null, 2));
}
