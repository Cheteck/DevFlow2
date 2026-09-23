# Roadmap : Portage POC Booking

- [ ] **Phase 1 : Setup**
    - [x] Initial Audit (User provided)
    - [x] Project tracking setup
    - [x] Infrastructure check (scripts/check-contracts.ts)

- [x] **Phase 2 : App Template & Booking POC**
    - [x] Refactor `apps/_template` to be a true parametric generator.
    - [x] Create `apps/booking` scaffold following canonical structure.
    - [x] Port `mosaix.json` from POC to `apps/booking`.
    - [x] Implement `BookingServiceProvider` (register/boot + Guards).
    - [x] Port frontend contributions (`apps/booking/frontend`).

- [ ] **Phase 3 : Platform Integration**
    - [ ] Reconcile `discoverApps` in `src/start.ts` with `ContextRegistry`.
    - [ ] Enable local-first/offline support for Booking (if required).
    - [ ] Validation via Conformance Tests.
