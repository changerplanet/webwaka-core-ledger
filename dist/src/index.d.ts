export interface LedgerConfig {
    tenantId: string;
}
export interface OpenAccountParams {
    accountId?: string;
    accountType: string;
    currency: string;
    metadata?: Record<string, unknown>;
}
export interface RecordEventParams {
    eventId?: string;
    accountId: string;
    eventType: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    description?: string;
    metadata?: Record<string, unknown>;
}
export interface ReverseEventParams {
    originalEventId: string;
    reversalEventId?: string;
    idempotencyKey: string;
    description?: string;
}
export interface AccountBalance {
    accountId: string;
    balance: string;
    currency: string;
    eventCount: number;
}
export interface StatementEntry {
    eventId: string;
    eventType: string;
    amount: string;
    runningBalance: string;
    description: string | null;
    createdAt: Date;
}
export interface AccountStatement {
    accountId: string;
    currency: string;
    entries: StatementEntry[];
    openingBalance: string;
    closingBalance: string;
}
export interface IntegrityReport {
    valid: boolean;
    accountId: string;
    expectedBalance: string;
    calculatedBalance: string;
    eventCount: number;
    errors: string[];
}
export interface AuditEventParams {
    entityType: string;
    entityId: string;
    action: string;
    actorId?: string;
    payload?: Record<string, unknown>;
}
export interface LedgerAccount {
    id: string;
    tenantId: string;
    accountType: string;
    currency: string;
    metadata: string | null;
    createdAt: Date;
}
export interface LedgerEvent {
    id: string;
    tenantId: string;
    accountId: string;
    eventType: string;
    amount: string;
    currency: string;
    idempotencyKey: string;
    reversesEventId: string | null;
    description: string | null;
    metadata: string | null;
    sequenceNumber: number;
    createdAt: Date;
}
export interface AuditEvent {
    id: string;
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorId: string | null;
    payload: string | null;
    createdAt: Date;
}
export interface LedgerStorage {
    getAccount(tenantId: string, accountId: string): Promise<LedgerAccount | undefined>;
    createAccount(account: Omit<LedgerAccount, "createdAt">): Promise<LedgerAccount>;
    getEventByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<LedgerEvent | undefined>;
    getEventById(tenantId: string, eventId: string): Promise<LedgerEvent | undefined>;
    getEventsByAccountId(tenantId: string, accountId: string): Promise<LedgerEvent[]>;
    getNextSequenceNumber(tenantId: string, accountId: string): Promise<number>;
    createEvent(event: Omit<LedgerEvent, "createdAt">): Promise<LedgerEvent>;
    createAuditEvent(event: Omit<AuditEvent, "createdAt">): Promise<AuditEvent>;
}
export declare class LedgerError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
export declare class Ledger {
    private config;
    private storage;
    constructor(config: LedgerConfig, storage: LedgerStorage);
    getTenantId(): string;
    private emitAuditEvent;
    openAccount(params: OpenAccountParams): Promise<LedgerAccount>;
    recordEvent(params: RecordEventParams): Promise<LedgerEvent>;
    reverseEvent(params: ReverseEventParams): Promise<LedgerEvent>;
    getAccountBalance(accountId: string): Promise<AccountBalance>;
    getAccountStatement(accountId: string, options?: {
        fromDate?: Date;
        toDate?: Date;
    }): Promise<AccountStatement>;
    verifyLedgerIntegrity(accountId: string): Promise<IntegrityReport>;
}
export declare const VERSION = "0.0.0";
//# sourceMappingURL=index.d.ts.map