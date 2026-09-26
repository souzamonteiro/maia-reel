import { test } from "node:test";
import assert from "node:assert/strict";
import { translate, resolveLanguage } from "../packages/i18n";
import { catalog } from "../packages/i18n/catalog";
test("locale preference and browser detection", () => {
  assert.equal(resolveLanguage(null, "pt-BR"), "pt");
  assert.equal(resolveLanguage("es", "en-US"), "es");
  assert.equal(resolveLanguage(null, "de"), "en");
});
test("catalog placeholders stay consistent and preserve user arguments", () => {
  for (const row of catalog) {
    const placeholders = (s: string) => s.match(/\{\d+\}/g)?.sort() || [];
    assert.deepEqual(placeholders(row[0]), placeholders(row[1]));
    assert.deepEqual(placeholders(row[0]), placeholders(row[2]));
  }
  assert.equal(
    translate("Faixa para Reproduzir.png", "en"),
    "Track for Reproduzir.png",
  );
  assert.equal(
    translate("<script>user content</script>", "es"),
    "<script>user content</script>",
  );
  assert.equal(translate("Reproduzir", "en"), "Play");
});
