import { pgTable, varchar, text, timestamp, numeric, integer, unique, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  accountType: varchar("account_type", { length: 32 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("unique_tenant_account").on(table.tenantId, table.id),
  index("idx_accounts_tenant").on(table.tenantId),
]);

export const ledgerEvents = pgTable("ledger_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  accountId: varchar("account_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
  reversesEventId: varchar("reverses_event_id", { length: 64 }),
  description: text("description"),
  metadata: text("metadata"),
  sequenceNumber: integer("sequence_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("unique_idempotency").on(table.tenantId, table.idempotencyKey),
  index("idx_events_account").on(table.accountId),
  index("idx_events_tenant").on(table.tenantId),
  index("idx_events_sequence").on(table.accountId, table.sequenceNumber),
]);

export const auditEvents = pgTable("audit_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  entityId: varchar("entity_id", { length: 64 }).notNull(),
  action: varchar("action", { length: 32 }).notNull(),
  actorId: varchar("actor_id", { length: 64 }),
  payload: text("payload"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_tenant").on(table.tenantId),
  index("idx_audit_entity").on(table.entityType, table.entityId),
]);

export const ledgerAccountsRelations = relations(ledgerAccounts, ({ many }) => ({
  events: many(ledgerEvents),
}));

export const ledgerEventsRelations = relations(ledgerEvents, ({ one }) => ({
  account: one(ledgerAccounts, {
    fields: [ledgerEvents.accountId],
    references: [ledgerAccounts.id],
  }),
  reversedEvent: one(ledgerEvents, {
    fields: [ledgerEvents.reversesEventId],
    references: [ledgerEvents.id],
  }),
}));

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type InsertLedgerAccount = typeof ledgerAccounts.$inferInsert;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;
export type InsertLedgerEvent = typeof ledgerEvents.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type InsertAuditEvent = typeof auditEvents.$inferInsert;
