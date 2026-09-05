# ⚡ RazorAgent — AI Growth & Agentic Commerce Platform

> **Grow the merchant’s revenue, and make them sellable to AI buyers.**

RazorAgent is an agentic commerce platform built for the **AI Growth & Agentic Commerce** challenge. It unites revenue-growth merchant agents (Conversational Checkout, Upsell & Cross-Sell, Campaign Orchestrator) with autonomous AI Buyer agents operating over open agent protocols (**ACP** and **x402**), under a strict safety kernel where **every money action is explainable, bounded, and gated**.

---

## 🌟 Key Capabilities

### 1. 🤖 Autonomous AI Buyer Agent (ACP & x402 Endpoints)
- **ACP Discovery**: Discovers merchant capabilities at `GET /.well-known/agent.json` (ACP Agent Card).
- **JSON-LD Catalog**: Parses structured Schema.org product data at `GET /api/catalog`.
- **x402 Protocol Implementation**: Interacts with `POST /api/protocol/checkout` returning **HTTP 402 Payment Required** with standard headers (`X-Payment-Required`, `X-Payment-Amount`, `X-Payment-Provider`, `X-Payment-Order-Id`).
- **Test-Mode Settlement**: Completes payment capture via Razorpay and settles order fulfillment at `POST /api/protocol/pay`.
- **Budget Gating**: Enforces hard budget constraints and triggers dynamic fallback product discovery when over-budget.

### 2. 📈 Revenue Growth Agents
- **Conversational In-App Checkout Agent**: Natural language shopping assistant powered by OpenAI GPT-4o with tool calling, coupon application, order creation, and payment link generation.
- **Upsell & Cross-Sell Agent**: Real-time cart analysis recommending complementary items, calculating bundle discounts, and generating instant 30-min payment links.
- **Campaign Orchestrator Agent**: Scans database for slow-moving SKUs (<5 sales in 30 days) and high-margin products (>40%), generates clearance coupons (e.g., `BOOST20_...`), and creates promotional Razorpay payment links.

### 3. 🛡️ Safety, Explainability & Gating Kernel
- **Bounded**: Every money transaction is checked against the session/merchant spending cap before execution (`SPENDING_CAP_EXCEEDED`).
- **Gated**: High-value transactions exceeding the configurable threshold (e.g., > ₹5,000) are routed to a **Human-in-the-Loop Approval Queue**.
- **Explainable**: Every tool call and money movement requires a plain-English AI justification logged before and after execution.
- **Append-Only Audit Trail**: Immutable real-time log capturing timestamp, agent name, action type, amount, Razorpay entity ID, explanation, and raw JSON payload.
- **Graceful Failures Handled**:
  - *Payment Timeout Auto-Recovery*: Handles `payment.link.expired`, marks order `TIMED_OUT`, and provisions a fresh 30-minute payment link.
  - *Budget Cap Alternative Search*: Rejects over-budget transactions without crashing and dynamically discovers affordable alternatives.

### 4. 💳 Razorpay Dual-Engine Architecture
- **Live Test Mode**: Fully integrated with Razorpay Node.js SDK when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are provided.
- **Built-in High-Fidelity Sandbox Simulator**: When keys are omitted, a high-fidelity simulator seamlessly generates valid `order_...`, `pay_...`, and `plink_...` entities, validates signatures, and handles webhook events out of the box without requiring external credentials.

---

## 🏗️ Architecture & Project Structure

```
RazorAgent/
├── server/                         # Express.js Backend & AI Services
│   ├── prisma/
│   │   └── schema.prisma           # PostgreSQL schema (Merchant, Product, Order, Payment, Campaign, AuditLog, ApprovalRequest)
│   ├── src/
│   │   ├── agents/                 # AI Agents (Orchestrator, Checkout, Upsell, Campaign, Buyer)
│   │   ├── config/                 # Database & Environment configuration
│   │   ├── middleware/             # JWT & Merchant Auth
│   │   ├── routes/                 # Protocol (ACP/x402), Auth, Products, Orders, Agents, Safety, Webhooks
│   │   ├── services/               # Razorpay Bridge & Safety Interceptor
│   │   ├── seed.js                 # Initial seed data
│   │   └── server.js               # Express entry point (Port 5000)
│   └── package.json
├── client/                         # React 18 + TailwindCSS Frontend (Vite)
│   ├── src/
│   │   ├── components/             # Navbar, Razorpay Modal, Approval Modal
│   │   ├── context/                # Merchant AuthContext
│   │   └── pages/                  # Overview, Catalog, Storefront Chat, Campaigns, AI Buyer, Audit Trail, Failure Lab, Login
│   └── package.json
├── start-all.js                    # Unified process launcher
└── package.json
```

---

## 🚀 Quick Start Guide

### 1. Database Setup (PostgreSQL)
Ensure PostgreSQL is running locally on port `5432`.
Create the database:
```sql
CREATE DATABASE razoragent_db;
```

### 2. Configure Environment (`server/.env`)
Edit `server/.env` if you want to add your OpenAI API key or live Razorpay test keys:
```env
PORT=5000
DATABASE_URL="postgresql://postgres@localhost:5432/razoragent_db"
JWT_SECRET="razoragent_super_secret_jwt_key_2026"
OPENAI_API_KEY="" # Optional: Add your OpenAI Key (deterministic fallback included)
OPENAI_MODEL="gpt-4o"
RAZORPAY_KEY_ID="" # Optional: Add Razorpay Test Key ID
RAZORPAY_KEY_SECRET="" # Optional: Add Razorpay Test Key Secret
RAZORPAY_WEBHOOK_SECRET="razoragent_webhook_secret_xyz"
```

### 3. Migrate & Seed Database
```bash
# Push Prisma schema and seed initial merchant, catalog, and audit log
npm run db:push
npm run db:seed
```

### 4. Start the Application
Run both backend and frontend together with a single command:
```bash
npm start
```
- **Merchant & Buyer Web App**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:5000](http://localhost:5000)
- **ACP Agent Card**: [http://localhost:5000/.well-known/agent.json](http://localhost:5000/.well-known/agent.json)
- **JSON-LD Catalog**: [http://localhost:5000/api/catalog](http://localhost:5000/api/catalog)

---

## 🧪 Demo Walkthrough Script (5-Minute Tour)

1. **Merchant Portal Login**:
   - Open [http://localhost:5173](http://localhost:5173) and click **1-Click Demo Merchant** (`merchant@razoragent.demo` / `password123`).
2. **AI Campaign Orchestrator**:
   - Navigate to **Revenue Campaigns**.
   - Notice the Opportunity Radar flagging slow-moving SKUs (e.g. *OmniView VR Headset* with only 2 sales in 30 days).
   - Click **Launch AI Campaign Now** -> Generates coupon code `BOOST20_...` and a shareable Razorpay payment link with plain-English reasoning.
3. **Conversational In-App Storefront & Upsell**:
   - Navigate to **Store & Checkout AI**.
   - Type `"I want to buy the Wireless Headphones"`.
   - The Checkout Agent adds the headphones and the Upsell Agent instantly presents a complementary **12% Bundle Deal** with the USB-C cable.
   - Click **Proceed to Razorpay Checkout** -> Opens the simulated Razorpay modal and captures test payment with celebratory confetti.
4. **Autonomous AI Buyer Agent (ACP + x402 Protocol)**:
   - Navigate to **AI Buyer Simulator**.
   - Set budget to `₹5,000` and objective to `"Buy the best value audio setup"`.
   - Click **Run Autonomous Buyer Loop**.
   - Watch the agent discover `/.well-known/agent.json`, query `/api/catalog`, receive the `402 Payment Required` challenge, pay via Razorpay, experience the spending cap block, and execute graceful fallback discovery!
5. **Failure & Safety Lab**:
   - Navigate to **Failure Recovery Lab**.
   - Click **Simulate Payment Timeout & Recovery** -> Demonstrates auto-recovery with a fresh 30-minute link.
   - Review and approve pending high-value transactions in the **Human Approval Gate Queue**.
6. **Audit Trail**:
   - Navigate to **Audit & Safety Trail** to inspect the append-only event stream with plain-English explanations.

---

## 🔒 Security & Protocols Reference

| Protocol / Standard | Endpoint | Description |
| :--- | :--- | :--- |
| **ACP v1.0** | `GET /.well-known/agent.json` | Agent Card declaring merchant capabilities and payment methods |
| **Schema.org** | `GET /api/catalog` | JSON-LD structured product list for machine discovery |
| **x402 Protocol** | `POST /api/protocol/checkout` | HTTP 402 challenge with RFC payment headers |
| **x402 Settlement** | `POST /api/protocol/pay` | Payment token verification & order fulfillment |
| **Razorpay Webhooks** | `POST /api/webhooks/razorpay` | HMAC-SHA256 signature verified event ingestion |
#
