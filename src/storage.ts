import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, max } from "drizzle-orm";
import {
  ledgerAccounts,
  ledgerEvents,
  auditEvents,
  type LedgerAccount,
  type LedgerEvent,
  type AuditEvent,
} from "../shared/schema";
import type { LedgerStorage } from "./index";

const { Pool } = pg;

export function createDatabaseStorage(connectionString: string): LedgerStorage {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  return {
    async getAccount(tenantId: string, accountId: string): Promise<LedgerAccount | undefined> {
      const [account] = await db
        .select()
        .from(ledgerAccounts)
        .where(and(eq(ledgerAccounts.tenantId, tenantId), eq(ledgerAccounts.id, accountId)));
      return account || undefined;
    },

    async createAccount(account: Omit<LedgerAccount, "createdAt">): Promise<LedgerAccount> {
      const [created] = await db.insert(ledgerAccounts).values(account).returning();
      return created;
    },

    async getEventByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<LedgerEvent | undefined> {
      const [event] = await db
        .select()
        .from(ledgerEvents)
        .where(
          and(eq(ledgerEvents.tenantId, tenantId), eq(ledgerEvents.idempotencyKey, idempotencyKey))
        );
      return event || undefined;
    },

    async getEventById(tenantId: string, eventId: string): Promise<LedgerEvent | undefined> {
      const [event] = await db
        .select()
        .from(ledgerEvents)
        .where(and(eq(ledgerEvents.tenantId, tenantId), eq(ledgerEvents.id, eventId)));
      return event || undefined;
    },

    async getEventsByAccountId(tenantId: string, accountId: string): Promise<LedgerEvent[]> {
      return db
        .select()
        .from(ledgerEvents)
        .where(and(eq(ledgerEvents.tenantId, tenantId), eq(ledgerEvents.accountId, accountId)));
    },

    async getNextSequenceNumber(tenantId: string, accountId: string): Promise<number> {
      const result = await db
        .select({ maxSeq: max(ledgerEvents.sequenceNumber) })
        .from(ledgerEvents)
        .where(and(eq(ledgerEvents.tenantId, tenantId), eq(ledgerEvents.accountId, accountId)));
      
      const maxSeq = result[0]?.maxSeq;
      return (maxSeq ?? 0) + 1;
    },

    async createEvent(event: Omit<LedgerEvent, "createdAt">): Promise<LedgerEvent> {
      const [created] = await db.insert(ledgerEvents).values(event).returning();
      return created;
    },

    async createAuditEvent(event: Omit<AuditEvent, "createdAt">): Promise<AuditEvent> {
      const [created] = await db.insert(auditEvents).values(event).returning();
      return created;
    },
  };
}

export class InMemoryStorage implements LedgerStorage {
  private accounts: Map<string, LedgerAccount> = new Map();
  private events: LedgerEvent[] = [];
  private auditEvents: AuditEvent[] = [];

  private accountKey(tenantId: string, accountId: string): string {
    return `${tenantId}:${accountId}`;
  }

  async getAccount(tenantId: string, accountId: string): Promise<LedgerAccount | undefined> {
    return this.accounts.get(this.accountKey(tenantId, accountId));
  }

  async createAccount(account: Omit<LedgerAccount, "createdAt">): Promise<LedgerAccount> {
    const created: LedgerAccount = { ...account, createdAt: new Date() };
    this.accounts.set(this.accountKey(account.tenantId, account.id), created);
    return created;
  }

  async getEventByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<LedgerEvent | undefined> {
    return this.events.find(
      (e) => e.tenantId === tenantId && e.idempotencyKey === idempotencyKey
    );
  }

  async getEventById(tenantId: string, eventId: string): Promise<LedgerEvent | undefined> {
    return this.events.find((e) => e.tenantId === tenantId && e.id === eventId);
  }

  async getEventsByAccountId(tenantId: string, accountId: string): Promise<LedgerEvent[]> {
    return this.events.filter(
      (e) => e.tenantId === tenantId && e.accountId === accountId
    );
  }

  async getNextSequenceNumber(tenantId: string, accountId: string): Promise<number> {
    const accountEvents = this.events.filter(
      (e) => e.tenantId === tenantId && e.accountId === accountId
    );
    if (accountEvents.length === 0) return 1;
    return Math.max(...accountEvents.map((e) => e.sequenceNumber)) + 1;
  }

  async createEvent(event: Omit<LedgerEvent, "createdAt">): Promise<LedgerEvent> {
    const existingByKey = this.events.find(
      (e) => e.tenantId === event.tenantId && e.idempotencyKey === event.idempotencyKey
    );
    if (existingByKey) {
      throw new Error(`Duplicate idempotency key: ${event.idempotencyKey}`);
    }

    const created: LedgerEvent = { ...event, createdAt: new Date() };
    this.events.push(created);
    return created;
  }

  async createAuditEvent(event: Omit<AuditEvent, "createdAt">): Promise<AuditEvent> {
    const created: AuditEvent = { ...event, createdAt: new Date() };
    this.auditEvents.push(created);
    return created;
  }

  getAuditEvents(): AuditEvent[] {
    return [...this.auditEvents];
  }

  clear(): void {
    this.accounts.clear();
    this.events = [];
    this.auditEvents = [];
  }
}
