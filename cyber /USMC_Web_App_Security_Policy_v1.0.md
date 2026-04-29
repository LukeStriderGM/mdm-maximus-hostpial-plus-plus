# System Security Policy
## [SYSTEM NAME] — United States Marine Corps Web Application

| Field | Value |
|---|---|
| Document Title | System Security Policy for [SYSTEM NAME] |
| Document Version | 1.0 |
| Effective Date | [YYYY-MM-DD] |
| Next Review Date | [YYYY-MM-DD] (annual, or upon major change) |
| Document Owner | Information System Security Manager (ISSM), [PROGRAM / COMMAND] |
| Approval Authority | Authorizing Official (AO), [USMC AO ORG] |
| Distribution | Distribution Statement [A / C / D / F] — [Justification] |
| Classification | UNCLASSIFIED // [CUI category if applicable] |

---

## 1. Purpose

This System Security Policy (SSP) establishes the cybersecurity requirements, roles, responsibilities, and controls governing the design, development, deployment, operation, and disposal of **[SYSTEM NAME]** ("the System"), a web application operated in support of the United States Marine Corps. It is the authoritative cybersecurity document for the System and is binding on all developers, administrators, operators, and users.

The policy ensures the System:

- Protects the confidentiality, integrity, and availability (CIA) of all information processed, stored, or transmitted.
- Complies with all applicable Department of Defense (DoD), Department of the Navy (DON), and United States Marine Corps (USMC) cybersecurity directives.
- Operates within an Authorization to Operate (ATO) granted under the DoD Risk Management Framework (RMF).
- Maintains continuous monitoring and incident response capabilities consistent with DoD Cybersecurity Service Provider (CSSP) requirements.

## 2. Scope

This policy applies to:

- All hardware, software, firmware, and network components comprising the System, including front-end web tier, application tier, database tier, supporting services, build pipelines, and administrative tooling.
- All government personnel, military members, contractors, and subcontractors who design, develop, test, deploy, administer, audit, or use the System.
- All environments associated with the System, including development, test, staging, pre-production, production, disaster recovery, and decommissioning.
- All data created, ingested, processed, transmitted, displayed, or stored by the System, including Controlled Unclassified Information (CUI) when applicable.

This policy does **not** authorize the processing of classified information unless and until a separate accreditation is granted under the appropriate classified system process.

## 3. References and Authorities

The System shall be developed, deployed, and operated in accordance with the most current versions of the following:

### 3.1 Federal and DoD

- **FISMA** — Federal Information Security Modernization Act of 2014.
- **OMB Circular A-130** — Managing Information as a Strategic Resource.
- **NIST SP 800-37** — Risk Management Framework for Information Systems and Organizations.
- **NIST SP 800-53** — Security and Privacy Controls for Information Systems and Organizations.
- **NIST SP 800-53A** — Assessing Security and Privacy Controls.
- **NIST SP 800-171 / 800-172** — Protecting CUI in Nonfederal Systems (where contractor-hosted).
- **NIST SP 800-61** — Computer Security Incident Handling Guide.
- **NIST SP 800-63** — Digital Identity Guidelines.
- **NIST SP 800-218** — Secure Software Development Framework (SSDF).
- **CNSSI 1253** — Security Categorization and Control Selection for National Security Systems.
- **DoDI 8500.01** — Cybersecurity.
- **DoDI 8510.01** — Risk Management Framework (RMF) for DoD Systems.
- **DoDI 8520.03** — Identity Authentication for Information Systems.
- **DoDI 8530.01** — Cybersecurity Activities Support to DoD Information Network Operations.
- **DoDI 8551.01** — Ports, Protocols, and Services Management (PPSM).
- **DoDI 8582.01** — Security of Non-DoD Information Systems Processing Unclassified Nonpublic DoD Information.
- **DoD CIO Cloud Computing Security Requirements Guide (SRG)**, current version.
- **DISA Security Technical Implementation Guides (STIGs)** applicable to the operating systems, web servers, application frameworks, databases, and container platforms in use.

### 3.2 Department of the Navy and Marine Corps

- **SECNAVINST 5239.3** — Department of the Navy Cybersecurity Policy.
- **SECNAV M-5239.2** — DON Cyberspace IT and Cybersecurity Workforce Management.
- **MCO 5239.2B** — Marine Corps Cybersecurity Program.
- **Marine Corps Enterprise Cybersecurity Manual (ECSM)** series, including:
  - ECSM 005 — Cybersecurity Workforce.
  - ECSM 018 — Cybersecurity Inspection and Assessment Program.
  - ECSM 021 — Risk Management Framework.
  - ECSM 026 — Vulnerability Management.
  - ECSM 028 — Incident Response.
- **MARFORCYBER / MCCOG** operational directives applicable to the Marine Corps Enterprise Network (MCEN).
- Applicable **Operational Directive Messages (ODMs)** and **Cyber Tasking Orders (CTOs)** issued by USCYBERCOM and MARFORCYBER.

### 3.3 Privacy

- Privacy Act of 1974, as amended.
- DoDI 5400.11 — DoD Privacy and Civil Liberties Programs.
- SECNAVINST 5211.5 — DON Privacy Program.
- A Privacy Impact Assessment (PIA) and, if PII is collected, a System of Records Notice (SORN) shall be completed and maintained.

## 4. System Description and Categorization

### 4.1 System Overview

- **System Name:** [SYSTEM NAME]
- **System Acronym:** [ACRONYM]
- **System Owner / Program Manager:** [NAME / ORG]
- **Mission Owner:** [USMC COMMAND]
- **Mission Function Supported:** [BRIEF MISSION DESCRIPTION]
- **Architecture Summary:** Web application consisting of [front-end framework], [back-end framework], [database], hosted in [Hosting environment, e.g., DoD-approved Cloud Service Offering at Impact Level IL-X / on-prem MCEN enclave].
- **User Population:** [e.g., Active duty Marines, DoD civilians, cleared contractors; estimated user count].
- **External Interfaces / Boundary:** [List of inbound/outbound interfaces, ports, protocols, services].

### 4.2 Information Types and Categorization

Information types shall be identified using NIST SP 800-60 Volume II. The system security categorization shall be determined per FIPS 199 (or CNSSI 1253 for NSS):

| Security Objective | Impact Level | Rationale |
|---|---|---|
| Confidentiality | [Low / Moderate / High] | [Justification] |
| Integrity | [Low / Moderate / High] | [Justification] |
| Availability | [Low / Moderate / High] | [Justification] |

**Overall System Categorization:** [Low / Moderate / High]

If hosted in a DoD-approved cloud, the System shall be deployed at the appropriate **DoD Impact Level (IL2 / IL4 / IL5 / IL6)** and provisioned only into a Cloud Service Offering listed in the DoD Cloud Catalog at or above that impact level.

### 4.3 Data Sensitivity

- The System [does / does not] process Controlled Unclassified Information (CUI). If yes, applicable CUI categories: [list].
- The System [does / does not] process Personally Identifiable Information (PII) or Protected Health Information (PHI).
- The System shall not process classified information under this authorization.
- All CUI shall be marked, handled, transmitted, stored, and destroyed in accordance with DoDI 5200.48 and 32 CFR Part 2002.

## 5. Roles and Responsibilities

### 5.1 Authorizing Official (AO)
Issues, denies, or revokes the Authorization to Operate (ATO). Accepts residual risk on behalf of the Marine Corps.

### 5.2 Information System Owner (ISO) / Program Manager (PM)
Overall accountability for the System throughout its lifecycle, including resourcing the security program, ensuring this policy is implemented, and ensuring the System is operated within the boundaries of the ATO.

### 5.3 Information System Security Manager (ISSM)
Day-to-day cybersecurity program manager for the System. Maintains the SSP, RMF artifacts, POA&M, and ensures continuous monitoring is performed. Owns this document.

### 5.4 Information System Security Officer (ISSO)
Implements and operates the security controls. Reviews audit logs, manages vulnerability scans and remediation, supports incident response, and supports the ISSM.

### 5.5 Security Control Assessor (SCA)
Independently assesses the implementation and effectiveness of security controls and reports results to the AO.

### 5.6 Privacy Officer
Ensures Privacy Act, DoDI 5400.11, and SECNAVINST 5211.5 compliance, including completion and maintenance of the PIA and any SORN.

### 5.7 Developers and DevSecOps Engineers
Implement secure coding practices (NIST SP 800-218 SSDF), participate in threat modeling, remediate findings, and maintain CI/CD security guardrails described in Section 9.

### 5.8 System Administrators
Operate the system in accordance with applicable STIGs and this policy. Hold privileged accounts only as required by role.

### 5.9 Cybersecurity Service Provider (CSSP)
Provides 24x7 boundary monitoring, intrusion detection/prevention, and incident response support per DoDI 8530.01. The System shall be aligned to an accredited DoD CSSP (e.g., MARFORCYBER/MCCOG or assigned Tier II CSSP).

### 5.10 Users
Complete annual DoD Cyber Awareness Training, sign the Acceptable Use Policy / DoD Privileged or General User Acknowledgement, and report suspected incidents within one (1) hour to the ISSO/ISSM and CSSP.

## 6. Risk Management Framework (RMF) Implementation

The System shall be authorized and operated under the RMF process defined in DoDI 8510.01, NIST SP 800-37, and ECSM 021:

1. **Categorize** the system using FIPS 199 / CNSSI 1253 / NIST SP 800-60.
2. **Select** baseline controls from NIST SP 800-53 and apply DoD-specific overlays (privacy, classified, cross-domain, cloud) as applicable. Inherit common controls from the hosting environment where documented.
3. **Implement** controls and document implementation in eMASS (Enterprise Mission Assurance Support Service).
4. **Assess** controls via an independent SCA and produce a Security Assessment Report (SAR).
5. **Authorize** the system via an AO decision (ATO, ATO with conditions, IATT, or denial).
6. **Monitor** controls continuously per Section 11.

All RMF artifacts (Categorization Form, Security Plan, SAR, POA&M, Risk Assessment, Continuous Monitoring Plan) shall be maintained current in **eMASS**.

## 7. Access Control and Identity Management

### 7.1 Authentication

- All human users shall authenticate using **DoD-approved Public Key Infrastructure (PKI) credentials** (CAC, ECA certificate, or DoD-approved derived credential) consistent with DoDI 8520.03. Username/password as a sole factor is **prohibited** for any user-facing or privileged interface.
- Service-to-service authentication shall use mutual TLS with PKI certificates issued by a DoD-approved Certificate Authority, OAuth 2.0 with signed JWTs whose keys are managed by an HSM/KMS, or equivalent mechanism approved by the ISSM.
- Multi-factor authentication is required for all privileged users, all remote access, and all access to CUI.
- Session management shall enforce idle timeout of 15 minutes and absolute session timeout in accordance with applicable STIGs. All session tokens shall be cryptographically random, bound to the authenticated user, transmitted only over TLS, and invalidated on logout, password reset, role change, or detected compromise.

### 7.2 Authorization

- Access shall be enforced on the principle of **least privilege** and **need-to-know**.
- The application shall implement **role-based access control (RBAC)** with documented roles and approved permissions matrices.
- Server-side authorization checks are mandatory for every request; client-side controls are advisory only and shall never be relied upon for security decisions.
- Privileged accounts shall be separate from general user accounts and shall not be used for routine business or web browsing.
- All access requests, modifications, and revocations shall be documented and approved by the data owner and ISSO.

### 7.3 Account Management

- Accounts shall be reviewed at least quarterly; inactive accounts shall be disabled after 35 days and removed after 90 days.
- Account creation, modification, disablement, and deletion events shall be logged and audited.
- Departing personnel access shall be revoked within one (1) business day of separation; immediately for involuntary separation or for-cause action.

## 8. Data Protection

### 8.1 Cryptography

- All cryptographic modules shall be **FIPS 140-2 / 140-3 validated** in their validated modes of operation.
- Approved algorithms include AES-256 (GCM preferred), RSA-3072 or higher, ECDSA P-384 or higher, and SHA-256 or higher. MD5, SHA-1 (for signatures), DES, 3DES, and RC4 are prohibited.
- TLS 1.2 minimum, TLS 1.3 preferred, with DoD-approved cipher suites only. SSLv2/v3 and TLS 1.0/1.1 are prohibited.
- All certificates shall be issued by a DoD-approved CA (DoD PKI for internal/.mil, ECA for external partners). Self-signed certificates are prohibited in any environment that handles real or production-equivalent data.

### 8.2 Encryption Requirements

- **In transit:** All web traffic, all administrative traffic, all backend service-to-service traffic, all replication, and all backup transfers shall be encrypted.
- **At rest:** All persistent stores (databases, object storage, file systems, backups, logs, message queues) shall be encrypted with FIPS-validated cryptography. Cloud-native encryption shall use FIPS-validated KMS endpoints.
- **Key management:** Cryptographic keys shall be generated, stored, and rotated using a FIPS 140-2/3 Level 2 (or higher) validated key manager / HSM. Keys shall be rotated at least annually and immediately upon suspected compromise. Separation of duties shall be enforced between key custodians and system administrators.

### 8.3 Data Handling

- Production data shall **not** be copied to development or test environments. Test data shall be synthetic or sanitized in accordance with DoDI 8500.01.
- CUI shall be marked, transmitted, and stored per DoDI 5200.48 and 32 CFR 2002, including banner marking on every page that displays CUI.
- All exports of data outside the System boundary require ISSM approval and shall be logged.
- Data retention and disposition shall follow the applicable Marine Corps records schedule and SECNAV records management policy. Sanitization of media at end of life shall follow NIST SP 800-88.

## 9. Secure Software Development (DevSecOps)

The System shall be developed under a documented Secure Software Development Lifecycle aligned to **NIST SP 800-218 (SSDF)** and the DoD Enterprise DevSecOps Reference Design.

### 9.1 Required Practices

- **Threat modeling** (e.g., STRIDE) for each major release and for any change to the trust boundary, authentication, authorization, or data classification.
- **Secure coding standards** addressing the **OWASP Top 10**, **OWASP API Security Top 10**, and CWE Top 25, with mandatory mitigations for:
  - Injection (SQL, command, LDAP, XPath, template).
  - Broken access control and IDOR.
  - Cross-site scripting (XSS) — output encoding and Content Security Policy enforced.
  - Cross-site request forgery (CSRF) — anti-CSRF tokens or SameSite cookie protections.
  - Server-side request forgery (SSRF) — egress allowlisting.
  - Insecure deserialization, XXE, and unsafe file uploads.
  - Sensitive data exposure in URLs, logs, error messages, or client storage.
- **Pre-commit / CI gates:** secret scanning, static application security testing (SAST), software composition analysis (SCA) against the National Vulnerability Database, infrastructure-as-code scanning, and container image scanning.
- **Pre-deployment gates:** dynamic application security testing (DAST), interactive testing where feasible, and STIG compliance validation of base images and runtime configurations.
- **Software Bill of Materials (SBOM):** generated and stored for every release per EO 14028 and current DoD guidance.
- **Signed artifacts:** all build artifacts and container images shall be cryptographically signed; deployment shall verify signatures.
- **Branch protection and code review:** all changes require peer review by a qualified developer; merges to protected branches require successful security gates and ISSO awareness for security-relevant changes.
- **Secrets management:** no secrets, credentials, keys, or tokens shall be stored in source code, container images, configuration files committed to source control, or unencrypted environment variables. Secrets shall be retrieved at runtime from an approved secrets manager.

### 9.2 Third-Party and Open-Source Components

- All third-party and open-source components shall be reviewed for license compatibility and known vulnerabilities prior to use.
- Components with unpatched **Critical** or **High** vulnerabilities shall not be deployed to production. Justified exceptions require ISSM approval and a tracked POA&M item.
- Dependencies shall be pinned to specific versions and updated under change control.

### 9.3 Supply Chain Risk Management

- Comply with DoDI 5200.44 and applicable supply chain risk management (SCRM) guidance.
- Prohibited products (e.g., those covered by Section 889 of the FY19 NDAA) shall not be used in the System or its supporting infrastructure.

## 10. System Hardening and Configuration Management

- All operating systems, web servers, application servers, databases, container runtimes, and orchestration platforms shall be configured to the **applicable DISA STIG** (or, where no STIG exists, the relevant DISA Security Requirements Guide or vendor security guide approved by the ISSM).
- A documented **baseline configuration** shall be maintained for every component. Deviations require an approved exception and a POA&M entry.
- **Ports, Protocols, and Services Management (PPSM):** every port, protocol, and service used at the system boundary shall be registered in the PPSM Registry and consistent with DoDI 8551.01.
- Default accounts shall be disabled or renamed; default passwords shall be changed prior to deployment.
- Unnecessary services, features, and software shall be removed or disabled.
- All changes to production shall flow through a documented Change Control Board (CCB) and be reflected in the configuration management database.

## 11. Vulnerability Management and Continuous Monitoring

- The System shall be enrolled in continuous monitoring under ECSM 021 and 026, and shall report metrics to the AO at the cadence directed.
- **Authenticated vulnerability scans** (e.g., ACAS / Tenable Nessus) shall be performed at least **monthly**, with web application scanning at least monthly and after significant changes.
- **STIG compliance scans** (SCAP / STIG Viewer) shall be performed at least monthly.
- **Container image scans** shall run on every build and weekly against the registry to detect newly disclosed vulnerabilities in deployed images.
- **Penetration testing** by an independent assessor shall be conducted at least every three (3) years and after any major change to the trust boundary or authentication model.
- Remediation timelines (from discovery):

  | Severity | Remediate By |
  |---|---|
  | Critical (CVSS 9.0–10.0) | 15 days |
  | High (CVSS 7.0–8.9) | 30 days |
  | Medium (CVSS 4.0–6.9) | 90 days |
  | Low (CVSS 0.1–3.9) | 180 days |

  USCYBERCOM and MARFORCYBER tasking orders (CTO/IAVM/IAVA) supersede these timelines when more stringent.

- All findings not remediated within timeline shall be documented in the **Plan of Action and Milestones (POA&M)** in eMASS with an approved mitigation and target completion date.

## 12. Logging, Auditing, and Accountability

### 12.1 Audit Events

At minimum, the following events shall be logged with sufficient detail to reconstruct activity:

- All authentication attempts (success and failure), including source IP, user identifier, and method.
- All authorization decisions for sensitive resources, including denials.
- All privileged operations and administrative actions.
- All account lifecycle events (create, modify, disable, delete, role change).
- All data access to CUI, PII, or designated sensitive resources.
- All configuration and security-relevant changes.
- All security alerts, intrusion detection events, and integrity-monitoring events.
- All system start/stop, application errors, and crashes.

### 12.2 Log Protection and Retention

- Logs shall be transmitted to a centralized, write-once / append-only logging service in near real time.
- Logs shall be protected from unauthorized modification or deletion; administrators shall not have the ability to alter their own audit records.
- Logs shall be retained online for at least **one (1) year** and offline for at least **five (5) years**, or longer if required by mission, legal, or records retention requirements.
- Logs shall be reviewed at least weekly for anomalies and continuously by the supporting CSSP / SOC.
- Logs and alerts shall be forwarded to the supporting CSSP / SOC and integrated with the Joint Regional Security Stack (JRSS) or successor enterprise sensor stack as directed.

### 12.3 Time Synchronization

- All system components shall synchronize time to a DoD-approved authoritative time source (e.g., USNO via NTP) with drift not to exceed one (1) second.

## 13. Incident Response

- The System shall maintain a documented **Incident Response Plan (IRP)** consistent with NIST SP 800-61 and ECSM 028.
- The plan shall be exercised at least **annually** and after any substantial change to the System or its environment.
- **Reporting timelines:**
  - Suspected or confirmed cybersecurity incidents shall be reported to the ISSO/ISSM and supporting CSSP within **one (1) hour** of detection.
  - The CSSP shall report to USCYBERCOM in accordance with **CJCSM 6510.01B** and applicable USCYBERCOM directives.
  - Suspected or confirmed loss of PII shall be reported in accordance with DoDI 5400.11 (within one hour to US-CERT and the DoD Component Privacy Officer).
  - Suspected or confirmed compromise of CUI shall be reported per DoDI 5200.48.
- The IRP shall include defined phases (Preparation, Detection & Analysis, Containment, Eradication, Recovery, Post-Incident Activity) and assigned roles for each phase.
- Forensic data (memory, disk, log, network capture) shall be preserved using a documented chain-of-custody process.

## 14. Contingency Planning, Backup, and Recovery

- The System shall have a documented **Contingency Plan / Disaster Recovery Plan** consistent with NIST SP 800-34 and the categorization of the System.
- **Recovery objectives** shall be documented and tested:
  - Recovery Time Objective (RTO): [defined per mission impact]
  - Recovery Point Objective (RPO): [defined per mission impact]
- **Backups:**
  - Performed on a defined schedule (full and incremental) appropriate to RPO.
  - Encrypted at rest with FIPS-validated cryptography.
  - Stored in a geographically separated location of equivalent or higher security categorization.
  - Tested via restoration at least annually.
- The contingency plan shall be exercised at least annually (tabletop minimum; functional or full-scale as directed by mission impact).

## 15. Physical and Environmental Protection

- The System shall be hosted only in facilities accredited for the relevant impact level, including DoD data centers, Marine Corps Enterprise IT Service (MCEITS) facilities, or DoD-approved Cloud Service Offerings at the appropriate Impact Level.
- Physical access to infrastructure components shall be limited to authorized personnel with documented need; access shall be logged and reviewed.

## 16. Awareness and Training

- All users shall complete **DoD Cyber Awareness Challenge** training prior to access and annually thereafter.
- Privileged users shall complete role-based training appropriate to their privileges, including any required certifications under DoD 8140 / SECNAV M-5239.2 (DON Cyberspace IT/CS Workforce Management).
- Developers shall complete annual secure coding training appropriate to the languages and frameworks used.

## 17. Privacy

- A **Privacy Impact Assessment (PIA)** shall be completed prior to operation and updated upon material change.
- If the System is a Privacy Act system of records, a **System of Records Notice (SORN)** shall be published and maintained.
- Collection of PII shall be the minimum necessary for the mission. Use beyond stated purpose is prohibited.
- Privacy Act statements shall be provided at the point of collection.

## 18. Acceptable Use

- All users shall acknowledge and abide by an Acceptable Use Policy / DoD User Agreement (or DoD Privileged User Agreement, as applicable) prior to access.
- Each access portal shall display the **DoD Notice and Consent Banner** required by DoDI 8500.01 and CJCS guidance.
- Use of the System for unauthorized, unlawful, or personal commercial purposes is prohibited and may result in administrative, civil, or criminal action.

## 19. Change Management

- All changes shall flow through an approved Change Control Board (CCB).
- Security-relevant changes (authentication, authorization, cryptography, boundary, audit, data classification) require ISSO/ISSM review prior to deployment.
- Major changes shall be assessed for impact to the ATO and may require re-authorization.

## 20. Decommissioning

- Prior to decommissioning, all data shall be inventoried, transferred to authorized successor systems where required, and sanitized per **NIST SP 800-88**.
- Cryptographic keys shall be destroyed.
- Accounts and access shall be revoked.
- The system record in eMASS shall be updated to reflect decommissioning, and the AO shall be notified.

## 21. Enforcement and Exceptions

- Violations of this policy may result in administrative, disciplinary, civil, or criminal action under the Uniform Code of Military Justice (UCMJ) and applicable federal and DoD regulations.
- Any exception to this policy must be documented, justified by mission necessity, approved in writing by the ISSM and AO, time-bounded, tracked in the POA&M, and reviewed at least annually.

## 22. Document Control and Review

- This policy shall be reviewed at least annually and after any major change to the System, the threat environment, or governing authority.
- Revisions shall be approved by the AO. Prior versions shall be retained for the life of the System plus five (5) years.

---

## Appendix A — Acronyms

| Acronym | Definition |
|---|---|
| ACAS | Assured Compliance Assessment Solution |
| AO | Authorizing Official |
| ATO | Authorization to Operate |
| CAC | Common Access Card |
| CCB | Change Control Board |
| CIA | Confidentiality, Integrity, Availability |
| CNSSI | Committee on National Security Systems Instruction |
| CSSP | Cybersecurity Service Provider |
| CTO | Cyber Tasking Order |
| CUI | Controlled Unclassified Information |
| DAST | Dynamic Application Security Testing |
| DISA | Defense Information Systems Agency |
| DoD | Department of Defense |
| DoDI | Department of Defense Instruction |
| ECSM | (USMC) Enterprise Cybersecurity Manual |
| eMASS | Enterprise Mission Assurance Support Service |
| FIPS | Federal Information Processing Standards |
| FISMA | Federal Information Security Modernization Act |
| HSM | Hardware Security Module |
| IAVA / IAVM | Information Assurance Vulnerability Alert / Management |
| IRP | Incident Response Plan |
| ISSM | Information System Security Manager |
| ISSO | Information System Security Officer |
| JRSS | Joint Regional Security Stack |
| KMS | Key Management Service |
| MARFORCYBER | Marine Corps Forces Cyberspace Command |
| MCCOG | Marine Corps Cyberspace Operations Group |
| MCEN | Marine Corps Enterprise Network |
| MCO | Marine Corps Order |
| NIST | National Institute of Standards and Technology |
| OWASP | Open Worldwide Application Security Project |
| PII | Personally Identifiable Information |
| PIA | Privacy Impact Assessment |
| PKI | Public Key Infrastructure |
| POA&M | Plan of Action and Milestones |
| PPSM | Ports, Protocols, and Services Management |
| RBAC | Role-Based Access Control |
| RMF | Risk Management Framework |
| RPO | Recovery Point Objective |
| RTO | Recovery Time Objective |
| SAR | Security Assessment Report |
| SAST | Static Application Security Testing |
| SBOM | Software Bill of Materials |
| SCA | Security Control Assessor / Software Composition Analysis |
| SECNAV | Secretary of the Navy |
| SORN | System of Records Notice |
| SRG | Security Requirements Guide |
| SSDF | Secure Software Development Framework |
| SSP | System Security Plan / Policy |
| STIG | Security Technical Implementation Guide |
| TLS | Transport Layer Security |
| USCYBERCOM | United States Cyber Command |
| USMC | United States Marine Corps |

## Appendix B — Required DoD Notice and Consent Banner

The following banner (or the current DoD-approved equivalent) shall be displayed at every login interface and acknowledged before access is granted:

> You are accessing a U.S. Government (USG) Information System (IS) that is provided for USG-authorized use only.
>
> By using this IS (which includes any device attached to this IS), you consent to the following conditions:
>
> - The USG routinely intercepts and monitors communications on this IS for purposes including, but not limited to, penetration testing, COMSEC monitoring, network operations and defense, personnel misconduct (PM), law enforcement (LE), and counterintelligence (CI) investigations.
> - At any time, the USG may inspect and seize data stored on this IS.
> - Communications using, or data stored on, this IS are not private, are subject to routine monitoring, interception, and search, and may be disclosed or used for any USG-authorized purpose.
> - This IS includes security measures (e.g., authentication and access controls) to protect USG interests — not for your personal benefit or privacy.
> - Notwithstanding the above, using this IS does not constitute consent to PM, LE, or CI investigative searching or monitoring of the content of privileged communications, or work product, related to personal representation or services by attorneys, psychotherapists, or clergy, and their assistants. Such communications and work product are private and confidential. See User Agreement for details.

## Appendix C — Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Information System Owner / PM |  |  |  |
| Information System Security Manager (ISSM) |  |  |  |
| Authorizing Official (AO) |  |  |  |
