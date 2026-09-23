# ADR-0008: Application Lifecycle & State Machine

## Status
Accepted

## Context
MosaiX applications need a clear, predictable lifecycle state machine to enable dynamic discovery, loading, supervision, hot-reloading, and graceful shutdown without crashing the RuntimeKernel.

## Decision
We define an explicit state machine for Bounded Application Contexts:
`DISCOVERED ➔ VALIDATING ➔ LOADING ➔ INITIALIZING ➔ READY ➔ RUNNING ➔ STOPPING ➔ STOPPED`

An `AppSupervisor` manages state transitions, health checks, crash recovery, and state persistence.
