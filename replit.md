# WebWaka Core Ledger

## Overview

This is a TypeScript library module that provides an append-only financial ledger engine for the WebWaka platform. It is a **headless library** with no UI or runtime service.

## Project Structure

```
├── src/
│   ├── index.ts       # Ledger engine and public API
│   ├── index.test.ts  # Comprehensive tests (80%+ coverage)
│   └── storage.ts     # Storage implementations (DB + InMemory)
├── shared/
│   └── schema.ts      # Drizzle ORM database schema
├── dist/              # Compiled JavaScript output
├── drizzle.config.ts  # Drizzle ORM configuration
├── package.json       # Node.js package configuration
├── tsconfig.json      # TypeScript compiler configuration
├── vitest.config.ts   # Test configuration
└── module.manifest.json  # WebWaka module metadata
```

## Development

### Build Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm run test` - Run tests
- `npm run test:coverage` - Run tests with coverage report
- `npm run clean` - Remove compiled files
- `npm run db:push` - Push schema changes to database

## Ledger Engine Capabilities

### Core Functions

1. **openAccount(params)** - Create a new ledger account
2. **recordEvent(params)** - Record a financial event (credit/debit)
3. **reverseEvent(params)** - Create a compensating reversal event
4. **getAccountBalance(accountId)** - Get derived balance from events
5. **getAccountStatement(accountId, options?)** - Get statement with running balances
6. **verifyLedgerIntegrity(accountId)** - Validate account integrity

### Invariants (HARD STOP CONDITIONS)

- **Append-Only**: Events are immutable once recorded
- **Derived Balances**: Balances are calculated, never stored
- **Tenant Isolation**: All data isolated by tenantId
- **Idempotency**: Duplicate events prevented via idempotencyKey
- **Compensating Reversals**: Corrections via new events only

## Database Schema

### Tables

- **ledger_accounts**: Account definitions with tenant isolation
- **ledger_events**: Immutable financial events with idempotency
- **audit_events**: Audit trail for all mutations

## Architecture

This module follows WebWaka's modular architecture:
- All data is tenant-isolated via `tenantId`
- No UPDATE or DELETE operations on ledger data
- Exports TypeScript types and classes for consumption by Suite modules

## Dependencies

- **drizzle-orm**: Database ORM for PostgreSQL
- **pg**: PostgreSQL client
- **uuid**: Unique identifier generation
- **vitest**: Testing framework
