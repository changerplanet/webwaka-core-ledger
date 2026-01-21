"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerEventsRelations = exports.ledgerAccountsRelations = exports.auditEvents = exports.ledgerEvents = exports.ledgerAccounts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.ledgerAccounts = (0, pg_core_1.pgTable)("ledger_accounts", {
    id: (0, pg_core_1.varchar)("id", { length: 64 }).primaryKey(),
    tenantId: (0, pg_core_1.varchar)("tenant_id", { length: 64 }).notNull(),
    accountType: (0, pg_core_1.varchar)("account_type", { length: 32 }).notNull(),
    currency: (0, pg_core_1.varchar)("currency", { length: 8 }).notNull(),
    metadata: (0, pg_core_1.text)("metadata"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.unique)("unique_tenant_account").on(table.tenantId, table.id),
    (0, pg_core_1.index)("idx_accounts_tenant").on(table.tenantId),
]);
exports.ledgerEvents = (0, pg_core_1.pgTable)("ledger_events", {
    id: (0, pg_core_1.varchar)("id", { length: 64 }).primaryKey(),
    tenantId: (0, pg_core_1.varchar)("tenant_id", { length: 64 }).notNull(),
    accountId: (0, pg_core_1.varchar)("account_id", { length: 64 }).notNull(),
    eventType: (0, pg_core_1.varchar)("event_type", { length: 32 }).notNull(),
    amount: (0, pg_core_1.numeric)("amount", { precision: 20, scale: 8 }).notNull(),
    currency: (0, pg_core_1.varchar)("currency", { length: 8 }).notNull(),
    idempotencyKey: (0, pg_core_1.varchar)("idempotency_key", { length: 128 }).notNull(),
    reversesEventId: (0, pg_core_1.varchar)("reverses_event_id", { length: 64 }),
    description: (0, pg_core_1.text)("description"),
    metadata: (0, pg_core_1.text)("metadata"),
    sequenceNumber: (0, pg_core_1.integer)("sequence_number").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.unique)("unique_idempotency").on(table.tenantId, table.idempotencyKey),
    (0, pg_core_1.index)("idx_events_account").on(table.accountId),
    (0, pg_core_1.index)("idx_events_tenant").on(table.tenantId),
    (0, pg_core_1.index)("idx_events_sequence").on(table.accountId, table.sequenceNumber),
]);
exports.auditEvents = (0, pg_core_1.pgTable)("audit_events", {
    id: (0, pg_core_1.varchar)("id", { length: 64 }).primaryKey(),
    tenantId: (0, pg_core_1.varchar)("tenant_id", { length: 64 }).notNull(),
    entityType: (0, pg_core_1.varchar)("entity_type", { length: 32 }).notNull(),
    entityId: (0, pg_core_1.varchar)("entity_id", { length: 64 }).notNull(),
    action: (0, pg_core_1.varchar)("action", { length: 32 }).notNull(),
    actorId: (0, pg_core_1.varchar)("actor_id", { length: 64 }),
    payload: (0, pg_core_1.text)("payload"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => [
    (0, pg_core_1.index)("idx_audit_tenant").on(table.tenantId),
    (0, pg_core_1.index)("idx_audit_entity").on(table.entityType, table.entityId),
]);
exports.ledgerAccountsRelations = (0, drizzle_orm_1.relations)(exports.ledgerAccounts, ({ many }) => ({
    events: many(exports.ledgerEvents),
}));
exports.ledgerEventsRelations = (0, drizzle_orm_1.relations)(exports.ledgerEvents, ({ one }) => ({
    account: one(exports.ledgerAccounts, {
        fields: [exports.ledgerEvents.accountId],
        references: [exports.ledgerAccounts.id],
    }),
    reversedEvent: one(exports.ledgerEvents, {
        fields: [exports.ledgerEvents.reversesEventId],
        references: [exports.ledgerEvents.id],
    }),
}));
//# sourceMappingURL=schema.js.map