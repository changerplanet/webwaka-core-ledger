"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStorage = void 0;
exports.createDatabaseStorage = createDatabaseStorage;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = __importDefault(require("pg"));
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../shared/schema");
const { Pool } = pg_1.default;
function createDatabaseStorage(connectionString) {
    const pool = new Pool({ connectionString });
    const db = (0, node_postgres_1.drizzle)(pool);
    return {
        async getAccount(tenantId, accountId) {
            const [account] = await db
                .select()
                .from(schema_1.ledgerAccounts)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ledgerAccounts.tenantId, tenantId), (0, drizzle_orm_1.eq)(schema_1.ledgerAccounts.id, accountId)));
            return account || undefined;
        },
        async createAccount(account) {
            const [created] = await db.insert(schema_1.ledgerAccounts).values(account).returning();
            return created;
        },
        async getEventByIdempotencyKey(tenantId, idempotencyKey) {
            const [event] = await db
                .select()
                .from(schema_1.ledgerEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ledgerEvents.tenantId, tenantId), (0, drizzle_orm_1.eq)(schema_1.ledgerEvents.idempotencyKey, idempotencyKey)));
            return event || undefined;
        },
        async getEventById(tenantId, eventId) {
            const [event] = await db
                .select()
                .from(schema_1.ledgerEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ledgerEvents.tenantId, tenantId), (0, drizzle_orm_1.eq)(schema_1.ledgerEvents.id, eventId)));
            return event || undefined;
        },
        async getEventsByAccountId(tenantId, accountId) {
            return db
                .select()
                .from(schema_1.ledgerEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ledgerEvents.tenantId, tenantId), (0, drizzle_orm_1.eq)(schema_1.ledgerEvents.accountId, accountId)));
        },
        async getNextSequenceNumber(tenantId, accountId) {
            const result = await db
                .select({ maxSeq: (0, drizzle_orm_1.max)(schema_1.ledgerEvents.sequenceNumber) })
                .from(schema_1.ledgerEvents)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.ledgerEvents.tenantId, tenantId), (0, drizzle_orm_1.eq)(schema_1.ledgerEvents.accountId, accountId)));
            const maxSeq = result[0]?.maxSeq;
            return (maxSeq ?? 0) + 1;
        },
        async createEvent(event) {
            const [created] = await db.insert(schema_1.ledgerEvents).values(event).returning();
            return created;
        },
        async createAuditEvent(event) {
            const [created] = await db.insert(schema_1.auditEvents).values(event).returning();
            return created;
        },
    };
}
class InMemoryStorage {
    constructor() {
        this.accounts = new Map();
        this.events = [];
        this.auditEvents = [];
    }
    accountKey(tenantId, accountId) {
        return `${tenantId}:${accountId}`;
    }
    async getAccount(tenantId, accountId) {
        return this.accounts.get(this.accountKey(tenantId, accountId));
    }
    async createAccount(account) {
        const created = { ...account, createdAt: new Date() };
        this.accounts.set(this.accountKey(account.tenantId, account.id), created);
        return created;
    }
    async getEventByIdempotencyKey(tenantId, idempotencyKey) {
        return this.events.find((e) => e.tenantId === tenantId && e.idempotencyKey === idempotencyKey);
    }
    async getEventById(tenantId, eventId) {
        return this.events.find((e) => e.tenantId === tenantId && e.id === eventId);
    }
    async getEventsByAccountId(tenantId, accountId) {
        return this.events.filter((e) => e.tenantId === tenantId && e.accountId === accountId);
    }
    async getNextSequenceNumber(tenantId, accountId) {
        const accountEvents = this.events.filter((e) => e.tenantId === tenantId && e.accountId === accountId);
        if (accountEvents.length === 0)
            return 1;
        return Math.max(...accountEvents.map((e) => e.sequenceNumber)) + 1;
    }
    async createEvent(event) {
        const existingByKey = this.events.find((e) => e.tenantId === event.tenantId && e.idempotencyKey === event.idempotencyKey);
        if (existingByKey) {
            throw new Error(`Duplicate idempotency key: ${event.idempotencyKey}`);
        }
        const created = { ...event, createdAt: new Date() };
        this.events.push(created);
        return created;
    }
    async createAuditEvent(event) {
        const created = { ...event, createdAt: new Date() };
        this.auditEvents.push(created);
        return created;
    }
    getAuditEvents() {
        return [...this.auditEvents];
    }
    clear() {
        this.accounts.clear();
        this.events = [];
        this.auditEvents = [];
    }
}
exports.InMemoryStorage = InMemoryStorage;
//# sourceMappingURL=storage.js.map