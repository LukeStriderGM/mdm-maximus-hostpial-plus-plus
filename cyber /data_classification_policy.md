# Data Classification & Handling Policy

**Scope:** Medical Supply & Blood Distribution Platform — all environments, all components, all personnel and third parties that handle platform data.

**Purpose:** Define how data is classified, who may access it, and how it must be stored, transmitted, retained, and destroyed. This policy is the operational counterpart to `threat_model.md`. Where the threat model says *what* must be protected, this policy says *how*.

**Owner:** Security & Compliance.
**Review cadence:** Annually, and whenever a new data type, integration, or jurisdiction is introduced.

---

## 1. Classification Tiers

Every field, table, file, log line, and message handled by the platform is assigned to one tier. When in doubt, classify up.

### Tier 0 — Public

Information that is intentionally published or has no confidentiality value.

- Examples: marketing copy, public documentation, the login page, the platform's own brand assets.
- Handling: no special controls beyond integrity (no unauthorized modification).

### Tier 1 — Internal

Non-sensitive operational data that should not be public but causes no material harm if disclosed.

- Examples: aggregated, fully de-identified usage metrics; non-PHI configuration; product catalog of supply categories.
- Handling: access limited to authenticated users; standard logging; no special encryption requirements beyond TLS in transit.

### Tier 2 — Confidential (Business)

Commercially or operationally sensitive but not regulated health data.

- Examples: supplier contracts and pricing, route plans, courier identifiers and schedules, internal incident notes that contain no PHI, vendor security questionnaires.
- Handling: role-based access; encryption in transit and at rest; audit on read for contract and pricing data; data-minimized when shared with third parties.

### Tier 3 — Regulated / Sensitive Personal Data

Data that identifies or can re-identify a person, including authentication material.

- Examples: user account records (name, email, phone, employer, role), session tokens, recovery questions, IP and device data linked to a user, photos.
- Handling: full Tier 2 controls plus MFA for any role with bulk read access; encryption at rest with KMS-managed keys; redacted in logs; no use in non-production.

### Tier 4 — Protected Health Information (PHI)

Special-category health data under HIPAA and GDPR. The most sensitive tier. Donor information is out of scope for this platform; units arrive already screened and labeled by upstream collection organizations and are tracked only by their unit-level identifiers.

- **Recipient PHI** — patient identifiers, hospital/ward, indication for transfusion, ABO/Rh, cross-match, transfusion outcomes, adverse-event reports.
- **Unit-level chain-of-custody** records when linked to a recipient.
- Handling: all Tier 3 controls plus tenant-scoped access enforced server-side; per-action audit (read and write); MFA + step-up auth for bulk export or full-record view; field-level encryption or tokenization for the most sensitive fields; never present in logs, error responses, analytics events, screenshots, support tickets, or non-production environments.

### Tier 5 — Secrets and Cryptographic Material

Anything that grants access or authority.

- Examples: database connection strings, OIDC client secrets, supplier API keys and mTLS private keys, webhook signing keys, KMS keys, `SESSION_SECRET`, signed-URL signing material, sensor device certificates.
- Handling: stored only in the platform secret store / KMS; never in source, env files committed to git, build artifacts, error messages, or logs; rotated on schedule and on personnel/supplier change; access requires MFA and is audited.

---

## 2. Field-Level Classification (Reference)

This table is illustrative and must be kept in sync with the database schema. The data-protection officer signs off on each new field.

Rows are sorted by tier, highest first. For rows whose classification depends on context (e.g., joined with recipient data), the worst-case tier is used for sorting.

| Domain | Field / Object | Tier |
|---|---|---|
| Identity | `session.token`, `session.refreshToken` | T5 |
| Identity | `mfaSecret`, `recoveryCodes` | T5 |
| Supplier | `supplier.apiCredential`, `supplier.mtlsKey`, `supplier.webhookSecret` | T5 |
| Recipient | `patient.mrn`, `patient.name`, `patient.dob`, `patient.tenantId`, `patient.ward` | T4 |
| Recipient | `transfusion.indication`, `transfusion.outcome`, `transfusion.adverseEvent` | T4 |
| Allocation | `allocation.inputs`, `allocation.modelVersion`, `allocation.recommendation`, `allocation.override` | T4 |
| Audit | `audit.actor`, `audit.action`, `audit.target`, `audit.before`, `audit.after`, `audit.timestamp`, `audit.signature` | T3, integrity-protected; entries about T4 records inherit T4 sensitivity for read |
| Unit | `unit.din` (ISBT 128) | T3 in isolation; T4 when linked to a recipient |
| Unit | `unit.aboRh`, `unit.componentType`, `unit.collectionAt`, `unit.expiresAt`, `unit.status` | T2 in isolation; T4 when linked |
| Cold chain | `telemetry.unitId`, `telemetry.temperatureC`, `telemetry.timestamp`, `telemetry.deviceId`, `telemetry.signature` | T2; T4 when joined with a recipient |
| Logistics | `courier.driverId`, `courier.vehicleId`, `route.plan` | T2; T4 when payload includes recipient identifiers |
| Identity | `user.id`, `user.email`, `user.fullName`, `user.role`, `user.tenantId` | T3 |
| Supplier | `supplier.id`, `supplier.contacts`, `supplier.contract`, `supplier.pricing`, `supplier.routes` | T2 |
| Telemetry of platform | request logs (path, status, duration), traces | T1; redact any user/patient identifiers before persistence |

---

## 3. Identification, Pseudonymization, and Tokenization

- **Patient identifiers** outside the clinical context (e.g., logistics, supplier feeds, analytics) MUST be replaced with platform-issued opaque tokens. Re-identification keys live in a separate, restricted store.
- **Unit DIN (ISBT 128)** is required for traceability and can be shared with authorized supply-chain participants, but joins to recipient context MUST happen only inside the clinical zone.
- **Internal primary keys** SHOULD be opaque (UUID/ULID), not sequential, to limit enumeration risk.
- **Object identifiers in URLs** MUST be opaque; even with opaque IDs, server-side authorization is mandatory (no IDOR).

---

## 4. Storage

### 4.1 At rest

| Tier | Storage requirement |
|---|---|
| T0 / T1 | Standard storage; integrity protections only. |
| T2 | Encryption at rest (AES-256) with KMS-managed keys; key access audited. |
| T3 | T2 + per-tenant or per-region key separation where required by residency. |
| T4 | T3 + field-level encryption or tokenization for the most sensitive identifiers; per-tenant DB schemas or row-level security; storage location restricted to approved jurisdictions. |
| T5 | Stored only in the platform secret store / KMS / HSM-backed key vault; never in application databases, config files, env files committed to git, or logs. |

### 4.2 Backups, snapshots, exports

- Inherit the highest classification of the data they contain.
- Encrypted with the same standards as live data.
- Restore-tested at least quarterly.
- Retained per the schedule in §8 and destroyed per §9.

### 4.3 Object storage (consent forms, screening PDFs, labels, documents)

- Buckets are private by default. Public buckets are forbidden for any data above T1.
- Access mediated by the API. Direct client access to T3+ objects MUST use short-lived, scoped, signed URLs.
- Server-side encryption MUST be enabled. Customer-managed keys for T4.
- Bucket access is logged; suspicious patterns alert security.

### 4.4 Caches and queues

- Caches and message queues that hold T3+ data MUST be encrypted at rest, access-controlled, and have explicit, short TTLs.
- T4 data SHOULD NOT be cached unless strictly necessary; if cached, the cache MUST be tenant-scoped and encrypted, with eviction on access revocation.

---

## 5. Transmission

- TLS 1.2+ for all external connections; HSTS on user-facing endpoints.
- Internal service-to-service traffic MUST be encrypted (TLS or mesh-level).
- Mutual TLS for supplier and partner system-to-system calls.
- Webhooks (inbound and outbound) MUST be signed (HMAC or asymmetric) with key rotation, replay protection (nonce + timestamp window), and signature verification on every call.
- IoT/sensor messages SHOULD be signed at the device when feasible. Unsigned messages MUST NOT update releasable-status flags.
- Email, SMS, and other channels MUST NOT carry T3+ data unless secured (e.g., direct-to-portal links instead of attachments).
- Out-of-band channels (chat, ticketing, screen-sharing) MUST NOT carry T4 data; redact before sharing.

---

## 6. Access Control

### 6.1 Roles (minimum set)

- **Clinical Viewer** — read scoped clinical data within their facility.
- **Clinical Actor** — request units, record receipt, document transfusion outcomes.
- **Releaser** — release units to a recipient; requires MFA + step-up.
- **Logistics Coordinator** — pickup/dropoff and courier dispatch; receives minimized data only.
- **Supplier (external)** — submits inventory, fulfills orders; isolated API surface.
- **Compliance / Auditor** — read-only across audit logs and regulated entities; every read audited.
- **Platform Admin** — configuration, role assignment; cannot read T4 by default; break-glass only.
- **Break-Glass Operator** — time-boxed, approved, audited access for incident response.

### 6.2 Principles

- **Server-side enforcement.** Authorization is enforced on every API request; the frontend MUST NOT be the boundary.
- **Tenant scoping.** Every T3+ query is scoped by `tenantId` (and facility where relevant) at the data layer, not just the application layer.
- **Object-level authorization.** Even with a valid session, access to a specific entity (unit, patient, telemetry stream) is checked per object.
- **Least privilege & need-to-know.** Defaults grant the minimum required; broader access is explicitly granted, time-boxed where possible, and audited.
- **MFA.** Required for any role that can read T4 in bulk, release units, override holds, change configuration, or administer the platform.
- **Step-up auth.** Required at the moment of release, override, bulk export, or break-glass — independent of the active session.
- **Segregation of duties.** The same identity cannot both release and audit. Production deploy and security-sensitive configuration changes require dual approval.
- **Joiner / Mover / Leaver.** Access is provisioned, modified, and revoked within one business day of an HR event; supplier credentials are rotated on supplier-side personnel change.

### 6.3 Operator access to customer data

- Platform staff MUST NOT be able to read tenant T4 data by default.
- Break-glass access requires a documented reason, time-boxing, customer notification per contract, and an audit entry visible to the customer's compliance role.

---

## 7. Logging, Monitoring, and Auditing

- **Application logs (T1).** Structured, redacted, no T3+ identifiers. Use field allow-lists, not deny-lists.
- **Security event logs (T3).** Authentication, MFA, step-up, privilege use, configuration changes — captured with actor, source, target, timestamp, correlation ID.
- **Regulated audit log (T4 for read; integrity-protected).** Every action on a regulated entity: actor identity and role, tenant, action, target entity ID and version, before/after for changes, timestamp from a synchronized source, request correlation ID.
- **Append-only & integrity-protected.** Audit records are append-only. Integrity is protected by hash-chaining or a signed external archive. Standard administrators MUST NOT be able to delete or edit audit records.
- **Time sync.** All hosts use NTP from trusted sources. Drift beyond a threshold raises an alert.
- **Retention.** Per §8.
- **Monitoring.** Alerts on: repeated auth failures, MFA bypass attempts, privilege use spikes, bulk export, unusual data access patterns, supplier feed schema failures, sensor signature failures, cold-chain anomalies.
- **What MUST NOT be logged.** Passwords, MFA codes, session tokens, API keys, signing keys, full DINs joined to patient identifiers, free-text PHI fields, full request bodies for endpoints carrying T4.

---

## 8. Retention

Retention is set to the longest applicable regulatory minimum. Retention exceptions (legal hold, ongoing investigation, adverse-event review) override deletion schedules.

| Data type | Minimum retention | Notes |
|---|---|---|
| Unit chain-of-custody and release | 10 years after expiration / disposition, or longer per local rule | Required for traceability of transfusion-transmitted infection investigations. Common AABB / FDA expectation. |
| Transfusion / recipient outcome records | Per local medical-records law (often 10–25 years; pediatric records longer) | Hospitals may set their own longer minimums. |
| Cold-chain telemetry tied to a unit | Same as the unit's chain-of-custody | Telemetry is part of the release decision and must be reproducible. |
| Adverse-event and recall records | Permanent or per regulator | Treat as permanent unless explicitly authorized for purge. |
| Authentication and access audit | 1 year hot, 6 years cold (HIPAA security-rule expectation) | Hot retention sized for investigations. |
| Application logs (T1) | 30–90 days | Short by design; redacted. |
| Backups | Per-tier; aligned to the longest retention of contained data | Encrypted; restore-tested. |
| Non-production data | None — synthetic only | Real T3+ data is forbidden in non-prod. |

GDPR right-to-erasure requests on T4 records covered by mandatory retention are handled via documented exception (legal obligation lawful basis), with restricted-processing flags applied where erasure is not legally possible.

---

## 9. Destruction

- **Digital data.** Cryptographic erasure (key destruction) for KMS-encrypted data; secure deletion APIs for object storage; documented evidence of deletion retained in audit log.
- **Backups.** Destroyed per the same schedule; no orphan backups containing T3+ data.
- **Hardware.** Disposed via certified shredding/wiping when applicable.
- **Suppliers and processors.** Contractual obligation to return or destroy platform data on contract termination, with attestation.

---

## 10. Non-Production Environments

- **No real T3+ data.** Staging, dev, QA, training, and demo MUST use synthetic or fully de-identified data. Loading a production export into non-prod is prohibited.
- **Separate credentials and keys.** Non-prod has its own IdP tenant, KMS keys, secret store entries, and supplier sandbox credentials.
- **Network isolation.** Non-prod cannot reach production data stores, secret stores, or production-only suppliers.
- **Access.** Engineering may access non-prod broadly; production access follows §6.

---

## 11. Third-Party / External Sourcing

- **Onboarding gate.** Suppliers and processors that touch T2+ data sign a contract; those that touch T3+ also sign a HIPAA Business Associate Agreement (or equivalent), provide a current SOC 2 Type II or ISO 27001 report, and complete a security questionnaire (SIG, CAIQ).
- **Tiering.** Vendors are tiered by the highest-tier data they handle; tier dictates required controls, monitoring, and review cadence.
- **Data minimization outbound.** Only the data needed for the task is shared. Couriers do not receive patient names or diagnoses; analytics processors receive de-identified or tokenized data; suppliers receive only their own scope.
- **Cross-border.** Data residency is honored per jurisdiction. Cross-border transfer of T3+ requires a documented transfer mechanism (SCCs, adequacy decision, BAA-equivalent).
- **Sanctions and integrity screening.** Suppliers are screened against sanctions lists and provenance-verified at onboarding and periodically thereafter.
- **Continuous review.** Annual reassessment; immediate review on incident, ownership change, or material change in service.
- **Termination.** On exit, credentials are revoked within 24 hours, data is returned or destroyed per §9, and an attestation is collected.

---

## 12. Personnel

- **Background checks** appropriate to role and jurisdiction before access to T3+.
- **Confidentiality and acceptable-use** acknowledgements on hire and annually.
- **Annual security training** with role-specific modules (clinical-data handling, secure development, incident response).
- **Onboarding / offboarding** runbook executed within one business day of HR event; offboarding includes credential revocation, MFA-token deactivation, device wipe, and audit review.
- **Device hygiene.** Endpoints used for T3+ access MUST be MDM-managed, full-disk encrypted, with screen lock, anti-malware, and remote wipe. Personal devices are restricted to read-only, browser-based access where allowed.

---

## 13. Incident Response and Breach Notification

- A documented IR plan exists and is rehearsed at least annually.
- Suspected exposure of T3+ triggers immediate triage; T4 exposure triggers the breach-assessment workflow.
- HIPAA breach notification within 60 days of discovery; GDPR notification within 72 hours where applicable; customer-contractual timelines may be tighter.
- Post-incident: root cause, corrective and preventive actions, threat-model update.

---

## 14. Roles and Responsibilities

- **Data Protection Officer (DPO) / Privacy Lead** — owns this policy, classifications, and DPIAs.
- **Security Lead** — owns controls, monitoring, IR, and vendor security review.
- **Engineering Leads** — implement and verify controls in code; own redaction layers, schema-level enforcement, and audit emission.
- **Compliance / Quality** — owns regulatory mapping (HIPAA, FDA Part 11/606/1271, AABB, GDPR, GDP), retention, and audit support.
- **All staff** — classify data correctly, follow handling rules, report incidents.

---

## 15. Exceptions

Exceptions to this policy are time-bound, documented, risk-assessed, and approved by the DPO and Security Lead. Exceptions are reviewed at expiry and not renewed by default.
