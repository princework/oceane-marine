# operations-sts-checklist

> Public, anonymous **STS (Ship-to-Ship) operations checklist portal**
> for Oceane Group. Mooring masters, surveyors and vessel staff open a
> link from the main **Oceane-Marine** app, fill out the relevant
> **OPS-OFD-…** checklist while at sea or alongside a terminal, and the
> submission flows back to the main app — where lists, document
> generation (DOCX / PDF), signatures and admin reviews live.
>
> No login. No database of its own. This app is a **proxy + form UI**
> on top of the Oceane-Marine API.

---

## Table of contents

1. [Role in the ecosystem](#1-role-in-the-ecosystem)
2. [Tech stack](#2-tech-stack)
3. [Repository layout](#3-repository-layout)
4. [Source layout (`src/`)](#4-source-layout-src)
5. [Form catalogue](#5-form-catalogue)
6. [Dashboard / index page](#6-dashboard--index-page)
7. [Configuration & API base URL](#7-configuration--api-base-url)
8. [Same-origin proxy (`/api/sts-proxy/...`)](#8-same-origin-proxy-apists-proxy)
9. [Form lifecycle (create vs update)](#9-form-lifecycle-create-vs-update)
10. [Signatures](#10-signatures)
11. [Anonymous access — coupling with Oceane-Marine](#11-anonymous-access--coupling-with-oceane-marine)
12. [Environment variables](#12-environment-variables)
13. [Local development](#13-local-development)
14. [Deployment](#14-deployment)
15. [Troubleshooting](#15-troubleshooting)
16. [Notable conventions](#16-notable-conventions)

---

## 1. Role in the ecosystem

```
Mooring master / surveyor at sea
              │
              │  https://operations.<domain>/<OPS-OFD-XXX>?operationRef=2026-001&mode=update
              ▼
┌──────────────────────────────────┐  /api/sts-proxy/<form>/...   ┌──────────────────────────────┐
│ operations-sts-checklist         │ ───────────────────────────▶ │ Oceane-Marine                │
│ Next.js, anonymous, public       │  ${STS_API_BASE_URL or       │ /api/operations/sts-checklist│
│ /OPS-OFD-001 … /OPS-OFD-029      │   NEXT_PUBLIC_API_BASE_URL1}  │  …/create  …/update          │
└──────────────────────────────────┘                              │  …?operationRef=…            │
                                                                  └──────────────────────────────┘
                                                                              │
                                                                              ▼
                                                                  Internal lists, DOCX
                                                                  generation, controlled
                                                                  document register, etc.
```

Why a separate app at all?

- **Onboard usability** — completed by non-CRM users on phones / tablets
  with no shared login.
- **CORS-free** — the same-origin `/api/sts-proxy/...` route lets the
  browser look local while the request is forwarded to the
  Oceane-Marine API.
- **Independent deploy cadence** — checklist UI changes (e.g. adding a
  new row to a checklist) ship without redeploying the back office.

---

## 2. Tech stack

| Area | Choice |
|------|--------|
| Framework | **Next.js 16.1.6** (App Router), **React 19.2.3** |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss` |
| Fonts | Geist + Geist Mono via `next/font/google` |
| Lint | ESLint 9 + `eslint-config-next` (core-web-vitals) |
| HTTP | Native `fetch` only |
| Signatures | **Native `<input type="file">` + `FileReader`** → base64 (no `signature_pad`) |
| PDF generation | **None** in this app — handled by Oceane-Marine workers |

JavaScript only. `jsconfig.json` aliases `@/` → `./src/`.

---

## 3. Repository layout

```
operations-sts-checklist/
├── src/                  # Application source (see §4)
├── public/               # /image/logo.png, /image/background.img, etc.
├── next.config.mjs       # Minimal Next config
├── postcss.config.mjs    # Tailwind v4 plugin
├── eslint.config.mjs     # Flat ESLint config
├── jsconfig.json         # @/* alias
├── package.json          # Dependencies and scripts
├── README.md             # ← this file
├── FRONTEND_README.md    # Older notes on API URL / list pages (legacy)
└── .env.local            # Local secrets (gitignored)
```

---

## 4. Source layout (`src/`)

| Path | Role |
|------|------|
| `src/app/layout.js` | Root layout — Geist fonts, global styles. |
| `src/app/page.js` | Dashboard listing every form (uses `FORMS` + `FORM_TITLES` from `lib/config.js`). |
| `src/app/globals.css` | Tailwind import + small helpers. |
| `src/app/<OPS-OFD-XXX>/page.js` | One folder **per form** (e.g. `OPS-OFD-005E/page.js`). The page renders the matching client component (e.g. `STSDeclarationForm.js`). |
| `src/app/api/sts-proxy/[...path]/route.js` | The same-origin proxy (see §8). |
| `src/lib/config.js` | `API_BASE_URL`, `FORM_TITLES`, `FORMS`. |
| `src/lib/api.js` | Sample fetch helpers (`submitDeclarationOfSea`, `submitChecklistForm`, `dataURLtoFile`). **Reference layer** — most forms inline their own `fetch`. |

> There is no shared `components/` directory in this app. UI lives
> next to each form route. Static assets live in `public/`.

---

## 5. Form catalogue

Each entry below corresponds to one **`/<OPS-OFD-XXX>`** route. Sequence
follows the actual STS operation lifecycle.

### Pre-fixture & approach

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-001` | Before Operation Commence | Vessel-side pre-op checks (CHECKLIST 1). |
| `OPS-OFD-001A` | Ship Standard Questionnaire | Structured ship questionnaire. |
| `OPS-OFD-002` | Before Run In & Mooring | Pre run-in & mooring checks (CHECKLIST 2). |

### Cargo transfer readiness

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-003` | Before Cargo Transfer (3A & 3B) | Cargo-transfer readiness checks. |
| `OPS-OFD-004` | Pre-Transfer Agreements (4A-4F) | Pre-transfer conference items. |

### During transfer

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-005` | During Transfer (5A-5C) | After-connection checks until disconnection. |
| `OPS-OFD-005B` | Before Disconnection & Unmooring | Checks before/after disconnect (6A & B). |

### Terminal

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-005C` | Terminal Transfer Checklist | Pre-transfer conference alongside a terminal (CHECKLIST 7). |

### Declarations

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-005D` | Declaration for STS operations (At port & Terminal) | Tri-party declaration (terminal-berthed ship, outer ship, terminal) with checklist applicability and three signature columns. |
| `OPS-OFD-005E` | Declaration Of STS At Sea | Declaration for STS operations at sea — constant-heading vs manoeuvring ship responsibility per row, with signatures from both ships. |

### Safety, equipment & logs

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-009` | Mooring Master's Job Report | Operational report by the mooring master. |
| `OPS-OFD-011` | STS Standing Order | STS Superintendent standing orders. |
| `OPS-OFD-014` | Equipment Checklist | Fender / hose / equipment phase checks. |
| `OPS-OFD-015` | Hourly Quantity Log | Hourly discharged / received quantity logging. |
| `OPS-OFD-028` | Personnel Transfer Basket Checklist | Indemnity terms acknowledgment + basket checklist. |

### Timekeeping & feedback

| Code | Title | Purpose |
|------|-------|---------|
| `OPS-OFD-018` | STS Timesheet | Operation timings. |
| `OPS-OFD-020` | Master's Feedback Form | Master's post-op feedback. |
| `OPS-OFD-023` | Record of Work Hours | Personnel work hours record. |
| `OPS-OFD-029` | Mooring Master Expense Sheet | Mooring master expenses. |

> **Coverage note:** the OPS-OFD-* codes implemented here are
> **not contiguous** — read the catalogue as "the OPS-OFD series
> including the codes above", not "OPS-OFD-001 … 029".

---

## 6. Dashboard / index page

`src/app/page.js`:

- Imports `FORMS` and `FORM_TITLES` from `@/lib/config`.
- Renders a single dark table; each row links to **`/{form.path}`**.
- The first entry is **`OPS-OFD-005E`** so that "Declaration Of STS At
  Sea" routes to a real folder (`src/app/OPS-OFD-005E/`). An older
  build had `path: 'declaration-sts-sea'` here, which 404'd because no
  such folder existed.

To add a new form:

1. Create `src/app/<NEW-CODE>/` with `page.js` and the form component.
2. Add `<NEW-CODE>` to `FORM_TITLES` and `FORMS` in `src/lib/config.js`.
3. Make sure the matching `/api/operations/sts-checklist/<slug>/...`
   handlers exist on Oceane-Marine and are covered by
   `isPublicOperationsStsChecklistRoute` in its middleware.

---

## 7. Configuration & API base URL

`src/lib/config.js`:

```js
export const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api/sts-proxy'
    : process.env.NEXT_PUBLIC_API_BASE_URL1 ||
      'http://localhost:3000/api/operations/sts-checklist';
```

| Context | Resolves to |
|---------|-------------|
| Browser | `/api/sts-proxy` (same-origin, CORS-free) |
| Node (SSR / build) | `process.env.NEXT_PUBLIC_API_BASE_URL1` if set, otherwise the dev fallback above |

`FORM_TITLES` and `FORMS` further down in the same file drive the
dashboard. Keep both in sync when adding/removing forms.

> The exported `API_BASE_URL` from `config.js` is the **canonical**
> base. Some older form components inline `'/api/sts-proxy/...'`
> directly — equivalent in the browser but not centralised. New forms
> should import `API_BASE_URL`.

---

## 8. Same-origin proxy (`/api/sts-proxy/...`)

**File:** `src/app/api/sts-proxy/[...path]/route.js`

Behaviour:

- `getBackendBase()` resolves (in order):
  1. `process.env.STS_API_BASE_URL`
  2. `process.env.NEXT_PUBLIC_API_BASE_URL1`
  3. `http://localhost:3000/api/operations/sts-checklist`
- Strips trailing slashes and appends the dynamic `[...path]`:
  - browser request `/api/sts-proxy/ops-ofd-001/create`
  - → forwards to `${BACKEND}/ops-ofd-001/create`.
- Methods: **GET, POST, PUT**.
- Bodies: read as `arrayBuffer()` and forwarded raw (handles
  `multipart/form-data` for signature uploads).
- Forwards `Authorization` and `Cookie` if present.
- In `NODE_ENV === 'development'` it logs `[sts-proxy] →` for each
  call, which is handy when checking that the URL composes correctly.

---

## 9. Form lifecycle (create vs update)

Take **`OPS-OFD-005E/STSDeclarationForm.js`** as the reference (the
sister `OPS-OFD-005D/DeclarationSTSTerminal.js` is identical apart from
having three signature columns).

### Inputs

The mooring master usually opens a link from the main app of the form:

```
https://operations.<domain>/OPS-OFD-005E?operationRef=2026-001&mode=update
```

`useSearchParams()` reads:

- `operationRef` — used as the upsert key (or generated client-side for
  pure "create").
- `mode` — `update` triggers an initial GET; otherwise the form starts
  empty.

### Initial load

If `mode === 'update'` and `operationRef` is present:

```
GET /api/sts-proxy/ops-ofd-005e?operationRef=<ref>
```

If a record exists, every field is hydrated; if not,
`getUserFriendlyError` translates `CHECKLIST_NOT_FOUND` into a UI
message and the form falls back to create mode.

### Submit

```
multipart/form-data:
  data: <JSON.stringify(payload)>
  signature: <File>          // when applicable
```

- **Create** → `POST /api/sts-proxy/<form>/create`
- **Update** → `PUT  /api/sts-proxy/<form>?operationRef=<ref>`

The **update** branch is taken when the page started in `update` mode
and a record was found.

### Validation

- Empty `operationRef` blocks submission with a user-facing error.
- Checklist rows use exclusive selection helpers (e.g. only one of
  Constant-Heading / Manoeuvring / N/A can be ticked per row).
- The `declarationAccepted` checkbox ("I agree to the declaration")
  must be on for declarations.

### Confirmation

The UI shows `submitSuccess` and either resets to a clean create form
(`resetFormToCreateMode`) or stays in update mode with the loaded
record. There is **no** PDF download from this app — the main app
generates the DOCX/PDF asynchronously via Agenda jobs.

---

## 10. Signatures

- File picker (no native signature pad).
- `FileReader.readAsDataURL(file)` → base64 string.
- `extractBase64()` strips the `data:image/...;base64,` prefix and
  passes the raw bytes inside the JSON payload (or as a `signature`
  file part for `multipart/form-data`).
- Stored signatures returned by the API come back as `/uploads/...`
  paths; `getSignatureUrl()` resolves them against
  `NEXT_PUBLIC_API_BASE_URL1` (origin-only, no `/api`) so the `<img>`
  tag points at the main app's static tree.

The Oceane-Marine side stores them at
`public/signature/sts-checklist-<form-slug>/YYYY/MM/DD/...png` (see
`src/lib/utils/signature-storage.js` in that repo).

---

## 11. Anonymous access — coupling with Oceane-Marine

There is **no login** in this app. From `src/lib/config.js`:

```
External forms have no Oceane login; the main app allows anonymous
create/read/update (`isPublicOperationsStsChecklistRoute` in
Oceane-Marine `src/middleware.js`). DELETE checklist records still
requires a logged-in session.
```

Concretely, the main app middleware permits cookie-less:

- `POST /api/operations/sts-checklist/<form>/create`
- `GET  /api/operations/sts-checklist/<form>?operationRef=…`
- `PUT  /api/operations/sts-checklist/<form>?operationRef=…`
- `GET  /api/operations/sts-checklist/<form>/<id>`
- `PUT  /api/operations/sts-checklist/<form>/<id>/update`

Anything else (list-all, delete, archive) still requires a session.

---

## 12. Environment variables

| Key | Required | Purpose |
|-----|:-------:|---------|
| `NEXT_PUBLIC_API_BASE_URL1` | yes | Base URL of the Oceane-Marine app **plus** the API prefix used by `config.js`. e.g. `https://main.example.com/api/operations/sts-checklist` (production) or `http://localhost:3000/api/operations/sts-checklist` (dev). Browsers don't actually read this — see below — but it is required server-side and as the `getSignatureUrl` origin. |
| `STS_API_BASE_URL` | optional | Server-side override that wins over `NEXT_PUBLIC_API_BASE_URL1` inside the `/api/sts-proxy/...` route. Useful when the proxy must hit an internal hostname different from the one shared with browsers. |
| `NODE_ENV` | n/a | Standard. Enables the `[sts-proxy] →` console logs in dev. |

> In the browser, the API base is **always** `/api/sts-proxy` — the env
> vars only steer where that proxy forwards on the server side.

`.env.local` is gitignored.

---

## 13. Local development

### Prerequisites

- Node.js ≥ 20
- A reachable Oceane-Marine instance (you must run that app first)

### Setup

```bash
git clone <repo>
cd operations-sts-checklist
npm install
cat > .env.local <<'EOF'
NEXT_PUBLIC_API_BASE_URL1=http://localhost:3000/api/operations/sts-checklist
EOF
npm run dev          # http://localhost:3000  (or another port)
```

> If Oceane-Marine is on **port 3000**, run this app on a different
> port: `PORT=3001 npm run dev`.

### Smoke test

1. Open `http://localhost:3001/`.
2. Click **OPS-OFD-005E – Declaration Of STS At Sea**.
3. Submit the form (try `operationRef=2026-TEST`).
4. In Oceane-Marine, open
   `/operations/sts-operations/new/form-checklist/sts-checklist/declaration-of-sea/list`.
   The submission should appear, and an Agenda worker run will
   generate the DOCX shortly after.

### Scripts

| Script | Action |
|--------|--------|
| `npm run dev` | `next dev` |
| `npm run build` | `next build` |
| `npm start` | `next start` |
| `npm run lint` | ESLint |

---

## 14. Deployment

This app is designed to deploy independently — typically on Vercel.

1. Deploy **`Oceane-Marine`** first; note its public URL.
2. Deploy this repo on Vercel. No `vercel.json` needed.
3. In project settings → Environment Variables → set:

   ```
   NEXT_PUBLIC_API_BASE_URL1 = https://<oceane-marine-host>/api/operations/sts-checklist
   ```

   (no trailing slash.) Optionally set `STS_API_BASE_URL` if the
   server-side path should differ.
4. In `Oceane-Marine` set
   `NEXT_PUBLIC_STS_CHECKLIST_FORMS_BASE_URL = https://<this-app-host>`
   so the main app's STS hub page links here correctly.
5. Share form links from this app's domain, e.g.
   `https://operations.example.com/OPS-OFD-005E?operationRef=2026-001`.

---

## 15. Troubleshooting

- **404 on a form** — the slug in the URL must match a folder under
  `src/app/`. Run a fresh `npm run build` and check the page list.
  Also check `FORMS` in `src/lib/config.js` — the dashboard uses
  `path` to build the link, so a mismatch there causes a 404 only on
  the dashboard click-through (the URL itself is still valid).
- **Network → 500 from `/api/sts-proxy/...`** — proxy could not reach
  the backend. Verify `NEXT_PUBLIC_API_BASE_URL1` (or
  `STS_API_BASE_URL`) and that Oceane-Marine is running.
- **403 / redirect to login from main app** — the path you are hitting
  is **not** in `isPublicOperationsStsChecklistRoute`. Add it on the
  Oceane-Marine side.
- **`CHECKLIST_NOT_FOUND` on update** — the `operationRef` you opened
  with does not have a record yet. Submit once first to create it.
- **Signatures show as broken images** — check
  `NEXT_PUBLIC_API_BASE_URL1` (browsers use it inside `getSignatureUrl`
  for `/uploads/...` paths).

---

## 16. Notable conventions

- **JavaScript only** — no TypeScript.
- **Dark theme everywhere** — `bg-gray-900 text-white`, `bg-gray-800`
  borders, dark tables.
- **Background image** — many forms use `/image/background.img` as a
  CSS background.
- **Signatures** — file picker → base64; stored relative paths from
  the API are resolved with `getSignatureUrl()`.
- **Operation reference** is the upsert key — it is part of the URL
  and stays stable for an operation's whole lifecycle.
- **No PDF generation here** — DOCX/PDF outputs are owned by the
  Oceane-Marine Agenda worker (`generate-ops-ofd-*` jobs).
- **Add a form, edit two files**: `src/app/<CODE>/...` and
  `src/lib/config.js`. Then ensure the main-app side has the matching
  API + middleware allowance.

---

## See also

- [`FRONTEND_README.md`](./FRONTEND_README.md) — older, partially
  out-of-date notes on the dashboard / list pages. Kept for history;
  refer to this README first.
- Main app docs: [`../Oceane-Marine/README.md`](../Oceane-Marine/README.md)
- Sibling external app: [`../QHSE-FORMS/README.md`](../QHSE-FORMS/README.md)
