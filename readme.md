# Hospital++: Predictive Medical Logistics Decision Support

## Team Members

- Aquamarine
- Steven Broskey
- Maryam Shahbaz Ali
- William Crum

Hospital++ is a prototype that predicts medical supply risk in a hub-and-spoke network, focused on blood and blood-support logistics for distributed operations.

## Why This Exists
In contested logistics, a constrained hub can quickly cause spoke failures.  
Hospital++ helps planners and operators see risk early and act before mission impact.

## Key Capabilities
- Hub-and-spoke risk visualization
- Inventory and demand analytics
- EBM/ML-based risk prediction
- Explainability view for model outputs
- Data ingestion workflow
- API + frontend decision support views

## Tech Stack
- Frontend: React + TypeScript + Vite
- Backend: FastAPI (Python)
- ML: Python pipelines and model-serving modules
- Orchestration: Docker Compose

## Repository Structure
- `app/frontend` - React UI
- `app/backend` - FastAPI app, routers, and services
- `ml` - training and serving modules
- `ml_models` - additional model scripts and experiments
- `data` - sample datasets
- `notebooks` - exploratory and prototyping notebooks

## Quick Start

### Prerequisites
- Docker + Docker Compose
- Optional for local dev: Python 3.10+ and Node 18+

### Run with Docker
```bash
docker compose up --build
