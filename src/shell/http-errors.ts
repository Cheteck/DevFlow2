/**
 * @mosaix/shell — RFC 7807 Problem Details HTTP Error Standardizer
 */

import type { ServerResponse } from "node:http";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  invalidParams?: Array<{ name: string; reason: string }>;
  [key: string]: unknown;
}

export function sendProblemResponse(
  res: ServerResponse,
  status: number,
  title: string,
  detail?: string,
  additional: Record<string, unknown> = {}
): void {
  const problem: ProblemDetails = {
    type: `https://mosaix.local/errors/${status}`,
    title,
    status,
    detail,
    timestamp: new Date().toISOString(),
    ...additional,
  };

  res.writeHead(status, {
    "Content-Type": "application/problem+json",
  });
  res.end(JSON.stringify(problem, null, 2));
}
