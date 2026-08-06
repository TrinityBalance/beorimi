import { normalizeItemName } from "./disposal.ts";

export type FeeCatalogRule = {
  rule_key: string;
  item_name: string;
  aliases: string[];
  category: string;
  fee: number;
  size_label: string;
  min_longest_side_cm: number | null;
  max_longest_side_cm: number | null;
  specification: string;
  match_kind: "all" | "label" | "longest_side_cm" | "confirmation";
};

export type FeeCatalogMatch = {
  matched: boolean;
  itemName: string | null;
  fee: number | null;
  feeMin: number | null;
  feeMax: number | null;
  sizeLabel: string | null;
};

function matchingAliasLength(name: string, aliases: string[]) {
  return aliases.reduce((longest, alias) => {
    const normalizedAlias = normalizeItemName(alias);
    if (!normalizedAlias) return longest;
    return name === normalizedAlias || name.includes(normalizedAlias)
      ? Math.max(longest, normalizedAlias.length)
      : longest;
  }, 0);
}

function hasNumericRange(value: string) {
  return /\d\s*(?:~|～|-|–|—)\s*\d/u.test(value);
}

function resolveUniqueRule(
  item: Record<string, unknown>,
  rules: FeeCatalogRule[],
) {
  if (rules.length === 1) return rules[0];

  const rawName = typeof item.label === "string" ? item.label : "";
  const name = normalizeItemName(rawName);
  if (!hasNumericRange(rawName)) {
    const labelMatches = rules.filter((rule) =>
      rule.match_kind === "label" &&
      name.includes(normalizeItemName(rule.specification))
    );
    if (labelMatches.length === 1) return labelMatches[0];
  }

  const longestSide = typeof item.longest_side_cm === "number"
    ? item.longest_side_cm
    : null;
  if (longestSide !== null) {
    const rangeMatches = rules.filter((rule) =>
      rule.match_kind === "longest_side_cm" &&
      (rule.min_longest_side_cm === null ||
        longestSide >= rule.min_longest_side_cm) &&
      (rule.max_longest_side_cm === null ||
        longestSide <= rule.max_longest_side_cm)
    );
    if (rangeMatches.length === 1) return rangeMatches[0];
  }

  return null;
}

export function findFeeCatalogMatch(
  item: Record<string, unknown>,
  rules: FeeCatalogRule[],
): FeeCatalogMatch {
  const name = typeof item.label === "string"
    ? normalizeItemName(item.label)
    : "";
  if (!name) {
    return {
      matched: false,
      itemName: null,
      fee: null,
      feeMin: null,
      feeMax: null,
      sizeLabel: null,
    };
  }

  const scored = rules
    .map((rule) => ({ rule, score: matchingAliasLength(name, rule.aliases) }))
    .filter(({ score }) => score > 0);
  if (scored.length === 0) {
    return {
      matched: false,
      itemName: null,
      fee: null,
      feeMin: null,
      feeMax: null,
      sizeLabel: null,
    };
  }

  const bestScore = Math.max(...scored.map(({ score }) => score));
  const candidates = scored
    .filter(({ score }) => score === bestScore)
    .map(({ rule }) => rule);
  const itemName = candidates[0]?.item_name ?? null;

  // AIDEV-NOTE: Official rows often share a name but differ by specification; keep the single fee null
  // when ambiguous and expose the official min/max range instead of selecting an arbitrary row.
  const resolved = resolveUniqueRule(item, candidates);
  if (resolved) {
    return {
      matched: true,
      itemName: resolved.item_name,
      fee: resolved.fee,
      feeMin: resolved.fee,
      feeMax: resolved.fee,
      sizeLabel: resolved.size_label,
    };
  }

  const distinctFees = new Set(candidates.map((rule) => rule.fee));
  const fees = [...distinctFees];
  return {
    matched: true,
    itemName,
    fee: fees.length === 1 ? fees[0] : null,
    feeMin: Math.min(...fees),
    feeMax: Math.max(...fees),
    sizeLabel: null,
  };
}
