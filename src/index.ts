export interface LedgerEntry {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: Date;
}

export interface LedgerConfig {
  tenantId: string;
}

export class Ledger {
  private config: LedgerConfig;

  constructor(config: LedgerConfig) {
    this.config = config;
  }

  getTenantId(): string {
    return this.config.tenantId;
  }
}

export const VERSION = "0.0.0";
