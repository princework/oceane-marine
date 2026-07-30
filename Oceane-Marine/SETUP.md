# Setup — Import from Email

The **Import from Email** button on the STS Operations list reads client nomination emails
from a shared operations mailbox, extracts the operation details, files the PDF attachments
into their document slots, and creates a **draft** STS operation for an operator to review.

Nothing is ever submitted automatically — the import stops at an `INPROGRESS` draft.

---

## Environment variables

Add these to `.env.local` (and to the deployment environment).

| Variable | Required | Purpose |
| --- | --- | --- |
| `GMAIL_CLIENT_ID` | ✅ | OAuth client ID for the Google Cloud project |
| `GMAIL_CLIENT_SECRET` | ✅ | OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | ✅ | Long-lived refresh token for the operations mailbox (see below) |
| `ANTHROPIC_API_KEY` | — | Improves how much of the email body is read. Import works without it — see below |
| `GMAIL_USER_ID` | — | Mailbox to read. Defaults to `me` (the account that granted the token) |
| `GMAIL_SEARCH_LABEL` | — | Restrict the search to one Gmail label, e.g. `Clients/Nominations` |
| `GMAIL_SYNCED_LABEL` | — | Label applied after import. Defaults to `STS/Synced` |

The mailbox search is always scoped to `has:attachment` within the last 30 days. Setting
`GMAIL_SEARCH_LABEL` narrows it further and is recommended for a busy mailbox.

---

## Google Cloud — minting the refresh token

Do this **once**, signed in as the operations mailbox account.

### 1. Enable the Gmail API

1. Open the [Google Cloud console](https://console.cloud.google.com/) and select (or create) a project.
2. Go to **APIs & Services → Library**.
3. Search for **Gmail API** and click **Enable**.

### 2. Choose the audience

Google has replaced the single "OAuth consent screen" page with the **Google Auth Platform**
section (`console.cloud.google.com/auth/...`). Older guides refer to the previous layout.

Go to **Google Auth Platform → Audience**.

- **Internal** (Google Workspace organisations) — recommended. Avoids the verification
  review and the refresh-token expiry described below.
- **External** — set the publishing status to **In production**. While it stays in
  **Testing**, Google expires refresh tokens after 7 days and the integration breaks with
  "Gmail access expired" roughly once a week. Also add the operations mailbox under
  **Test users**, or authorisation will be refused.

### 3. Add the scopes

Go to **Google Auth Platform → Data Access → Add or remove scopes** and add:

- `https://www.googleapis.com/auth/gmail.readonly` — list and read messages and attachments
- `https://www.googleapis.com/auth/gmail.modify` — create and apply the `STS/Synced` label

Without `gmail.modify` the import still works, but imported emails are never badged as
**Synced**.

### 4. Create (or reuse) OAuth credentials

Go to **Google Auth Platform → Clients**.

1. **Create client** → application type **Web application**. An existing Web client can be
   reused; adding a redirect URI to it is additive and will not affect its other app.
2. Under **Authorized redirect URIs**, add exactly — no trailing slash:
   ```
   https://developers.google.com/oauthplayground
   ```
3. Save, then copy the **Client ID** into `GMAIL_CLIENT_ID`.
4. For the secret: Google no longer lets you view an existing client secret. If you did not
   store it when the client was created, use **Client secrets → Add secret** and copy the
   new value immediately — it is shown only once. Put it in `GMAIL_CLIENT_SECRET`.

### 5. Exchange for a refresh token via OAuth Playground

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Click the **gear icon** (top right) and tick **Use your own OAuth credentials**.
   Paste the client ID and secret from step 4.
3. In the left panel, under **Step 1**, paste both scopes:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.modify
   ```
4. Click **Authorize APIs**. **Sign in as the operations mailbox account** — not your own
   account. Whatever account you pick here is the mailbox the app will read.
5. Under **Step 2**, click **Exchange authorization code for tokens**.
6. Copy the **Refresh token** into `GMAIL_REFRESH_TOKEN`.

The refresh token does not expire under an Internal or published-External consent screen,
but it *is* revoked if the mailbox password changes or access is withdrawn from the
account's security settings. When that happens the app reports
"Gmail access expired. Reconnect the operations mailbox in Settings." — repeat step 4.

---

## Field extraction — with or without an Anthropic key

**The import works without an Anthropic key.** Attachment download, filename-based document
routing, storage, reference generation and draft creation are all deterministic and need no
model. Only how much of the email *body* gets read changes.

| | Without a key | With a key |
| --- | --- | --- |
| Attachments filed into document slots | ✅ | ✅ |
| Draft operation created | ✅ | ✅ |
| Location / cargo / operation type | Filled when the email names one verbatim | Also understands paraphrasing |
| CHS / MS names | Only from labelled lines (`CHS: MT STELLA`) | Also from prose |
| Quantity | Only when given in MT | Also from prose |

Without a key the app matches the email text against the option values that actually exist
in your master data. It is exact matching, not inference: if the email names two different
cargo grades, the field is left blank rather than one being picked.

To enable the fuller reading, create a key at
[console.anthropic.com](https://console.anthropic.com/) and set `ANTHROPIC_API_KEY`.
Extraction then uses `claude-sonnet-4-6` with tool-use, constrained to your real dropdown
values — anything the model returns that is not a genuine option is discarded server-side
and left blank. No restart of the feature is needed beyond restarting the server; if the
key is ever missing or the API is unreachable, the import silently falls back to
deterministic matching rather than failing.

---

## Verifying the setup

1. Restart the dev server so the new environment variables are picked up.
2. Sign in as a user whose **operations role is `editor`** — the button is hidden and the
   API returns 403 for every other role.
3. Go to **Operations → STS Operations → List**.
4. Click **Import from Email**. The dialog lists client emails from the last 30 days that
   have attachments. Emails already imported carry a **Synced** badge.
5. Click **Import** on one. You land on the draft's edit page with fields and documents
   pre-filled. Review, correct anything blank or wrong, then save or submit as usual.

Run the attachment-routing tests with:

```bash
npm test
```

---

## How attachments are filed

Routing is done from the **filename only** — never by the model, because a Q88 filed under
the wrong vessel is worse than one left unfiled.

| Filename contains | Slot |
| --- | --- |
| `joint plan`, `jpo` | Joint Plan Operation |
| `risk assessment` | Risk Assessment |
| `mooring plan` | Mooring Plan |
| `q88`, `ssq`, `msds`, `ga plan` / `general arrangement`, `mooring arrangement` / `mooring arr`, `indemnity` / `loi` | The matching CHS or MS slot |

For the per-vessel documents, the vessel is resolved by looking for the extracted vessel
name in the filename, then falling back to the keywords `chs` / `mother` / `discharging`
and `ms` / `daughter` / `receiving`.

Anything whose document type or vessel cannot be determined — and any second file competing
for a slot that is already filled — is attached to the operation's general **Attachments**
list instead, where the operator can file it manually.

---

## Narrowing which emails appear

By default the picker lists every message from the last 30 days that has an attachment.
Two optional variables cut that down:

| Variable | Effect |
| --- | --- |
| `GMAIL_SUBJECT_FILTER` | Only show emails whose subject contains one of these terms. Comma-separated terms are OR-ed: `STS,nomination` becomes `subject:(STS OR nomination)`. |
| `GMAIL_SEARCH_LABEL` | Only show emails carrying this Gmail label, e.g. `Clients/Nominations`. |

Both are additive on top of the built-in `has:attachment newer_than:30d` scope, and both
take effect on server restart.

---

## Client and agent auto-creation

Client and agent are read from **labelled lines** in the email body:

```
Client: Shell Trading, Ltd
Agent: Gulf Marine Agencies
```

`Charterer:` and `Agency:` work as alternative labels. A company name mentioned only in
prose is *not* attributed — too ambiguous to tell whose name it is.

When a name is found, it is matched against the master list case- and
whitespace-insensitively, so `SHELL TRADING` and `Shell  Trading` both resolve to an
existing `Shell Trading` rather than creating a near-duplicate. The stored spelling wins,
so the value always lines up with the form's dropdown.

**If there is no match, the name is added to the master list** and tagged
`source: "EMAIL_IMPORT"`. Records added by hand keep `source: "MANUAL"`.

> ⚠️ This means client emails can grow your master data. A misspelling in an email
> (`Shel Trading`) becomes a new master record, not a match. Review auto-added names
> periodically — filter on `source: "EMAIL_IMPORT"` — and merge any duplicates.
