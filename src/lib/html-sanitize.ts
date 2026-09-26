/**
 * Módulo de Sanitização e Escape para Prevenção de XSS e HTML Injection
 */

/**
 * Escapa caracteres especiais de HTML para uso seguro em contextos de texto/atributos HTML
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitiza identificadores CSS para uso seguro dentro de tags <style>
 * Permite apenas caracteres alfanuméricos, hífens e underscores
 */
export function sanitizeCssIdentifier(identifier: string): string {
  if (!identifier) return "default";
  return identifier.replace(/[^a-zA-Z0-9_-]/g, "");
}
