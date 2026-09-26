import { catalog } from "./catalog";
export type Language = "en" | "pt" | "es";
export function resolveLanguage(
  saved: string | null,
  browser: string,
): Language {
  const value = (saved || browser).toLowerCase().split("-")[0];
  return value === "pt" || value === "es" ? value : "en";
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = catalog.map((row) => ({
  row,
  pattern: new RegExp(
    "^" +
      row[0]
        .split(/\{\d+\}/)
        .map(escape)
        .join("(.*?)") +
      "$",
  ),
}));
export function translate(source: string, language: Language): string {
  const index = language === "pt" ? 0 : language === "en" ? 1 : 2;
  for (const { row, pattern } of patterns) {
    const match = pattern.exec(source);
    if (match)
      return row[index].replace(/\{(\d+)\}/g, (_, n) => {
        const value = match[Number(n) + 1];
        return source.startsWith("WebAssembly:")
          ? translate(value, language)
          : value;
      });
  }
  if (source.includes("\n"))
    return source
      .split("\n")
      .map((line) => translate(line, language))
      .join("\n");
  return source;
}
