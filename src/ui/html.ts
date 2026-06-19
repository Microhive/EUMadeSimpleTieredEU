export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
