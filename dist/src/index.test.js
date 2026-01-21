"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
const storage_1 = require("./storage");
(0, vitest_1.describe)("Ledger", () => {
    let ledger;
    let storage;
    const tenantId = "tenant-001";
    (0, vitest_1.beforeEach)(() => {
        storage = new storage_1.InMemoryStorage();
        ledger = new index_1.Ledger({ tenantId }, storage);
    });
    (0, vitest_1.describe)("constructor", () => {
        (0, vitest_1.it)("should create a ledger with valid config", () => {
            (0, vitest_1.expect)(ledger.getTenantId()).toBe(tenantId);
        });
        (0, vitest_1.it)("should throw error when tenantId is missing", () => {
            (0, vitest_1.expect)(() => new index_1.Ledger({ tenantId: "" }, storage)).toThrow(index_1.LedgerError);
        });
    });
    (0, vitest_1.describe)("openAccount", () => {
        (0, vitest_1.it)("should create a new account", async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            (0, vitest_1.expect)(account.id).toBeDefined();
            (0, vitest_1.expect)(account.tenantId).toBe(tenantId);
            (0, vitest_1.expect)(account.accountType).toBe("CASH");
            (0, vitest_1.expect)(account.currency).toBe("USD");
        });
        (0, vitest_1.it)("should create account with custom id", async () => {
            const account = await ledger.openAccount({
                accountId: "custom-account-id",
                accountType: "SAVINGS",
                currency: "EUR",
            });
            (0, vitest_1.expect)(account.id).toBe("custom-account-id");
        });
        (0, vitest_1.it)("should throw error when account already exists", async () => {
            await ledger.openAccount({
                accountId: "duplicate-id",
                accountType: "CASH",
                currency: "USD",
            });
            await (0, vitest_1.expect)(ledger.openAccount({
                accountId: "duplicate-id",
                accountType: "CASH",
                currency: "USD",
            })).rejects.toThrow(index_1.LedgerError);
        });
        (0, vitest_1.it)("should emit audit event on account creation", async () => {
            await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            const auditEvents = storage.getAuditEvents();
            (0, vitest_1.expect)(auditEvents.length).toBe(1);
            (0, vitest_1.expect)(auditEvents[0].action).toBe("ACCOUNT_OPENED");
        });
    });
    (0, vitest_1.describe)("recordEvent", () => {
        let accountId;
        (0, vitest_1.beforeEach)(async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            accountId = account.id;
        });
        (0, vitest_1.it)("should record a credit event", async () => {
            const event = await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
                description: "Initial deposit",
            });
            (0, vitest_1.expect)(event.id).toBeDefined();
            (0, vitest_1.expect)(event.amount).toBe("100.00");
            (0, vitest_1.expect)(event.eventType).toBe("CREDIT");
            (0, vitest_1.expect)(event.sequenceNumber).toBe(1);
        });
        (0, vitest_1.it)("should record a debit event", async () => {
            await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            const event = await ledger.recordEvent({
                accountId,
                eventType: "DEBIT",
                amount: "-50.00",
                currency: "USD",
                idempotencyKey: "debit-001",
            });
            (0, vitest_1.expect)(event.amount).toBe("-50.00");
            (0, vitest_1.expect)(event.sequenceNumber).toBe(2);
        });
        (0, vitest_1.it)("should enforce idempotency - return existing event on duplicate key", async () => {
            const event1 = await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "same-key",
            });
            const event2 = await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "200.00",
                currency: "USD",
                idempotencyKey: "same-key",
            });
            (0, vitest_1.expect)(event1.id).toBe(event2.id);
            (0, vitest_1.expect)(event2.amount).toBe("100.00");
        });
        (0, vitest_1.it)("should throw error for non-existent account", async () => {
            await (0, vitest_1.expect)(ledger.recordEvent({
                accountId: "non-existent",
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "key-001",
            })).rejects.toThrow("Account non-existent not found");
        });
        (0, vitest_1.it)("should throw error for currency mismatch", async () => {
            await (0, vitest_1.expect)(ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "EUR",
                idempotencyKey: "key-001",
            })).rejects.toThrow("Currency mismatch");
        });
        (0, vitest_1.it)("should emit audit event on recording", async () => {
            storage.getAuditEvents().length;
            await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            const auditEvents = storage.getAuditEvents();
            const recordEvent = auditEvents.find((e) => e.action === "EVENT_RECORDED");
            (0, vitest_1.expect)(recordEvent).toBeDefined();
        });
    });
    (0, vitest_1.describe)("reverseEvent", () => {
        let accountId;
        let originalEventId;
        (0, vitest_1.beforeEach)(async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            accountId = account.id;
            const event = await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "original-event",
            });
            originalEventId = event.id;
        });
        (0, vitest_1.it)("should create a reversal event with negated amount", async () => {
            const reversal = await ledger.reverseEvent({
                originalEventId,
                idempotencyKey: "reversal-001",
            });
            (0, vitest_1.expect)(reversal.eventType).toBe("REVERSAL");
            (0, vitest_1.expect)(reversal.amount).toBe("-100");
            (0, vitest_1.expect)(reversal.reversesEventId).toBe(originalEventId);
        });
        (0, vitest_1.it)("should enforce idempotency on reversals", async () => {
            const reversal1 = await ledger.reverseEvent({
                originalEventId,
                idempotencyKey: "reversal-key",
            });
            const reversal2 = await ledger.reverseEvent({
                originalEventId,
                idempotencyKey: "reversal-key",
            });
            (0, vitest_1.expect)(reversal1.id).toBe(reversal2.id);
        });
        (0, vitest_1.it)("should throw error when reversing non-existent event", async () => {
            await (0, vitest_1.expect)(ledger.reverseEvent({
                originalEventId: "non-existent-event",
                idempotencyKey: "reversal-001",
            })).rejects.toThrow("Original event non-existent-event not found");
        });
        (0, vitest_1.it)("should throw error when event already reversed", async () => {
            await ledger.reverseEvent({
                originalEventId,
                idempotencyKey: "reversal-001",
            });
            await (0, vitest_1.expect)(ledger.reverseEvent({
                originalEventId,
                idempotencyKey: "reversal-002",
            })).rejects.toThrow("has already been reversed");
        });
        (0, vitest_1.it)("should emit audit event on reversal", async () => {
            await ledger.reverseEvent({
                originalEventId,
                idempotencyKey: "reversal-001",
            });
            const auditEvents = storage.getAuditEvents();
            const reversalEvent = auditEvents.find((e) => e.action === "EVENT_REVERSED");
            (0, vitest_1.expect)(reversalEvent).toBeDefined();
        });
    });
    (0, vitest_1.describe)("getAccountBalance", () => {
        let accountId;
        (0, vitest_1.beforeEach)(async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            accountId = account.id;
        });
        (0, vitest_1.it)("should return zero balance for new account", async () => {
            const balance = await ledger.getAccountBalance(accountId);
            (0, vitest_1.expect)(balance.balance).toBe("0.00000000");
            (0, vitest_1.expect)(balance.eventCount).toBe(0);
        });
        (0, vitest_1.it)("should calculate balance from events (derived, never stored)", async () => {
            await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.50",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            await ledger.recordEvent({
                accountId,
                eventType: "DEBIT",
                amount: "-30.25",
                currency: "USD",
                idempotencyKey: "debit-001",
            });
            const balance = await ledger.getAccountBalance(accountId);
            (0, vitest_1.expect)(balance.balance).toBe("70.25000000");
            (0, vitest_1.expect)(balance.eventCount).toBe(2);
        });
        (0, vitest_1.it)("should throw error for non-existent account", async () => {
            await (0, vitest_1.expect)(ledger.getAccountBalance("non-existent")).rejects.toThrow("Account non-existent not found");
        });
    });
    (0, vitest_1.describe)("getAccountStatement", () => {
        let accountId;
        (0, vitest_1.beforeEach)(async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            accountId = account.id;
        });
        (0, vitest_1.it)("should return empty statement for new account", async () => {
            const statement = await ledger.getAccountStatement(accountId);
            (0, vitest_1.expect)(statement.entries.length).toBe(0);
            (0, vitest_1.expect)(statement.openingBalance).toBe("0.00000000");
            (0, vitest_1.expect)(statement.closingBalance).toBe("0.00000000");
        });
        (0, vitest_1.it)("should return statement with running balance", async () => {
            await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            await ledger.recordEvent({
                accountId,
                eventType: "DEBIT",
                amount: "-30.00",
                currency: "USD",
                idempotencyKey: "debit-001",
            });
            const statement = await ledger.getAccountStatement(accountId);
            (0, vitest_1.expect)(statement.entries.length).toBe(2);
            (0, vitest_1.expect)(statement.entries[0].runningBalance).toBe("100.00000000");
            (0, vitest_1.expect)(statement.entries[1].runningBalance).toBe("70.00000000");
            (0, vitest_1.expect)(statement.openingBalance).toBe("0.00000000");
            (0, vitest_1.expect)(statement.closingBalance).toBe("70.00000000");
        });
        (0, vitest_1.it)("should throw error for non-existent account", async () => {
            await (0, vitest_1.expect)(ledger.getAccountStatement("non-existent")).rejects.toThrow("Account non-existent not found");
        });
        (0, vitest_1.it)("should filter by date range", async () => {
            await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            const futureDate = new Date(Date.now() + 86400000);
            const statement = await ledger.getAccountStatement(accountId, { toDate: futureDate });
            (0, vitest_1.expect)(statement.entries.length).toBe(1);
            const pastDate = new Date(Date.now() - 86400000);
            const filteredStatement = await ledger.getAccountStatement(accountId, { fromDate: futureDate });
            (0, vitest_1.expect)(filteredStatement.entries.length).toBe(0);
        });
    });
    (0, vitest_1.describe)("verifyLedgerIntegrity", () => {
        let accountId;
        (0, vitest_1.beforeEach)(async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            accountId = account.id;
        });
        (0, vitest_1.it)("should return valid for empty account", async () => {
            const report = await ledger.verifyLedgerIntegrity(accountId);
            (0, vitest_1.expect)(report.valid).toBe(true);
            (0, vitest_1.expect)(report.errors.length).toBe(0);
        });
        (0, vitest_1.it)("should return valid for account with events", async () => {
            await ledger.recordEvent({
                accountId,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            await ledger.recordEvent({
                accountId,
                eventType: "DEBIT",
                amount: "-50.00",
                currency: "USD",
                idempotencyKey: "debit-001",
            });
            const report = await ledger.verifyLedgerIntegrity(accountId);
            (0, vitest_1.expect)(report.valid).toBe(true);
            (0, vitest_1.expect)(report.calculatedBalance).toBe("50.00000000");
            (0, vitest_1.expect)(report.eventCount).toBe(2);
        });
        (0, vitest_1.it)("should throw error for non-existent account", async () => {
            await (0, vitest_1.expect)(ledger.verifyLedgerIntegrity("non-existent")).rejects.toThrow("Account non-existent not found");
        });
    });
    (0, vitest_1.describe)("tenant isolation", () => {
        (0, vitest_1.it)("should isolate accounts between tenants", async () => {
            const ledger2 = new index_1.Ledger({ tenantId: "tenant-002" }, storage);
            const account1 = await ledger.openAccount({
                accountId: "shared-id",
                accountType: "CASH",
                currency: "USD",
            });
            const account2 = await ledger2.openAccount({
                accountId: "shared-id",
                accountType: "CASH",
                currency: "EUR",
            });
            (0, vitest_1.expect)(account1.tenantId).toBe("tenant-001");
            (0, vitest_1.expect)(account2.tenantId).toBe("tenant-002");
        });
        (0, vitest_1.it)("should isolate events between tenants", async () => {
            const ledger2 = new index_1.Ledger({ tenantId: "tenant-002" }, storage);
            const account1 = await ledger.openAccount({
                accountId: "account-1",
                accountType: "CASH",
                currency: "USD",
            });
            const account2 = await ledger2.openAccount({
                accountId: "account-2",
                accountType: "CASH",
                currency: "USD",
            });
            await ledger.recordEvent({
                accountId: account1.id,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "key-001",
            });
            const balance1 = await ledger.getAccountBalance(account1.id);
            const balance2 = await ledger2.getAccountBalance(account2.id);
            (0, vitest_1.expect)(balance1.balance).toBe("100.00000000");
            (0, vitest_1.expect)(balance2.balance).toBe("0.00000000");
        });
        (0, vitest_1.it)("should not allow cross-tenant access", async () => {
            await ledger.openAccount({
                accountId: "tenant1-account",
                accountType: "CASH",
                currency: "USD",
            });
            const ledger2 = new index_1.Ledger({ tenantId: "tenant-002" }, storage);
            await (0, vitest_1.expect)(ledger2.getAccountBalance("tenant1-account")).rejects.toThrow("Account tenant1-account not found");
        });
    });
    (0, vitest_1.describe)("append-only enforcement", () => {
        (0, vitest_1.it)("should only create events, never modify", async () => {
            const account = await ledger.openAccount({
                accountType: "CASH",
                currency: "USD",
            });
            await ledger.recordEvent({
                accountId: account.id,
                eventType: "CREDIT",
                amount: "100.00",
                currency: "USD",
                idempotencyKey: "credit-001",
            });
            const originalEvent = await ledger.recordEvent({
                accountId: account.id,
                eventType: "MISTAKE",
                amount: "999.00",
                currency: "USD",
                idempotencyKey: "mistake-001",
            });
            await ledger.reverseEvent({
                originalEventId: originalEvent.id,
                idempotencyKey: "fix-mistake",
            });
            const balance = await ledger.getAccountBalance(account.id);
            (0, vitest_1.expect)(balance.balance).toBe("100.00000000");
            (0, vitest_1.expect)(balance.eventCount).toBe(3);
        });
    });
});
(0, vitest_1.describe)("LedgerError", () => {
    (0, vitest_1.it)("should include code and details", () => {
        const error = new index_1.LedgerError("Test error", "TEST_CODE", { foo: "bar" });
        (0, vitest_1.expect)(error.code).toBe("TEST_CODE");
        (0, vitest_1.expect)(error.details).toEqual({ foo: "bar" });
        (0, vitest_1.expect)(error.name).toBe("LedgerError");
    });
});
//# sourceMappingURL=index.test.js.map