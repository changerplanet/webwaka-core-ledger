import { type LedgerAccount, type LedgerEvent, type AuditEvent } from "../shared/schema";
import type { LedgerStorage } from "./index";
export declare function createDatabaseStorage(connectionString: string): LedgerStorage;
export declare class InMemoryStorage implements LedgerStorage {
    private accounts;
    private events;
    private auditEvents;
    private accountKey;
    getAccount(tenantId: string, accountId: string): Promise<LedgerAccount | undefined>;
    createAccount(account: Omit<LedgerAccount, "createdAt">): Promise<LedgerAccount>;
    getEventByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<LedgerEvent | undefined>;
    getEventById(tenantId: string, eventId: string): Promise<LedgerEvent | undefined>;
    getEventsByAccountId(tenantId: string, accountId: string): Promise<LedgerEvent[]>;
    getNextSequenceNumber(tenantId: string, accountId: string): Promise<number>;
    createEvent(event: Omit<LedgerEvent, "createdAt">): Promise<LedgerEvent>;
    createAuditEvent(event: Omit<AuditEvent, "createdAt">): Promise<AuditEvent>;
    getAuditEvents(): AuditEvent[];
    clear(): void;
}
//# sourceMappingURL=storage.d.ts.map