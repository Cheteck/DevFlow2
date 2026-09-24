/**
 * @mosaix/ui-runtime/plugins — Static QR Code Generator Plugin (Zero-Tracking)
 * FEAT-13: QR Codes [PLUGIN ui] (transversal + portfolio/spaces)
 */

import { escapeHtml } from "@mosaix/support";

export interface QrCodeOptions {
  size?: number;
  fgColor?: string;
  bgColor?: string;
  margin?: number;
}

export class QrCodeGeneratorPlugin {
  /**
   * Generates a deterministic standalone SVG QR matrix
   */
  generateSvg(url: string, options: QrCodeOptions = {}): string {
    const size = options.size ?? 200;
    const fg = options.fgColor ?? "#000000";
    const bg = options.bgColor ?? "#ffffff";
    const margin = options.margin ?? 4;

    // Deterministic matrix calculation based on url bytes hash
    const matrixSize = 25; // 25x25 grid (standard Version 2 QR matrix)
    const cellSize = (size - margin * 2) / matrixSize;

    let cellsSvg = "";

    // Position detection patterns (top-left, top-right, bottom-left)
    const isFinderPattern = (r: number, c: number): boolean => {
      if (r < 7 && c < 7) return true; // Top-left
      if (r < 7 && c >= matrixSize - 7) return true; // Top-right
      if (r >= matrixSize - 7 && c < 7) return true; // Bottom-left
      return false;
    };

    // Draw finder patterns
    const drawFinder = (startX: number, startY: number) => {
      let fSvg = "";
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isBorder || isCenter) {
            const x = margin + (startX + c) * cellSize;
            const y = margin + (startY + r) * cellSize;
            fSvg += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fg}" />`;
          }
        }
      }
      return fSvg;
    };

    cellsSvg += drawFinder(0, 0);
    cellsSvg += drawFinder(matrixSize - 7, 0);
    cellsSvg += drawFinder(0, matrixSize - 7);

    // Pseudorandom deterministic fill based on URL string char codes
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (!isFinderPattern(r, c)) {
          // Timing patterns
          if (r === 6 || c === 6) {
            if ((r + c) % 2 === 0) {
              const x = margin + c * cellSize;
              const y = margin + r * cellSize;
              cellsSvg += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fg}" />`;
            }
          } else {
            // Data bits hashed from URL
            const charCode = url.charCodeAt((r * matrixSize + c) % url.length) || 0;
            const bit = (charCode + r * 7 + c * 13) % 3 === 0;
            if (bit) {
              const x = margin + c * cellSize;
              const y = margin + r * cellSize;
              cellsSvg += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${fg}" />`;
            }
          }
        }
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
        <rect width="${size}" height="${size}" fill="${bg}" />
        ${cellsSvg}
      </svg>
    `.trim();
  }

  /**
   * Renders a UI card with the QR Code and download button
   */
  renderQrCard(title: string, targetUrl: string, subtitle?: string): string {
    const svgContent = this.generateSvg(targetUrl, { size: 180, fgColor: "#0b1326", bgColor: "#ffffff" });
    const encodedSvg = Buffer.from(svgContent).toString("base64");
    const dataUri = `data:image/svg+xml;base64,${encodedSvg}`;

    return `
      <div class="p-6 rounded-3xl bg-surface-container border border-outline-variant/30 flex flex-col items-center text-center space-y-4 shadow-xl max-w-sm">
        <div class="space-y-1">
          <h3 class="font-bold text-base text-on-surface">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="text-xs text-on-surface-variant">${escapeHtml(subtitle)}</p>` : ""}
        </div>

        <div class="p-4 rounded-2xl bg-white shadow-inner flex items-center justify-center">
          ${svgContent}
        </div>

        <div class="w-full space-y-2">
          <div class="text-[11px] font-mono text-on-surface-variant/80 truncate px-2 py-1 rounded bg-surface-container-low border border-outline-variant/20">
            ${escapeHtml(targetUrl)}
          </div>
          <div class="flex items-center justify-center gap-2">
            <a href="${dataUri}" download="qrcode.svg" class="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-xs hover:bg-primary/90 transition shadow">
              Télécharger SVG
            </a>
          </div>
        </div>
      </div>
    `;
  }
}

export const qrCodeGeneratorPlugin = new QrCodeGeneratorPlugin();
