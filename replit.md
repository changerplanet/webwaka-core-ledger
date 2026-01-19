# WebWaka Core Ledger

## Overview

This is a TypeScript library module that provides economic and financial ledger functionality for the WebWaka platform. It is a **headless library** with no UI or runtime service.

## Project Structure

```
├── src/           # TypeScript source files
│   └── index.ts   # Main library entry point
├── dist/          # Compiled JavaScript output
├── package.json   # Node.js package configuration
├── tsconfig.json  # TypeScript compiler configuration
└── module.manifest.json  # WebWaka module metadata
```

## Development

### Build Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm run clean` - Remove compiled files
- `npm test` - Run tests (to be implemented)

### Module Classification

- **Classification:** Core module
- **Type:** Headless TypeScript library
- **Status:** Infrastructure ready, implementation pending

## Architecture

This module follows WebWaka's modular architecture:
- All data is tenant-isolated via `tenantId`
- Exports TypeScript types and classes for consumption by Suite modules
- No direct database access - designed to be embedded in Suite applications

## Dependencies

- **webwaka-core-registry** - Module registration and capability resolution (external)
