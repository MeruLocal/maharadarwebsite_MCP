# Astra review (gpt-6-astra, role=code, one pass, 2026-10-22)

Payload: docs/AUDIT.md + src/http.ts + first 70 lines of src/server.ts. No secrets or PII sent (egress check passed). Sol skipped by founder instruction.

**Verdict: do-not-ship** (public listing premature). Agreed for public listing; this PR is a draft.

## Accepted and fixed
1. 413 on streamed oversize could destroy the socket before replying (src/http.ts readBody threw mid-iteration). Fixed: content-length precheck, data-listener cap, reply then close; test with a real chunked upload.
2. Limiter spoofable and O(n) scan per new key once the map passed 5,000. Fixed: key is socket address unless TRUST_PROXY=1, periodic sweep, hard 10k cap with O(1) oldest eviction.
3. "No fact typed by hand" was false for `maharadar_about`. Report corrected; regeneration listed as a Gap.
4. Per-result provenance lacked the repo. Added `contentRepo` and a test.
5. F2 evidence "HTTP 000" was weak. Re-measured with nslookup: Non-existent domain.
6. Severity labels: F1/F2 relabelled launch blockers, F7 a pass; go/no-go split into staging vs public listing.
7. Missing tests added: inventory (10 tools / 2 resources / 2 prompts), every tool returns schema-valid output, no currency amount in tool/resource output, FAQ citations, protocol-version negotiation.

## Rejected / partly rejected
- "Absence of session IDs is insufficient to claim compatibility with 2026-07-28": agreed, so the report no longer asserts full compliance; it says only that no session id is used.
- "do-not-ship" as a code verdict: the listed code defects were fixed; the remaining blockers are deployment, DNS and sign-offs, which the report already carries.

## Unverified (Astra could not see; neither can I)
Inspector/conformance results, Docker build, deployment proxy behaviour, whether live site == branch `1991d0bc`, registry schema validity of the server card and server.json, whether README commands work against a live host.
