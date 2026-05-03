
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

## Repository Layout

```text
.
├── app/
│   ├── backend/                        # FastAPI backend
│   │   ├── main.py                     # App entrypoint + router registration
│   │   ├── requirements.txt            # Backend dependencies
│   │   ├── seed.py                     # Optional DB seed script
│   │   ├── models/                     # SQLAlchemy models + schemas + DB setup
│   │   ├── routers/                    # API routes (hubs, spokes, inventory, etc.)
│   │   └── services/                   # Ingestion, ML interface, EBM, chat, NATS
│   └── frontend/                       # React + Vite + TypeScript frontend
│       ├── src/
│       │   ├── pages/                  # Dashboard, MapView, Inventory, Explainability...
│       │   ├── components/             # UI and layout components
│       │   ├── hooks/                  # websocket/chart/debounce hooks
│       │   ├── contexts/               # Shared app context
│       │   └── lib/                    # API client utilities
│       ├── package.json
│       └── Dockerfile
│
├── ml/                                 # ML integration scaffolding and configs
│   ├── README.md
│   ├── config/model_config.yaml
│   ├── training/
│   ├── serving/
│   └── data_pipeline/
│
├── ml_models/                          # EBM/ML experimentation + artifacts tooling
│   ├── README.md
│   ├── app.py                          # Streamlit app
│   ├── ebm_model.py
│   ├── train_ebm_pkl.py
│   ├── advanced_ml.py
│   ├── data.py
│   ├── model.py
│   └── requirements.txt
│
├── data/                               # Sample/source datasets
│   ├── Medical_Supply_Inventory.csv
│   └── MedSupply_Data_Tables.xlsx
│
├── notebooks/                          # Analysis and prototype notebooks
├── docker-compose.yaml                 # Multi-service local deployment
├── problem.md                          # Problem framing and operational context
├── logo.png
└── readme.md

- Optional for local dev: Python 3.10+ and Node 18+

### Run with Docker
```bash
docker compose up --build

## Getting Started
Prerequisites
Docker + Docker Compose
(Optional for local non-Docker dev) Python 3.10+ and Node.js 18+
Quick Start (Recommended)
Build and start all services:
docker compose up --build

Operational Use Case
Hospital++ is built for scenarios where:

A central medical hub is constrained by demand, transport, or cold-chain limits
Spoke nodes depend on timely replenishment
Supply perishability and route disruption create cascading risk
Decision-makers need actionable, explainable readiness signals

### Acknowledgments
We acknowledge the mentors, judges, and operators who shaped this project’s focus on:

practical logistics realism
interpretable model behavior
decision-centered UX for high-stakes planning
Project Status
Hackathon prototype under active development.
APIs, UI behavior, and model interfaces may evolve as the platform matures.


