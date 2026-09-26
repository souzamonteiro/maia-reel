import { resolveLanguage, translate, type Language } from "./index";
const key = "maiaReelLanguage";
let saved: string | null = null;
try {
  saved = localStorage.getItem(key);
} catch {
  /* Storage may be disabled. */
}
let language = resolveLanguage(saved, navigator.language);
export const t = (source: string) => translate(source, language);
export function setText<T extends HTMLElement>(element: T, source: string) {
  element.dataset.reelI18n = source;
  element.textContent = t(source);
  return element;
}
export function setAttribute(
  element: HTMLElement,
  attribute: string,
  source: string,
) {
  element.setAttribute("data-reel-" + attribute, source);
  element.setAttribute(attribute, t(source));
}
function refresh() {
  document.documentElement.lang = language;
  document.title = t("Maia Reel — Editor local");
  document
    .querySelectorAll<HTMLElement>("[data-reel-i18n]")
    .forEach((el) => (el.textContent = t(el.dataset.reelI18n!)));
  for (const attr of ["placeholder", "aria-label", "alt"]) {
    document
      .querySelectorAll<HTMLElement>("[data-reel-" + attr + "]")
      .forEach((el) =>
        el.setAttribute(attr, t(el.getAttribute("data-reel-" + attr)!)),
      );
  }
}
export function initializeLanguage(root: HTMLElement) {
  // Bind only the initial interface, before user content is rendered.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (
      !node.textContent?.trim() ||
      node.parentElement?.closest("#projectName, #language")
    )
      continue;
    const span = document.createElement("span");
    setText(span, node.textContent.trim());
    node.replaceWith(span);
  }
  for (const attr of ["placeholder", "aria-label", "alt"]) {
    root
      .querySelectorAll<HTMLElement>("[" + attr + "]")
      .forEach((el) => setAttribute(el, attr, el.getAttribute(attr)!));
  }
  const select = document.getElementById("language") as HTMLSelectElement;
  select.value = language;
  select.onchange = () => {
    language = select.value as Language;
    try {
      localStorage.setItem(key, language);
    } catch {
      /* Keep the in-memory preference. */
    }
    refresh();
  };
  refresh();
}
