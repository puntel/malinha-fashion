import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { escapeHtml, sanitizeCssIdentifier } from "@/lib/html-sanitize";

// Componente React de teste que renderiza dados vindos do usuário (ex: nome do cliente / loja)
const UserProfileDisplay: React.FC<{ clientName: string; storeName: string }> = ({
  clientName,
  storeName,
}) => {
  return (
    <div data-testid="user-display">
      <h1 data-testid="client-name">{clientName}</h1>
      <p data-testid="store-name">{storeName}</p>
    </div>
  );
};

describe("Auditoria de XSS, innerHTML e Sanitização de Saída no Navegador", () => {
  describe("1. Renderização em Ambiente Isolado de Navegador (DOM / React)", () => {
    it("deve renderizar marcador HTML inofensivo como TEXTO PURO, sem criar elemento no DOM", () => {
      // Injeção de marcador HTML inofensivo com id específico para rastreamento no DOM
      const marcadorInofensivo = '<b id="probe-marker-element">Texto Marcador</b>';
      const marcadorImagem = '<img src="inofensivo.png" id="probe-img-element" onerror="window.__xssTriggered=true" />';

      // Renderiza no ambiente DOM isolado (jsdom)
      const { container } = render(
        <UserProfileDisplay
          clientName={marcadorInofensivo}
          storeName={marcadorImagem}
        />
      );

      // 1. Confirma que os elementos NÃO foram criados como nós HTML na árvore DOM
      const elementoMarcador = container.querySelector("#probe-marker-element");
      const elementoImagem = container.querySelector("#probe-img-element");

      expect(elementoMarcador).toBeNull();
      expect(elementoImagem).toBeNull();

      // 2. Confirma que nenhum evento (onerror/onload) foi disparado
      expect((window as any).__xssTriggered).toBeUndefined();

      // 3. Confirma que o marcador aparece visível exatamente como texto literal seguro
      const clientNameEl = screen.getByTestId("client-name");
      expect(clientNameEl.textContent).toBe(marcadorInofensivo);

      const storeNameEl = screen.getByTestId("store-name");
      expect(storeNameEl.textContent).toBe(marcadorImagem);
    });
  });

  describe("2. Sanitização de Templates HTML de Impressão e E-mail", () => {
    it("deve escapar tags HTML para prevenir HTML Injection em win.document.write e emails", () => {
      const payloadInjetado = '<span id="probe-template-span">Injeção</span><script>alert(1)</script>';

      const sanitizado = escapeHtml(payloadInjetado);

      // Confirma que os delimitadores perigosos foram substituídos por entidades seguras
      expect(sanitizado).not.toContain("<span");
      expect(sanitizado).not.toContain("<script>");
      expect(sanitizado).toContain("&lt;span id=&quot;probe-template-span&quot;&gt;");
      expect(sanitizado).toContain("&lt;script&gt;");

      // Simulação do parser do navegador ao receber o template sanitizado
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${sanitizado}</div>`, "text/html");

      // Confirma que nenhum elemento #probe-template-span ou <script> foi gerado no DOM parseado
      expect(doc.querySelector("#probe-template-span")).toBeNull();
      expect(doc.querySelector("script")).toBeNull();
      expect(doc.body.textContent).toContain(payloadInjetado);
    });

    it("deve escapar aspas simples e duplas para contextos de atributos HTML", () => {
      const atributoPerigoso = `Loja "Fashion" & 'Elegance'`;
      const escapado = escapeHtml(atributoPerigoso);

      expect(escapado).toBe("Loja &quot;Fashion&quot; &amp; &#039;Elegance&#039;");
      expect(escapado).not.toContain('"');
      expect(escapado).not.toContain("'");
    });
  });

  describe("3. Sanitização de Identificadores CSS (dangerouslySetInnerHTML em <style>)", () => {
    it("deve remover caracteres especiais de IDs para prevenir CSS Injection", () => {
      const idMalicioso = 'chart-123] { color: red; } </style><script>alert(1)</script>';
      const idSanitizado = sanitizeCssIdentifier(idMalicioso);

      expect(idSanitizado).not.toContain("]");
      expect(idSanitizado).not.toContain("{");
      expect(idSanitizado).not.toContain("}");
      expect(idSanitizado).not.toContain("</style>");
      expect(idSanitizado).toBe("chart-123colorredstylescriptalert1script");
    });

    it("deve manter identificadores válidos intactos", () => {
      const idValido = "chart_sales-2026";
      expect(sanitizeCssIdentifier(idValido)).toBe("chart_sales-2026");
    });
  });
});
