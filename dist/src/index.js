"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = exports.Ledger = exports.LedgerError = void 0;
const uuid_1 = require("uuid");
class LedgerError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "LedgerError";
    }
}
exports.LedgerError = LedgerError;
class Ledger {
    constructor(config, storage) {
        if (!config.tenantId) {
            throw new LedgerError("Tenant ID is required", "INVALID_CONFIG");
        }
        this.config = config;
        this.storage = storage;
    }
    getTenantId() {
        return this.config.tenantId;
    }
    async emitAuditEvent(params) {
        await this.storage.createAuditEvent({
            id: (0, uuid_1.v4)(),
            tenantId: this.config.tenantId,
            entityType: params.entityType,
            entityId: params.entityId,
            action: params.action,
            actorId: params.actorId || null,
            payload: params.payload ? JSON.stringify(params.payload) : null,
        });
    }
    async openAccount(params) {
        const accountId = params.accountId || (0, uuid_1.v4)();
        const existing = await this.storage.getAccount(this.config.tenantId, accountId);
        if (existing) {
            throw new LedgerError(`Account ${accountId} already exists`, "ACCOUNT_EXISTS", { accountId });
        }
        const account = await this.storage.createAccount({
            id: accountId,
            tenantId: this.config.tenantId,
            accountType: params.accountType,
            currency: params.currency,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        });
        await this.emitAuditEvent({
            entityType: "account",
            entityId: accountId,
            action: "ACCOUNT_OPENED",
            payload: {
                accountType: params.accountType,
                currency: params.currency,
            },
        });
        return account;
    }
    async recordEvent(params) {
        const existingByKey = await this.storage.getEventByIdempotencyKey(this.config.tenantId, params.idempotencyKey);
        if (existingByKey) {
            return existingByKey;
        }
        const account = await this.storage.getAccount(this.config.tenantId, params.accountId);
        if (!account) {
            throw new LedgerError(`Account ${params.accountId} not found`, "ACCOUNT_NOT_FOUND", { accountId: params.accountId });
        }
        if (account.currency !== params.currency) {
            throw new LedgerError(`Currency mismatch: account uses ${account.currency}, event uses ${params.currency}`, "CURRENCY_MISMATCH", { accountCurrency: account.currency, eventCurrency: params.currency });
        }
        const eventId = params.eventId || (0, uuid_1.v4)();
        const sequenceNumber = await this.storage.getNextSequenceNumber(this.config.tenantId, params.accountId);
        const event = await this.storage.createEvent({
            id: eventId,
            tenantId: this.config.tenantId,
            accountId: params.accountId,
            eventType: params.eventType,
            amount: params.amount,
            currency: params.currency,
            idempotencyKey: params.idempotencyKey,
            reversesEventId: null,
            description: params.description || null,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null,
            sequenceNumber,
        });
        await this.emitAuditEvent({
            entityType: "event",
            entityId: eventId,
            action: "EVENT_RECORDED",
            payload: {
                accountId: params.accountId,
                eventType: params.eventType,
                amount: params.amount,
                currency: params.currency,
            },
        });
        return event;
    }
    async reverseEvent(params) {
        const existingByKey = await this.storage.getEventByIdempotencyKey(this.config.tenantId, params.idempotencyKey);
        if (existingByKey) {
            return existingByKey;
        }
        const originalEvent = await this.storage.getEventById(this.config.tenantId, params.originalEventId);
        if (!originalEvent) {
            throw new LedgerError(`Original event ${params.originalEventId} not found`, "EVENT_NOT_FOUND", { eventId: params.originalEventId });
        }
        const existingEvents = await this.storage.getEventsByAccountId(this.config.tenantId, originalEvent.accountId);
        const alreadyReversed = existingEvents.some((e) => e.reversesEventId === params.originalEventId);
        if (alreadyReversed) {
            throw new LedgerError(`Event ${params.originalEventId} has already been reversed`, "ALREADY_REVERSED", { eventId: params.originalEventId });
        }
        const reversalEventId = params.reversalEventId || (0, uuid_1.v4)();
        const sequenceNumber = await this.storage.getNextSequenceNumber(this.config.tenantId, originalEvent.accountId);
        const reversedAmount = (parseFloat(originalEvent.amount) * -1).toString();
        const reversalEvent = await this.storage.createEvent({
            id: reversalEventId,
            tenantId: this.config.tenantId,
            accountId: originalEvent.accountId,
            eventType: "REVERSAL",
            amount: reversedAmount,
            currency: originalEvent.currency,
            idempotencyKey: params.idempotencyKey,
            reversesEventId: params.originalEventId,
            description: params.description || `Reversal of event ${params.originalEventId}`,
            metadata: null,
            sequenceNumber,
        });
        await this.emitAuditEvent({
            entityType: "event",
            entityId: reversalEventId,
            action: "EVENT_REVERSED",
            payload: {
                originalEventId: params.originalEventId,
                reversalAmount: reversedAmount,
            },
        });
        return reversalEvent;
    }
    async getAccountBalance(accountId) {
        const account = await this.storage.getAccount(this.config.tenantId, accountId);
        if (!account) {
            throw new LedgerError(`Account ${accountId} not found`, "ACCOUNT_NOT_FOUND", { accountId });
        }
        const events = await this.storage.getEventsByAccountId(this.config.tenantId, accountId);
        let balance = 0;
        for (const event of events) {
            balance += parseFloat(event.amount);
        }
        return {
            accountId,
            balance: balance.toFixed(8),
            currency: account.currency,
            eventCount: events.length,
        };
    }
    async getAccountStatement(accountId, options) {
        const account = await this.storage.getAccount(this.config.tenantId, accountId);
        if (!account) {
            throw new LedgerError(`Account ${accountId} not found`, "ACCOUNT_NOT_FOUND", { accountId });
        }
        let events = await this.storage.getEventsByAccountId(this.config.tenantId, accountId);
        events.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        if (options?.fromDate || options?.toDate) {
            events = events.filter((e) => {
                const eventDate = e.createdAt;
                if (options.fromDate && eventDate < options.fromDate)
                    return false;
                if (options.toDate && eventDate > options.toDate)
                    return false;
                return true;
            });
        }
        let runningBalance = 0;
        const entries = events.map((event) => {
            runningBalance += parseFloat(event.amount);
            return {
                eventId: event.id,
                eventType: event.eventType,
                amount: event.amount,
                runningBalance: runningBalance.toFixed(8),
                description: event.description,
                createdAt: event.createdAt,
            };
        });
        const openingBalance = entries.length > 0
            ? (parseFloat(entries[0].runningBalance) - parseFloat(entries[0].amount)).toFixed(8)
            : "0.00000000";
        const closingBalance = entries.length > 0
            ? entries[entries.length - 1].runningBalance
            : "0.00000000";
        return {
            accountId,
            currency: account.currency,
            entries,
            openingBalance,
            closingBalance,
        };
    }
    async verifyLedgerIntegrity(accountId) {
        const account = await this.storage.getAccount(this.config.tenantId, accountId);
        if (!account) {
            throw new LedgerError(`Account ${accountId} not found`, "ACCOUNT_NOT_FOUND", { accountId });
        }
        const events = await this.storage.getEventsByAccountId(this.config.tenantId, accountId);
        const errors = [];
        events.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        for (let i = 0; i < events.length; i++) {
            if (events[i].sequenceNumber !== i + 1) {
                errors.push(`Gap in sequence: expected ${i + 1}, got ${events[i].sequenceNumber}`);
            }
        }
        for (const event of events) {
            if (event.tenantId !== this.config.tenantId) {
                errors.push(`Tenant isolation violation: event ${event.id} has wrong tenantId`);
            }
        }
        let calculatedBalance = 0;
        for (const event of events) {
            calculatedBalance += parseFloat(event.amount);
        }
        const balance = await this.getAccountBalance(accountId);
        const expectedBalance = parseFloat(balance.balance);
        if (Math.abs(calculatedBalance - expectedBalance) > 0.00000001) {
            errors.push(`Balance mismatch: expected ${expectedBalance}, calculated ${calculatedBalance}`);
        }
        return {
            valid: errors.length === 0,
            accountId,
            expectedBalance: expectedBalance.toFixed(8),
            calculatedBalance: calculatedBalance.toFixed(8),
            eventCount: events.length,
            errors,
        };
    }
}
exports.Ledger = Ledger;
exports.VERSION = "0.0.0";
//# sourceMappingURL=index.js.map