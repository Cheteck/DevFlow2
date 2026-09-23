export interface AuthenticationRequest {
  provider: string;
  method?: string;
  credentials: Record<string, unknown>;
  tenantId: string;
  context?: Record<string, unknown>;
}
