# GSD (Get Shit Done) Context Engineering & Spec-Driven Governance

## Overview

Get Shit Done (GSD) is a meta-prompting, context engineering, and spec-driven development framework designed for AI coding agents. It prevents context degradation through disciplined phase loops and structured file artifacts.

This document outlines the core patterns adapted from GSD into MosaiX `.project/` governance.

---

## Key Principles Adapted for MosaiX `.project/`

### 1. Spec-Driven Phase Loops
Work flows sequentially through strict gates:
```
Discuss (CONTEXT.md / PRD) ➔ Research (RESEARCH.md / Spikes) ➔ Plan (PLAN.md / Backlog) ➔ Execute (Atomic commits) ➔ Verify (VERIFICATION.md / Tests)
```

### 2. Context Engineering & Fresh Windows
To prevent context degradation over long development sessions:
- Context is organized in structured, inspectable files (`dashboard.md`, `project_state.md`, `consolidated-backlog-2026-08-16.md`).
- Only minimal required context is loaded per step.
- Execution produces atomic commits with summary notes.

### 3. Requirements & Decision Coverage
- Every requirement in PRDs and ADRs maps directly to actionable backlog items.
- Verification gates verify that shipped artifacts fulfill requirements without regression.

### 4. Wave Execution Grouping
- Independent tasks in the backlog are grouped into execution waves.
- P0/P1 tasks are prioritized as blocking gates before moving to feature waves.

---

## MosaiX `.project/` Integration Mapping

| GSD Primitive | MosaiX `.project/` Counterpart | Function |
|---------------|--------------------------------|----------|
| `STATE.md` | `.project/project_state.md` & `dashboard.md` | Current phase state, active milestones, and verification gates |
| `CONTEXT.md` / `REQUIREMENTS.md` | `.project/prd/` & `decisions/` | Requirements, constraints, and ADR decision coverage |
| `PLAN.md` | `.project/backlog/consolidated-backlog-2026-08-16.md` | Structured task plans with priorities (P0..P3) and dependencies |
| `VERIFICATION.md` | `.project/reports/` & `changelog.md` | Test execution evidence, gap analysis, and session audit logs |
