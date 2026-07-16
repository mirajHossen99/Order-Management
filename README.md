# Order Management Service

A production-grade NestJS & Prisma order-processing system designed for high concurrency, robust data integrity, and clean domain boundaries.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) (v18+) and your database of choice running and configured in your `.env` file.

### Project Setup

```bash
$ npm install

```

### Compile and Run

```bash
# Development mode
$ npm run start

# Watch mode (hot-reload)
$ npm run start:dev

# Production mode
$ npm run start:prod

```

### API Documentation

Once the application is running, you can access the interactive Swagger documentation at:
👉 **[http://localhost:3001/docs](https://www.google.com/search?q=http://localhost:3001/docs)**

---

## 🛠️ Key Architectural Decisions

Our architecture prioritizes data integrity, robust security boundaries, and modular separation of concerns:

| Decision | Implementation Detail | Benefit |
| --- | --- | --- |
| **Strict Request Validation** | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). | Prevents payload injection; strictly enforces typed DTOs. |
| **Normalized Error Handling** | Global exception filter (`AllExceptionsFilter`). | Standardizes HTTP errors and Prisma errors (e.g., `P2002`, `P2025`) into a consistent JSON contract while keeping internal stack traces safely logged on the server. |
| **High-Concurrency Stock Guard** | Lockless concurrent updates inside a Prisma transaction using a conditional `updateMany` (`WHERE stock >= quantity`). | Guarantees two concurrent orders cannot double-sell the last unit of stock without blocking the database with heavy tablespaces locks. |
| **Ownership-Aware Authorization** | Dynamic scoping in `GET /orders` paired with a custom `RolesGuard` / `@Roles()` decorator. | Regular users only see their own order history; Administrators can access and search global orders. |
| **Decoupled Business Logic** | Injectable, dedicated `OrderIdGeneratorService`. | Keeps identifier generation clean, testable, and easily mockable without polluting order transaction routines. |
| **Global Connection Lifecycle** | Global `PrismaModule` utilizing NestJS lifecycle hooks (`onModuleInit`/`onModuleDestroy`). | Eradicates redundant DB imports and prevents connection leaks during application hot-reloads or integration test suites. |
| **Domain-Driven Modularization** | Clean module-per-domain boundaries (`auth`, `products`, `orders`). | Encapsulates controller, service, and data transfer concerns into highly testable, predictable software boundaries. |

---

## 🔢 Order ID Generation Algorithm

To give fulfillment pipelines instantly recognizable business context at a glance, orders are identified using a customized, structured format:

$$\text{Format: } \langle\text{CATEGORY\_CODE}\rangle-\langle\text{PRODUCT\_CODE}\rangle-\langle\text{YYMMDD}\rangle-\langle\text{SEQUENCE}\rangle$$

> **Example:** `ELE-WIR-260703-0001`
> * **ELE** (Electronics)
> * **WIR** (Wireless Mouse)
> * Ordered on **2026-07-03**
> * The **1st** order of this product type on that calendar date.
> 
> 

### How it's built:

1. **CATEGORY_CODE & PRODUCT_CODE**
* Generated using the first 3 alphanumeric characters of the product's category and name.
* Transformed to uppercase, non-letters stripped, and right-padded with **`X`** if the input is shorter than 3 characters (e.g., Category `IT` becomes `ITX`).


2. **YYMMDD**
* The order date. This naturally resets the sequence counter every single day, keeping index spaces manageable and unbloated.


3. **SEQUENCE**
* A 4-digit, zero-padded integer scoped explicitly to the `(category, product, date)` bucket to ensure strict processing isolation.