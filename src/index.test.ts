import { describe, it, expect, beforeEach } from "vitest";
import { Ledger, LedgerError } from "./index";
import { InMemoryStorage } from "./storage";

describe("Ledger", () => {
  let ledger: Ledger;
  let storage: InMemoryStorage;
  const tenantId = "tenant-001";

  beforeEach(() => {
    storage = new InMemoryStorage();
    ledger = new Ledger({ tenantId }, storage);
  });

  describe("constructor", () => {
    it("should create a ledger with valid config", () => {
      expect(ledger.getTenantId()).toBe(tenantId);
    });

    it("should throw error when tenantId is missing", () => {
      expect(() => new Ledger({ tenantId: "" }, storage)).toThrow(LedgerError);
    });
  });

  describe("openAccount", () => {
    it("should create a new account", async () => {
      const account = await ledger.openAccount({
        accountType: "CASH",
        currency: "USD",
      });

      expect(account.id).toBeDefined();
      expect(account.tenantId).toBe(tenantId);
      expect(account.accountType).toBe("CASH");
      expect(account.currency).toBe("USD");
    });

    it("should create account with custom id", async () => {
      const account = await ledger.openAccount({
        accountId: "custom-account-id",
        accountType: "SAVINGS",
        currency: "EUR",
      });

      expect(account.id).toBe("custom-account-id");
    });

    it("should throw error when account already exists", async () => {
      await ledger.openAccount({
        accountId: "duplicate-id",
        accountType: "CASH",
        currency: "USD",
      });

      await expect(
        ledger.openAccount({
          accountId: "duplicate-id",
          accountType: "CASH",
          currency: "USD",
        })
      ).rejects.toThrow(LedgerError);
    });

    it("should emit audit event on account creation", async () => {
      await ledger.openAccount({
        accountType: "CASH",
        currency: "USD",
      });

      const auditEvents = storage.getAuditEvents();
      expect(auditEvents.length).toBe(1);
      expect(auditEvents[0].action).toBe("ACCOUNT_OPENED");
    });
  });

  describe("recordEvent", () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await ledger.openAccount({
        accountType: "CASH",
        currency: "USD",
      });
      accountId = account.id;
    });

    it("should record a credit event", async () => {
      const event = await ledger.recordEvent({
        accountId,
        eventType: "CREDIT",
        amount: "100.00",
        currency: "USD",
        idempotencyKey: "credit-001",
        description: "Initial deposit",
      });

      expect(event.id).toBeDefined();
      expect(event.amount).toBe("100.00");
      expect(event.eventType).toBe("CREDIT");
      expect(event.sequenceNumber).toBe(1);
    });

    it("should record a debit event", async () => {
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

      expect(event.amount).toBe("-50.00");
      expect(event.sequenceNumber).toBe(2);
    });

    it("should enforce idempotency - return existing event on duplicate key", async () => {
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

      expect(event1.id).toBe(event2.id);
      expect(event2.amount).toBe("100.00");
    });

    it("should throw error for non-existent account", async () => {
      await expect(
        ledger.recordEvent({
          accountId: "non-existent",
          eventType: "CREDIT",
          amount: "100.00",
          currency: "USD",
          idempotencyKey: "key-001",
        })
      ).rejects.toThrow("Account non-existent not found");
    });

    it("should throw error for currency mismatch", async () => {
      await expect(
        ledger.recordEvent({
          accountId,
          eventType: "CREDIT",
          amount: "100.00",
          currency: "EUR",
          idempotencyKey: "key-001",
        })
      ).rejects.toThrow("Currency mismatch");
    });

    it("should emit audit event on recording", async () => {
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
      expect(recordEvent).toBeDefined();
    });
  });

  describe("reverseEvent", () => {
    let accountId: string;
    let originalEventId: string;

    beforeEach(async () => {
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

    it("should create a reversal event with negated amount", async () => {
      const reversal = await ledger.reverseEvent({
        originalEventId,
        idempotencyKey: "reversal-001",
      });

      expect(reversal.eventType).toBe("REVERSAL");
      expect(reversal.amount).toBe("-100");
      expect(reversal.reversesEventId).toBe(originalEventId);
    });

    it("should enforce idempotency on reversals", async () => {
      const reversal1 = await ledger.reverseEvent({
        originalEventId,
        idempotencyKey: "reversal-key",
      });

      const reversal2 = await ledger.reverseEvent({
        originalEventId,
        idempotencyKey: "reversal-key",
      });

      expect(reversal1.id).toBe(reversal2.id);
    });

    it("should throw error when reversing non-existent event", async () => {
      await expect(
        ledger.reverseEvent({
          originalEventId: "non-existent-event",
          idempotencyKey: "reversal-001",
        })
      ).rejects.toThrow("Original event non-existent-event not found");
    });

    it("should throw error when event already reversed", async () => {
      await ledger.reverseEvent({
        originalEventId,
        idempotencyKey: "reversal-001",
      });

      await expect(
        ledger.reverseEvent({
          originalEventId,
          idempotencyKey: "reversal-002",
        })
      ).rejects.toThrow("has already been reversed");
    });

    it("should emit audit event on reversal", async () => {
      await ledger.reverseEvent({
        originalEventId,
        idempotencyKey: "reversal-001",
      });

      const auditEvents = storage.getAuditEvents();
      const reversalEvent = auditEvents.find((e) => e.action === "EVENT_REVERSED");
      expect(reversalEvent).toBeDefined();
    });
  });

  describe("getAccountBalance", () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await ledger.openAccount({
        accountType: "CASH",
        currency: "USD",
      });
      accountId = account.id;
    });

    it("should return zero balance for new account", async () => {
      const balance = await ledger.getAccountBalance(accountId);
      expect(balance.balance).toBe("0.00000000");
      expect(balance.eventCount).toBe(0);
    });

    it("should calculate balance from events (derived, never stored)", async () => {
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
      expect(balance.balance).toBe("70.25000000");
      expect(balance.eventCount).toBe(2);
    });

    it("should throw error for non-existent account", async () => {
      await expect(ledger.getAccountBalance("non-existent")).rejects.toThrow(
        "Account non-existent not found"
      );
    });
  });

  describe("getAccountStatement", () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await ledger.openAccount({
        accountType: "CASH",
        currency: "USD",
      });
      accountId = account.id;
    });

    it("should return empty statement for new account", async () => {
      const statement = await ledger.getAccountStatement(accountId);
      expect(statement.entries.length).toBe(0);
      expect(statement.openingBalance).toBe("0.00000000");
      expect(statement.closingBalance).toBe("0.00000000");
    });

    it("should return statement with running balance", async () => {
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
      expect(statement.entries.length).toBe(2);
      expect(statement.entries[0].runningBalance).toBe("100.00000000");
      expect(statement.entries[1].runningBalance).toBe("70.00000000");
      expect(statement.openingBalance).toBe("0.00000000");
      expect(statement.closingBalance).toBe("70.00000000");
    });

    it("should throw error for non-existent account", async () => {
      await expect(ledger.getAccountStatement("non-existent")).rejects.toThrow(
        "Account non-existent not found"
      );
    });

    it("should filter by date range", async () => {
      await ledger.recordEvent({
        accountId,
        eventType: "CREDIT",
        amount: "100.00",
        currency: "USD",
        idempotencyKey: "credit-001",
      });

      const futureDate = new Date(Date.now() + 86400000);
      const statement = await ledger.getAccountStatement(accountId, { toDate: futureDate });
      expect(statement.entries.length).toBe(1);

      const pastDate = new Date(Date.now() - 86400000);
      const filteredStatement = await ledger.getAccountStatement(accountId, { fromDate: futureDate });
      expect(filteredStatement.entries.length).toBe(0);
    });
  });

  describe("verifyLedgerIntegrity", () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await ledger.openAccount({
        accountType: "CASH",
        currency: "USD",
      });
      accountId = account.id;
    });

    it("should return valid for empty account", async () => {
      const report = await ledger.verifyLedgerIntegrity(accountId);
      expect(report.valid).toBe(true);
      expect(report.errors.length).toBe(0);
    });

    it("should return valid for account with events", async () => {
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
      expect(report.valid).toBe(true);
      expect(report.calculatedBalance).toBe("50.00000000");
      expect(report.eventCount).toBe(2);
    });

    it("should throw error for non-existent account", async () => {
      await expect(ledger.verifyLedgerIntegrity("non-existent")).rejects.toThrow(
        "Account non-existent not found"
      );
    });
  });

  describe("tenant isolation", () => {
    it("should isolate accounts between tenants", async () => {
      const ledger2 = new Ledger({ tenantId: "tenant-002" }, storage);

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

      expect(account1.tenantId).toBe("tenant-001");
      expect(account2.tenantId).toBe("tenant-002");
    });

    it("should isolate events between tenants", async () => {
      const ledger2 = new Ledger({ tenantId: "tenant-002" }, storage);

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

      expect(balance1.balance).toBe("100.00000000");
      expect(balance2.balance).toBe("0.00000000");
    });

    it("should not allow cross-tenant access", async () => {
      await ledger.openAccount({
        accountId: "tenant1-account",
        accountType: "CASH",
        currency: "USD",
      });

      const ledger2 = new Ledger({ tenantId: "tenant-002" }, storage);
      
      await expect(ledger2.getAccountBalance("tenant1-account")).rejects.toThrow(
        "Account tenant1-account not found"
      );
    });
  });

  describe("append-only enforcement", () => {
    it("should only create events, never modify", async () => {
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
      expect(balance.balance).toBe("100.00000000");
      expect(balance.eventCount).toBe(3);
    });
  });
});

describe("LedgerError", () => {
  it("should include code and details", () => {
    const error = new LedgerError("Test error", "TEST_CODE", { foo: "bar" });
    expect(error.code).toBe("TEST_CODE");
    expect(error.details).toEqual({ foo: "bar" });
    expect(error.name).toBe("LedgerError");
  });
});
