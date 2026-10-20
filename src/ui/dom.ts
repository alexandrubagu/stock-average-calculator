export function byId<T extends Element = HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as unknown as T
}

/** Writes text only when it changed, to avoid needless layout work. */
export function setText(element: Element, text: string): void {
  if (element.textContent !== text) element.textContent = text
}

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}
