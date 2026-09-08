# Personal Finance Visualization & Budgeting Portal (Design Spec)

**Date**: 2026-09-08  
**Status**: Validated Design  
**Target Platform**: Local-First Web Application (React + Vite + TypeScript)

---

## 1. Executive Summary & Objectives

The **Personal Finance Visualization & Budgeting Portal** is a high-performance, private, local-first web application tailored for Ukrainian users and international multi-currency budgeting. It bridges the gap between raw bank/budget exports (specifically **Monobank** and **Toshl Finance**) and deep, actionable visual analytics.

### Core Goals:
1. **Zero Data Leakage (100% Privacy)**: All financial statements (`.xlsx`, `.xls`, `.csv`) are processed entirely client-side in the browser. Financial records are persisted in `IndexedDB`. No cloud databases or servers receive transaction data.
2. **Effortless Multi-Source Ingestion**: One-click import with automatic source detection for Monobank statements and Toshl exports, supported by a deterministic deduplication algorithm preventing duplicate entries upon overlapping imports.
3. **Smart Rule Engine & Dynamic Categorization**: Seamless normalization between bank-native categories, MCC codes, and user-defined high-priority rules with instant 1-click rule creation.
4. **Rich Visual Analytics**: Comprehensive dashboard covering expense distributions, dynamic burn rates, income vs. expense balance, Month-over-Month (MoM) shifts, top merchants, and a GitHub-style calendar expense heatmap.
5. **Smart Savings & Recommendations Engine**: An intelligent diagnostic assistant detecting recurring zombie subscriptions, abnormal category spikes, cumulative micro-expenses ("Latte effect"), and 50/30/20 allocation drift.

---

## 2. Technical Stack & Architecture

### 2.1 Technology Decisions
* **Framework**: React 19 + TypeScript (strict mode) via Vite.
* **Storage Engine**: `IndexedDB` abstracted with `Dexie.js` (including `dexie-react-hooks` for reactive live queries across the UI).
* **Data Parsing**:
  * `xlsx` (SheetJS) for binary and modern Excel files (`.xlsx`, `.xls`).
  * `papaparse` for structured CSV parsing.
* **Visualization & Charts (Ant Design Style)**:
  * **`@ant-design/plots` (AntV G2)** / Ant Design Charts styling for premium, ultra-polished enterprise aesthetics:
    * **Interactive Donut Chart** with central metric summary (`statistic`), smooth hover animations, and elegant legend.
    * **Smooth Area / Dual-Axes Column Chart** with gradient fills for Income vs. Expense trends.
    * **Horizontal Bar / Column Charts** with rounded corners and clean value labels for Top Merchants.
    * **Ant Design Calendar Heatmap** for daily expenditure density.
    * **Bullet & Progress Gauges** for category budget limits.
* **Icons & Typography**:
  * `lucide-react` / `@ant-design/icons` for consistent financial and navigation iconography.
  * Google Fonts: `Inter` / `Outfit` font pairings.
* **Styling & Design System**:
  * Modern Ant Design inspired design language: clean card borders, sleek dark/light theme, subtle glassmorphism, harmonious HSL palettes, and refined micro-interactions.

### 2.2 System Architecture Diagram

```
+-------------------------------------------------------------------------------+
|                             BROWSER RUNTIME                                   |
|                                                                               |
|  +------------------+     +--------------------+     +---------------------+  |
|  | File Drag & Drop | --> | Statement Ingestion| --> | Deduplication &     |  |
|  | (.xlsx / .csv)   |     | Pipeline (Adapters)|     | Hash Verification   |  |
|  +------------------+     +--------------------+     +---------------------+  |
|                                                                  |            |
|                                                                  v            |
|  +------------------+     +--------------------+     +---------------------+  |
|  | Analytics Engine | <-- | IndexedDB Storage  | <-- | Rule Engine         |  |
|  | & Insights Calc  |     | (Dexie.js Models)  |     | (Auto-Categorizer)  |  |
|  +------------------+     +--------------------+     +---------------------+  |
|           |                                                                   |
|           v                                                                   |
|  +-------------------------------------------------------------------------+  |
|  |                       REACT PRESENTATION LAYER                          |  |
|  |  * Overview Dashboard     * Smart Savings Cards    * Heatmap Calendar   |  |
|  |  * Transactions Table     * Category Budget Bars   * Backup / Export    |  |
|  +-------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------+
```

---

## 3. Data Schema & Storage Architecture

The database is registered under Dexie.js as `PersonalFinanceDB` (Database version: `1`).

### 3.1 Collections & Interfaces

#### `transactions`
```typescript
export interface Transaction {
  id: string;               // UUID or deterministic ID
  hash: string;             // sha256(date + amount + description + accountId)
  date: string;             // ISO 8601: "YYYY-MM-DDTHH:mm:ss"
  amount: number;           // Negative for expenses, positive for income
  currency: 'UAH' | 'USD' | 'EUR' | string;
  originalAmount?: number;  // If foreign transaction
  originalCurrency?: string;
  description: string;      // Merchant / clean transaction name
  originalCategory?: string;// Category reported by Monobank or Toshl
  categoryId: string;       // Normalized Category ID in system
  subCategory?: string;     // Optional subcategory (e.g. "Пальне", "Кава")
  mcc?: number;             // Merchant Category Code (from Monobank)
  source: 'monobank' | 'toshl' | 'generic' | 'manual';
  accountId: string;        // E.g. "Монобанка Чорна", "Готівка", "Toshl Wallet"
  notes?: string;           // User notes
  isSubscription?: boolean; // Tagged by Smart Insights engine
}
```

#### `categories`
```typescript
export interface Category {
  id: string;               // E.g. "groceries", "dining", "transport"
  name: string;             // Ukrainian display name: "Продукти харчування"
  icon: string;             // Lucide icon name: "ShoppingCart", "Utensils", etc.
  color: string;            // HSL or Hex string for charts: "#10b981"
  type: 'expense' | 'income';
  isEssential: boolean;     // For 50/30/20 budget analysis (Needs vs. Wants)
  subCategories: string[];  // E.g. ["Супермаркети", "Ринки", "Вода"]
}
```

#### `budgets`
```typescript
export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;     // Limit in base currency (UAH)
  currency: string;
  alertThresholdPercent: number; // Defaults to 80%
}
```

#### `rules`
```typescript
export interface CategorizationRule {
  id: string;
  matchField: 'description' | 'mcc' | 'originalCategory';
  operator: 'contains' | 'equals' | 'startsWith' | 'regex';
  pattern: string;
  targetCategoryId: string;
  targetSubCategory?: string;
  priority: number;         // Lower number = higher precedence
  isActive: boolean;
}
```

#### `exchangeRates`
```typescript
export interface ExchangeRate {
  currency: 'USD' | 'EUR' | string;
  rateToUah: number;        // E.g. 41.50 for USD
  updatedAt: string;        // ISO timestamp
}
```

---

## 4. Ingestion Pipeline, Adapters & Deduplication

### 4.1 Ingestion Flow
1. User drops one or more files into the Upload Zone.
2. Ingestion Manager reads the binary buffer using `SheetJS` or CSV stream using `PapaParse`.
3. Auto-detector reads column headers from row 0-2 and matches adapter fingerprints:
   * **Monobank Fingerprint**: Matches columns `"Дата і час операції"`, `"Деталі операції"`, `"Сума в валюті картки (UAH)"`, `"MCC"`.
   * **Toshl Fingerprint**: Matches columns `"Date"`, `"Account"`, `"Category"`, `"Expense amount"`, `"Income amount"`.
   * **Generic Fallback**: If no fingerprint scores >80%, opens a column mapping modal allowing the user to select columns for Date, Amount, Description, and Category.
4. Each row is normalized into the intermediate `TransactionDraft` schema.
5. **Deduplication Engine**:
   * Computes a canonical hash for each row: `hash = SHA256(`${date.trim()}_${amount}_${description.toLowerCase().trim()}_${accountId}`)`.
   * Checks database for existing hashes using IndexedDB index `by_hash`.
6. **Pre-Import Confirmation Modal**:
   * Displays breakdown: Total records found, New records to write, Duplicates skipped.
   * Gives an interactive preview table with the first 5 records.
   * User clicks **"Застосувати імпорт (N операцій)"** to commit to `IndexedDB`.

---

## 5. Categorization & Rule Engine

### 5.1 Multi-Tier Categorization Hierarchy
When a transaction is imported without a manual override, `categoryId` is determined via:
1. **Tier 1 (User Rules)**: Highest priority. Sorted by `priority ASC`. If description or MCC matches active rule, assign `targetCategoryId`.
2. **Tier 2 (Source Native Mapping)**:
   * Monobank category dictionary (e.g. "Продукти" -> "groceries", "Кафе та ресторани" -> "dining", "Авто та АЗС" -> "transport").
   * Toshl category dictionary (matches category strings to system IDs).
3. **Tier 3 (Fallback)**: If no match occurs, assigned to `"other"` ("Різне / Інше") for easy review.

### 5.2 One-Click Rule Creation
From any transaction row in the Transactions Explorer:
* Clicking the Category dropdown changes the category immediately.
* A subtle toast/popover appears: *"Створити правило для всіх операцій зі схожим описом "[Merchant Name]"?"*
* If approved, the rule is saved and instantly backfills past transactions and tags future imports.

---

## 6. Analytics & Visualizations

### 6.1 Overview Dashboard
1. **Financial Health Cards (KPIs)**:
   * **Загальні витрати** (Total Expenses in UAH with MoM delta `%`).
   * **Загальні доходи** (Total Income with MoM delta `%`).
   * **Чистий залишок / Заощадження** (Net Balance = Income - Expenses, + Savings Rate %).
   * **Темп витрат (Burn Rate)**: Average daily spend and projected end-of-month total.
2. **Interactive Donut Chart (Category Distribution)**:
   * Displays expense breakdown by category with dynamic percentages.
   * Clicking a slice filters the dashboard view to focus exclusively on that category.
3. **Income vs. Expense Dynamics (Monthly/Daily Bar Chart)**:
   * Dual bar / area chart illustrating income inflows vs. expense outflows across time periods.
4. **Category Budget Gauges**:
   * Visual progress bars for categories with established limits:
     * `< 75%`: Emerald green.
     * `75% - 99%`: Amber warning.
     * `>= 100%`: Crimson alert with exceeded amount badge.
5. **Top Merchants / Counterparties Chart**:
   * Horizontal bar chart listing the top 10 merchants by total spend (e.g., Сільпо, ОККО, Нова Пошта, Rozetka).

### 6.2 Advanced Analytics & Heatmap
1. **Calendar Expense Heatmap**:
   * Interactive calendar grid for the past 12 months or selected year.
   * Each cell represents one day; color intensity indicates spend volume.
   * Hover tooltip reveals exact daily spend, transaction count, and top purchase.
2. **Month-over-Month (MoM) Category Matrix**:
   * Side-by-side comparison table showing category-by-category changes between selected months.
3. **Currency Converter**:
   * Toggle between `UAH` (base), `USD`, and `EUR` using user-customizable or standard NBU reference exchange rates.

---

## 7. Smart Savings & Insights Engine ("Де можна зекономити")

The Smart Savings engine continuously analyzes transaction patterns and outputs actionable cards:

### 7.1 Insight Types & Algorithms
1. **Recurring Subscriptions & Zombie Services Detector**:
   * Scans for transactions with identical or near-identical amounts repeating at 27-33 day intervals with identical description prefixes (e.g. Netflix, Spotify, YouTube Premium, Apple, Megogo, Kyivstar, Gym).
   * Calculates annual burden and highlights services without frequent activity.
2. **Abnormal Category Spikes (Spike Detector)**:
   * Calculates rolling 90-day moving average for discretionary categories ("Кафе та ресторани", "Розваги", "Шопінг").
   * Triggers an alert if the current month exceeds 125% of baseline: *"Витрати на доставку їжі та ресторани на 38% вищі за середні (+2 850 ₴). Зниження до звичайного темпу заощадить 2 850 ₴"*.
3. **"Latte Factor" Micro-Spend Aggregator**:
   * Aggregates transactions under 150 ₴ in non-essential categories (coffee shops, bakeries, snacks).
   * Displays monthly sum and provides realistic optimization projections.
4. **50/30/20 Budget Optimization**:
   * Categorizes transactions into **Needs** (50%), **Wants** (30%), and **Savings/Debt** (20%).
   * Highlights allocation drift and recommends specific reduction amounts in the "Wants" tier.
5. **Direct Actionability**:
   * Every insight card includes an action button: *"Встановити бюджет"*, *"Створити правило"*, or *"Приховати"*.

---

## 8. Data Management & Demonstration Mode

* **Seed / Demo Data Generator**:
  * Built-in button: **«Завантажити демонстраційні дані (12 місяців)»**.
  * Synthesizes 400+ realistic Ukrainian transactions across Monobank (with authentic MCCs and categories) and Toshl, including salary deposits, supermarket runs, fuel stops, utility bills, and subscription cadences.
* **Full Database Backup & Restore**:
  * **Export**: Downloads a clean `.json` file containing all transactions, categories, budgets, and rules.
  * **Import**: Validates and restores from any exported backup file.
  * **Purge**: Secure 1-click database wipe with confirmation modal.

---

## 9. Verification & Quality Assurance Plan

1. **Parser Verification**:
   * Unit tests verifying `MonobankAdapter` parsing against Monobank date formats (`DD.MM.YYYY HH:mm:ss`), negative expenses, positive incomes, cashback fields, and MCC codes.
   * Unit tests verifying `ToshlAdapter` parsing against Toshl CSV exports.
   * Deduplication tests proving that re-uploading the exact same statement file leaves transaction count unchanged.
2. **Rule Engine Verification**:
   * Test rules with `contains`, `equals`, and `regex` operators.
   * Verify precedence: custom rule overrides default bank mapping.
3. **Analytics Math Verification**:
   * Verify accurate calculation of total expenses, net savings, daily burn rate, and MoM percentages.
4. **UI & Accessibility Verification**:
   * Theme switcher test (Dark/Light).
   * Responsive layout check on 375px (mobile), 768px (tablet), and 1440px (desktop).
   * Error state validation for empty database, corrupted file upload, and boundary date selections.
