/** Creates an element and sets its text with `textContent` only. Data never goes through `innerHTML`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Formats a value or says it is missing; a missing value is never printed as 0. */
export function fmt(v: number, digits: number, unit: string): string {
  return Number.isFinite(v) ? `${v.toFixed(digits)} ${unit}`.trim() : 'missing';
}
