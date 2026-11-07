import { describe, expect, it } from "vitest";
import {
  PRINT_SCRIPT,
  PRINT_SCRIPT_SHA256,
  PRINT_STYLE,
  reportCsp,
  reportDocumentResponse,
} from "./report-sandbox";

describe("report-sandbox", () => {
  // The hash is hardcoded because the CSP needs it synchronously, so editing
  // PRINT_SCRIPT without editing the constant would block the print script and
  // silently break "Export". This is what catches that.
  it("authorizes the print script by the digest of its own text", async () => {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(PRINT_SCRIPT),
    );
    const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));

    expect(base64).toBe(PRINT_SCRIPT_SHA256);
    expect(reportCsp(true)).toContain(`script-src 'sha256-${base64}'`);
  });

  // The saved report carries `html, body { height: 100%; overflow: hidden }`;
  // without this override the print dialog clips the PDF to one viewport.
  it("prints the whole document, not one clipped viewport", async () => {
    const response = reportDocumentResponse("<html><body>r</body></html>", {
      print: true,
      cacheControl: "private, no-store",
    });
    const body = await response.text();

    expect(body).toContain(PRINT_STYLE);
    expect(PRINT_STYLE).toContain("@page{size:A4");
    expect(PRINT_STYLE).toContain(
      "html,body{height:auto!important;min-height:0!important;overflow:visible!important}",
    );
    expect(PRINT_STYLE).toContain("@media print{");
  });

  it("leaves the on-screen document untouched outside print mode", async () => {
    const response = reportDocumentResponse("<html><body>r</body></html>", {
      cacheControl: "private, no-store",
    });

    expect(await response.text()).toBe("<html><body>r</body></html>");
  });
});
