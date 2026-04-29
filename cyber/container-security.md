# Container and Deployment Security — Hospital++

## Base Images
- **Target**: Iron Bank images from `registry1.dso.mil`
- **Current**: `python:3.12-slim` (backend), `node:20-alpine` + `nginx:alpine` (frontend)
- **Migration**: Replace with Iron Bank equivalents for ATO

## Pod Security Standards
All pods enforce **restricted** PSS level:
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
  seccompProfile:
    type: RuntimeDefault
```

## Image Scanning
- **Tool**: Grype or Trivy in CI pipeline
- **Policy**: Zero critical CVEs before merge
- **Frequency**: On every build + weekly scheduled scans

## SBOM Generation
- **Tool**: Syft (SPDX format)
- **Zarf**: Automatic SBOM generation for all packaged images
- **Storage**: SBOM artifacts alongside Zarf package for ATO evidence

## Image Signing
- **Tool**: Cosign (Sigstore)
- **Verification**: Kyverno admission controller rejects unsigned images
- **Key Management**: Cosign keys stored in Kubernetes sealed-secrets

## Supply Chain (SLSA)
- **Target**: SLSA Level 2
- **Build**: Version-controlled build process via GitHub Actions
- **Provenance**: SLSA provenance attestation generated in CI

## Kubernetes STIG Findings
| Finding | Description | Status |
|---------|-------------|--------|
| V-242381 | API server audit logging | Configured in Zarf |
| V-242383 | etcd encryption at rest | Planned |
| V-242414 | Pod Security Standards enforced | Implemented (restricted) |
| V-242415 | Namespace isolation | Implemented (hospital-pp namespace) |

## Network Policies
Default deny-all ingress/egress with explicit allows:
- frontend → backend (8000)
- backend → postgres (5432)
- backend → nats (4222)
- All pods → DNS (53)
