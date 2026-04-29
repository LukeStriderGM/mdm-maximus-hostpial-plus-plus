# NIST 800-53 Security Controls — Hospital++

## Access Control (AC)
| Control | Description | Status | Implementation |
|---------|-------------|--------|----------------|
| AC-2 | Account Management | Planned | Keycloak user lifecycle management |
| AC-3 | Access Enforcement | Implemented | RBAC middleware in FastAPI, role-based route guards |
| AC-6 | Least Privilege | Implemented | Role-scoped API access, NATS per-subject auth |
| AC-17 | Remote Access | Implemented | TLS termination, JWT validation on all endpoints |

## Audit and Accountability (AU)
| Control | Description | Status | Implementation |
|---------|-------------|--------|----------------|
| AU-2 | Audit Events | Implemented | All CRUD operations, data ingestion, auth events logged |
| AU-3 | Content of Audit Records | Implemented | Structured JSON: timestamp, user, action, resource, result |
| AU-6 | Audit Review | Planned | Loki/Grafana dashboards in Zarf deployment |
| AU-9 | Protection of Audit Info | Planned | Append-only log storage, separate namespace |
| AU-12 | Audit Generation | Partial | Application logs + Kubernetes audit logs |

## Configuration Management (CM)
| Control | Description | Status | Implementation |
|---------|-------------|--------|----------------|
| CM-2 | Baseline Configuration | Implemented | Zarf package defines exact system baseline |
| CM-6 | Configuration Settings | Implemented | STIG'd containers, Pod Security Standards restricted |
| CM-7 | Least Functionality | Implemented | Minimal container images, all capabilities dropped |

## Identification and Authentication (IA)
| Control | Description | Status | Implementation |
|---------|-------------|--------|----------------|
| IA-2 | Identification/Auth | Partial | JWT validation implemented; Keycloak OIDC planned |
| IA-5 | Authenticator Management | Planned | Certificate lifecycle, CRL management for CAC/PKI |

## System and Communications Protection (SC)
| Control | Description | Status | Implementation |
|---------|-------------|--------|----------------|
| SC-8 | Transmission Confidentiality | Implemented | TLS 1.2+ for all external connections |
| SC-13 | Cryptographic Protection | Planned | FIPS 140-2 validated modules target |
| SC-28 | Protection at Rest | Planned | PostgreSQL encryption, LUKS volume encryption |

## System and Information Integrity (SI)
| Control | Description | Status | Implementation |
|---------|-------------|--------|----------------|
| SI-2 | Flaw Remediation | Planned | CVE scanning pipeline (Grype/Trivy) |
| SI-3 | Malicious Code Protection | Planned | ClamAV for ingested files |
| SI-4 | System Monitoring | Planned | Prometheus/Grafana in Zarf |
| SI-7 | Software Integrity | Planned | Cosign image signing, SLSA provenance |
| SI-10 | Input Validation | Implemented | CSV/Excel sanitization, Pydantic schema validation |
