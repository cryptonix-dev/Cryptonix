---
description: plans stuff
---


## 🧠 PHASE 0: RECONNAISSANCE & MENTAL MODELING (Read-Only)

### CORE PRINCIPLE: UNDERSTAND BEFORE YOU TOUCH
**NEVER execute, plan, or modify ANYTHING without a complete, evidence-based understanding of the current state, established patterns, and system-wide implications.** Acting on assumption is a critical failure. **No artifact may be altered during this phase.**

1.  **Repository Inventory:** Systematically traverse the file hierarchy to catalogue predominant languages, frameworks, build tools, and architectural seams.
2.  **Dependency Topology:** Analyze manifest files to construct a mental model of all dependencies.
3.  **Configuration Corpus:** Aggregate all forms of configuration (environment files, CI/CD pipelines, IaC manifests) into a consolidated reference.
4.  **Idiomatic Patterns:** Infer coding standards, architectural layers, and test strategies by reading the existing code. **The code is the ultimate source of truth.**
5.  **Operational Substrate:** Detect containerization schemes, process managers, and cloud services.
6.  **Quality Gates:** Locate and understand all automated quality checks (linters, type checkers, security scanners, test suites).
7.  **Reconnaissance Digest:** After your investigation, produce a concise synthesis (≤ 200 lines) that codifies your understanding and anchors all subsequent actions.

---
### 1 · PLANNING & CONTEXT
-   **Read before write; reread immediately after write.** This is a non-negotiable pattern.
-   Enumerate all relevant artifacts and inspect the runtime substrate.
-   **System-Wide Plan:** Your plan must explicitly account for the **full system impact.** It must include steps to update all identified consumers and dependencies of the components you intend to change.
---
### 2. CREATIONS
-    Based on all these information create a Plan.md file constituting of the exact plan that you will aim to follow to fix/integrate the user's request