# Hospital++ Security Architecture

## System Description
Medical logistics decision support for USMC/DHA. Hub-and-spoke blood product and supply management deployed via Zarf to air-gapped Kubernetes.

## Data Classification
**CUI (Controlled Unclassified Information)** — MTF inventory data reveals operational medical readiness posture.

## Architecture
- **Backend**: FastAPI (Python) with JWT auth middleware
- **Frontend**: React SPA served by nginx
- **Database**: PostgreSQL with parameterized queries (SQLAlchemy ORM)
- **Messaging**: NATS JetStream with TLS and NKeys authentication
- **Deployment**: Zarf air-gapped Kubernetes with Pod Security Standards (restricted)

## Authentication & Authorization
- **Current**: JWT validation middleware (hackathon baseline)
- **Target**: Keycloak OIDC with CAC/PKI integration
- **RBAC Roles**: commander (read-all), hub-admin (hub CRUD), spoke-operator (spoke CRUD), auditor (read-only)
- **ABAC**: MTF-scoped data access (spoke operators see only their MTF)

## Encryption
- **In Transit**: TLS 1.2+ (target: Istio mTLS STRICT in Zarf)
- **At Rest**: PostgreSQL encryption, Kubernetes encrypted volumes, NATS JetStream encryption
- **Target**: FIPS 140-2 validated cryptographic modules

## Key Security Controls
See `security-controls.md` for full NIST 800-53 mapping.
See `threat-model.md` for attack surface analysis.
See `container-security.md` for deployment hardening.
