# Threat Model — Hospital++

## Data Flow
```
User → [Browser] → Frontend (nginx) → Backend (FastAPI) → PostgreSQL
                                                        → NATS JetStream
                                    ← WebSocket ← NATS events
```

## Attack Surfaces

### 1. CSV/Excel Ingestion (HIGH RISK)
- **Formula injection**: Cells starting with `=+@-` could execute if re-exported to Excel
- **XXE in XLSX**: XLSX is XML inside ZIP; malicious XML entities could read files
- **Zip bombs**: Crafted XLSX files that expand massively
- **Mitigation**: Input sanitization (strip injection chars), openpyxl (XXE-safe by default), 50MB file size limit, cell count limits

### 2. API Endpoints (MEDIUM)
- **SQL injection**: Mitigated by SQLAlchemy ORM (parameterized queries)
- **IDOR**: Accessing other MTF's data via manipulated node IDs
- **Mass assignment**: Pydantic schemas restrict accepted fields
- **Mitigation**: RBAC middleware, MTF-scoped access, input validation via Pydantic

### 3. NATS Messaging (MEDIUM)
- **Unauthorized publish/subscribe**: Rogue client publishes fake inventory events
- **Message replay**: Replaying old events to manipulate state
- **Mitigation**: NKeys authentication, per-subject authorization, TLS encryption

### 4. WebSocket (LOW)
- **Connection flooding**: DoS via mass WebSocket connections
- **XSS via event data**: Malicious data in NATS events rendered in frontend
- **Mitigation**: Connection rate limiting, output encoding in React (default XSS protection)

### 5. Container/K8s (LOW in air-gap)
- **Image supply chain**: Compromised base images
- **Privilege escalation**: Container breakout
- **Mitigation**: Iron Bank images, Pod Security Standards (restricted), drop all capabilities, read-only root FS

## Threat Actors
| Actor | Likelihood | Impact | Priority |
|-------|-----------|--------|----------|
| Insider (compromised spoke operator) | Medium | High | Critical |
| External attacker (network access) | Low (air-gap) | High | Medium |
| Supply chain (compromised dependency) | Low | Critical | Medium |
