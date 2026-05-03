
# Hospital++ - From Inventory to Readiness: Explainable Medical Logistics Decision Support

Hospital++ is an interpretable, operations-focused decision support platform built to help planners understand **where** a medical logistics network is fragile, **why** a node is at risk, and **what** mitigation actions should happen before mission impact.  
The system combines a full-stack hub-and-spoke application (FastAPI + React), event-driven messaging (NATS), and explainable ML components (EBM and related pipelines) to translate complex logistics data into clear, actionable risk insights.

It is designed for transparency, operational realism, and rapid decision support in constrained, distributed medical supply environments.

---
## Team Members

- Aquamarine
- Steven Broskey
- Maryam Shahbaz Ali
- William Crum
---


## Key Features

### Full-stack decision support platform
- Interactive React dashboard for network, inventory, and analytics views
- FastAPI backend with structured `/api/v1` endpoints
- PostgreSQL data layer for persistent operational state

### Explainable predictive risk layer
- EBM-backed risk scoring via backend ML services
- Feature-level explainability workflows for transparent predictions
- Configurable model artifact loading (`EBM_MODEL_PATH`)

### Hub-and-spoke operational modeling
- Tracks risk across hubs, spokes, and supply routes
- Highlights bottlenecks and probable first-fail nodes
- Supports route-aware and node-aware readiness analysis

### Data ingestion and analytics APIs
- Handles ingestion workflows for operational supply data
- Provides analytics endpoints for planning and dashboarding
- Includes sample data assets for rapid prototyping

### Event-driven architecture
- NATS integration for real-time/event-driven patterns
- Websocket support for live updates in the UI
- Service-level health endpoint for runtime monitoring

### Containerized deployment
- Docker Compose orchestration for one-command local spin-up
- Bundles core services: frontend, backend, Postgres, NATS
- Optional seed profile for initial database population

---

## Repository Structure

```bash
.
├── app/
│   ├── backend/                        # FastAPI backend (APIs, services, ML integration)
│   │   ├── main.py                     # Application entrypoint
│   │   ├── requirements.txt            # Backend dependencies
│   │   ├── seed.py                     # Optional database seeding
│   │   ├── models/                     # SQLAlchemy models and schemas
│   │   ├── routers/                    # API routes (hubs, spokes, inventory, analytics)
│   │   └── services/                   # Ingestion, EBM, ML interface, NATS, chat
│   └── frontend/                       # React + TypeScript frontend
│       ├── src/
│       │   ├── pages/                  # Dashboard, MapView, Inventory, Explainability
│       │   ├── components/             # Reusable UI components
│       │   ├── hooks/                  # WebSocket, charts, utilities
│       │   ├── contexts/               # Global state/context
│       │   └── lib/                    # API clients and helpers
│       ├── package.json
│       └── Dockerfile
│
├── ml/                                 # ML pipeline scaffolding
│   ├── config/model_config.yaml
│   ├── training/
│   ├── serving/
│   └── data_pipeline/
│
├── ml_models/                          # EBM + experimental ML modules
│   ├── app.py                          # Streamlit experimentation UI
│   ├── ebm_model.py
│   ├── train_ebm_pkl.py
│   ├── advanced_ml.py
│   ├── data.py
│   ├── model.py
│   └── requirements.txt
│
├── data/                               # Sample datasets
│   ├── Medical_Supply_Inventory.csv
│   └── MedSupply_Data_Tables.xlsx
│
├── notebooks/                          # Exploratory analysis
├── docker-compose.yaml                 # Multi-service deployment
├── problem.md                          # Problem framing
├── logo.png
└── README.md
```

---

## Getting Started

### Prerequisites

* Docker + Docker Compose
* (Optional) Python 3.10+ and Node.js 18+ for local development

### Quick Start (Recommended)

Run the full system using Docker:

```bash
docker compose up --build
```

This will spin up:

* Backend (FastAPI)
* Frontend (React)
* PostgreSQL database
* NATS messaging system

---

## Access Points

* Frontend UI: http://localhost:3000
* Backend API: http://localhost:8000
* Health Check: http://localhost:8000/healthz

---

## Operational Use Case

Hospital++ is designed for high-risk, distributed medical logistics environments where:

* A central hub is constrained by demand, transport delays, or cold-chain limitations
* Spoke nodes depend on timely resupply
* Supply perishability introduces time-sensitive risk
* Disruptions can cascade across the network

The platform provides **early warning signals and explainable insights** so decision-makers can act before failure occurs.

---

## Acknowledgments

We acknowledge the mentors, judges, and domain experts who guided this project’s focus on:

* Operational realism
* Interpretable machine learning
* Decision-centered user experience

---

## Project Status

Hackathon prototype under active development.

* Core APIs and frontend implemented
* EBM-based risk modeling integrated (baseline)
* Explainability workflows in progress
* APIs, UI, and ML components are evolving as the system matures

---
