# Executive Summary — Critical Compliance Standards
## [SYSTEM NAME] — USMC Web Application

The system is built and operated under the DoD and Marine Corps cybersecurity regime. The standards below are the load-bearing few — they drive authorization, control selection, cryptography, identity, incident reporting, and Marine Corps-specific governance. Everything else in the full compliance inventory derives from or supports these.

---

## The Critical Standards

- **DoDI 8510.01 — Risk Management Framework (RMF) for DoD Systems**
  Governs the entire authorization lifecycle. Without successful execution of RMF the system cannot receive an Authorization to Operate (ATO).

- **NIST SP 800-37 and NIST SP 800-53 — RMF process and security control catalog**
  Define the process and the actual control set (access control, audit, crypto, incident response, etc.) the system must implement and assess.

- **FIPS 199 — Security Categorization**
  Determines the system's Low / Moderate / High impact level, which in turn drives every other control selection.

- **DoDI 8500.01 — DoD Cybersecurity**
  The umbrella DoD cybersecurity policy that this system, its users, and its operators must follow.

- **MCO 5239.2B — Marine Corps Cybersecurity Program**
  Marine Corps-specific authority. Establishes USMC governance, including the role of MARFORCYBER / MCCOG and the ECSM series.

- **USMC ECSM 021 (RMF), ECSM 026 (Vulnerability Management), and ECSM 028 (Incident Response)**
  The Marine Corps' implementation guidance the system is graded against by USMC inspectors and the AO.

- **DISA STIGs and Security Requirements Guides**
  Mandatory hardening baselines for the operating system, web server, database, container runtime, and orchestration platform. Non-compliance must be tracked in a POA&M.

- **FIPS 140-2 / 140-3 — Cryptographic Module Validation**
  All cryptography (TLS, at-rest encryption, key management) must use validated modules. This is non-negotiable for any DoD system.

- **DoDI 8520.03 — Identity Authentication**
  Mandates DoD PKI / CAC authentication. Username-and-password authentication alone is prohibited.

- **DoD Cloud Computing Security Requirements Guide (SRG) — Impact Levels IL2 / IL4 / IL5 / IL6**
  If hosted in the cloud, the system must run in an offering accredited to its required Impact Level. This single decision drives hosting choices, data handling, and connectivity.

- **CJCSM 6510.01B — Cyber Incident Handling**
  Defines mandatory incident reporting timelines and chain-of-reporting up to USCYBERCOM. One-hour reporting requirement to the supporting CSSP flows from this.

- **NIST SP 800-218 — Secure Software Development Framework (SSDF)**
  Required by EO 14028. Establishes the secure DevSecOps practices (threat modeling, SAST/DAST/SCA, signed artifacts, SBOM) the build pipeline must enforce.

- **DoDI 5200.48 and 32 CFR Part 2002 — Controlled Unclassified Information (CUI)**
  Required if the system processes CUI. Drives marking, handling, transmission, and storage requirements.

- **Privacy Act of 1974 and DoDI 5400.11 — Privacy**
  Required if the system collects PII. Drives the Privacy Impact Assessment (PIA) and any System of Records Notice (SORN).

---

## Bottom Line

**RMF (8510.01 + 800-37 + 800-53) gets the ATO. Marine Corps policy (MCO 5239.2B + ECSM series) makes it acceptable to USMC. STIGs, FIPS 140, and PKI make it technically defensible. Cloud SRG, CUI, and Privacy Act apply when the data and hosting model demand them. CJCSM 6510.01B governs what happens when something goes wrong.**

These are the standards an executive should be able to name when asked why the system is safe to operate in support of the Marine Corps.
