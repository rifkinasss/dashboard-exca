# Phase 9 — Master Data Architecture & Automated Overview

**Status:** Architecture proposal only. The live spreadsheet, application code, credentials, and API permissions were not changed.

## 1. Current source audit

The current application contract is defined in `src/features/dashboard/types.ts` and `src/features/finance/types.ts`; the Sheets readers validate headers in order and reject extra/reordered columns. Operational sheet selection comes from `GOOGLE_SHEET_NAME`; the finance reader currently expects `Overview Finance`.

### Overview Operasional — A–P

| Col. | Current header | Current meaning / migration note |
|---|---|---|
| A | No | Display sequence, not an identity. Regenerate in a derived overview. |
| B | No. SPK | SPK text; merged values have explicit range provenance. Blank cells outside a confirmed merge remain unknown. |
| C | Kode Petak | Plot code; merged values have explicit range provenance. |
| D | Luas Petak (Ha) | Plot metadata repeated/merged in the current source. Conflicts and zero values require review. |
| E | Total Konsumsi Solar | Source snapshot/cumulative measure. Never sum this field as activity consumption. |
| F | Tanggal | Activity date, interpreted as a local calendar date. |
| G | HM Awal | Starting hour meter. |
| H | HM Akhir | Ending hour meter. |
| I | HM Kerja (Jam) | Recorded working hours; existing validation/calculation rules remain canonical. |
| J | Est. Jam Kerja | Estimated hours; keep distinct from measured HM. |
| K | Pengisian Solar (L) | Refill volume currently carried on an activity row; migration creates a refill transaction with source trace. |
| L | Pemakaian Solar per Jam (L/Hr) | Source rate; retain as a source measurement and do not overwrite with a recalculation. |
| M | Pemakaian Solar Riil (L) | Actual fuel-use measurement. |
| N | Sisa/Stok Tangki (L) | Tank snapshot used by validation; retain internally. |
| O | Status Pekerjaan | Work status, separate from SPK administration status. |
| P | Keterangan | Activity/source notes. |

The existing reader expects 16 ordered columns, and currently reads merge metadata for columns B and C. A prior read-only audit recorded 21 merged ranges, 8 observed formula cells, and 23 list-validation cells in the operational sheet. These are a dated snapshot, not a guarantee of current sheet state. The source has no stable IDs for plot, activity, or refill records.

### Overview Finance — A–K

| Col. | Current header | Current meaning / migration note |
|---|---|---|
| A | No | Display sequence, not an identity. |
| B | No. SPK | SPK identifier, read as text; currently may be merged. |
| C | Kode Petak | Plot identifier, currently may be merged. |
| D | Luas Petak (Ha) | Area snapshot. |
| E | Harga Petak / Ha | Source price per hectare. |
| F | Harga per Petak | Source plot price/value. |
| G | Harga Solar | Source unit price. |
| H | Pengisian Solar (L) | Source refill volume in the finance snapshot. It is not automatically another operational refill transaction. |
| I | Pengeluaran Solar | Source fuel expense; existing verification compares source expense with available price and volume. |
| J | Pendapatan Kotor | Gross source value. |
| K | Pendapatan Bersih | Source-provided net value; retain as a source figure, distinct from the dashboard's margin-after-verified-fuel calculation. |

The reader expects 11 ordered columns and reads merge metadata for B/C. A prior read-only audit recorded one merged range and 23 observed formula cells. Finance has no transaction-date column, so current rows are snapshots, not dated cash transactions. Current row numbers are provenance only. The finance reader and normalization preserve row provenance and avoid ambiguous many-to-many SPK/plot matching.

The audit above is based on the checked-in contract and the last recorded read-only inspection (2 November 2026); the live workbook was not re-read for this planning checkpoint. Reconfirm live headers, merges, formulas, validations, protections, and row counts during migration preflight.

## 2. Target workbook and worksheet schemas

Use the requested seven worksheets and add **Relasi Petak-SPK** as an explicit relationship table. Without it, the workbook cannot represent pending SPK administration, multiple SPKs over a plot's lifetime, effective dates, or one SPK linked to many plots without duplicating master rows. Overview worksheets remain derived outputs, never manual sources.

All source tables use one header row, one record per row, no merged cells, fixed column order, frozen header, and validated data types. Store IDs, SPK numbers, and codes as plain text. Dates use `YYYY-MM-DD`; timestamps use ISO 8601 with timezone. Amounts and measurements are numeric cells with units in the header/contract. Blank means unknown/not recorded; zero is an explicit measurement where valid.

### Master Petak

One row per plot master record.

| Field | Type | Rule |
|---|---|---|
| `plot_id` | UUID text | Immutable primary ID, generated server-side. |
| `kode_petak` | text | Required display code; normalized comparison key must be unique after reviewed migration. |
| `luas_ha` | decimal or blank | Optional; positive when known. Never infer from repeated activity rows. |
| `catatan` | text or blank | Supporting plot metadata. |
| `record_status` | `active` / `archived` / `needs_review` | Archive is soft and auditable. |
| `created_at`, `created_by`, `updated_at`, `updated_by` | timestamp/text | Server-assigned audit metadata. |
| `version` | integer text/number | Monotonic application version; must not be treated as an atomic Sheets compare-and-swap. |
| `legacy_source_ref` | text or blank | Crosswalk reference, not an ID. |

Do not place a mandatory SPK number here. A plot may exist without SPK and can have more than one SPK association over time.

### Master SPK

One row per administrative SPK document/number.

| Field | Type | Rule |
|---|---|---|
| `spk_id` | UUID text | Immutable primary ID. |
| `no_spk` | text | Required; preserve leading zeroes and source spelling. |
| `status_administrasi` | controlled text | E.g. pending, available, submitted, approved, rejected, archived. Work progress is not a source for this field. |
| `tanggal_terbit` | date or blank | Only enter when evidenced. |
| `referensi_dokumen` | text/URL or blank | Link/reference; document storage and access policy remain to be decided. |
| `catatan` | text or blank | Administrative note. |
| `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `record_status`, `legacy_source_ref` | audit/status fields | Same rules as Master Petak. |

Treat `no_spk` as text through forms, Sheets formatting, API serialization, import/export, and validation. Do not strip leading zeroes. The exact uniqueness/normalization rule for punctuation and whitespace needs business approval.

### Relasi Petak-SPK

One row per association period. This is the authoritative many-to-many join and pending-administration record.

| Field | Type | Rule |
|---|---|---|
| `association_id` | UUID text | Immutable primary ID. |
| `plot_id` | UUID text | Required FK to Master Petak. |
| `spk_id` | UUID text or blank | Blank only while relation state is pending. |
| `association_status` | `pending` / `linked` / `ended` / `needs_review` | Independent from work and SPK administrative status. |
| `effective_from`, `effective_to` | date or blank | Association validity. Do not infer dates from completion. |
| `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `legacy_source_ref` | audit fields | Preserve changes and migration provenance. |

Allow multiple association rows for one plot and multiple plots for one SPK. Prevent overlapping active associations for the same plot only after rules for concurrent SPKs are approved. Do not overwrite an association when work is repeated under another SPK; close it and create a new association with explicit dates.

### Aktivitas Operasional

One row per operational activity. An activity always belongs to a plot; SPK relation is optional.

| Field | Type | Rule |
|---|---|---|
| `activity_id` | UUID text | Immutable primary ID. |
| `plot_id` | UUID text | Required FK. |
| `association_id` | UUID text or blank | Optional FK; if set, it must belong to the same plot. A pending association may be used before SPK issuance. |
| `tanggal` | date or blank | Missing date remains missing and is excluded from dated metrics under existing rules. |
| `hm_awal`, `hm_akhir`, `hm_kerja_jam`, `estimasi_jam_kerja` | decimal or blank | Preserve measured and estimated values separately. Do not auto-repair inconsistencies. |
| `pemakaian_solar_per_jam_l_jam`, `pemakaian_solar_riil_l`, `sisa_stok_tangki_l` | decimal or blank | Preserve source measurements and existing validation semantics. |
| `total_konsumsi_solar_snapshot_l` | decimal or blank | Carries legacy E as a snapshot, never add it across activity rows. |
| `status_pekerjaan` | controlled text or blank | Preserve started/in-progress/completed/unknown distinctions. |
| `catatan` | text or blank | Source/activity note. |
| audit/version/record-status fields | — | Stable source trace and soft archive. |

### Pengisian Solar

One row per refill transaction; a refill may precede, follow, or be unlinked to an activity.

| Field | Type | Rule |
|---|---|---|
| `refill_id` | UUID text | Immutable primary ID. |
| `plot_id` | UUID text | Required FK. |
| `activity_id`, `association_id` | UUID text or blank | Optional explicit links; validate plot consistency when present. |
| `tanggal_waktu` | timestamp/date or blank | Do not fabricate historical transaction time. |
| `volume_l` | decimal or blank | Nonnegative; zero remains distinct from missing. |
| `catatan`, `legacy_source_ref`, audit/version/record-status fields | — | Preserve notes and trace. |

If a legacy K value exists per activity row but cannot be split into multiple refill events, migrate it as one legacy-derived refill record with the source row as provenance and a migration classification. Do not claim it is a separately verified timestamped transaction.

### Data Keuangan

One row per financial metric/event, with explicit basis and source grouping. This supports the present undated snapshot without mislabeling it as cash received, and supports future dated transactions.

| Field | Type | Rule |
|---|---|---|
| `financial_record_id` | UUID text | Immutable primary ID. |
| `source_group_id` | UUID text | Groups legacy financial metrics originating from one source row/snapshot. |
| `record_basis` | `snapshot` / `transaction` | Required. Snapshot and cash transaction semantics must never be blended. |
| `metric_code` | controlled text | `area_price`, `plot_price`, `fuel_unit_price`, `fuel_volume`, `fuel_expense`, `gross_revenue`, `source_net_value` or an approved future code. |
| `amount`, `unit`, `currency` | decimal/text | Store the source value as given; IDR values use `IDR`, volumes use `L`, areas use `ha`. |
| `transaction_date`, `as_of_date` | date or blank | Required transaction date only for evidenced transactions; legacy Finance has neither and must stay blank. |
| `plot_id`, `spk_id` | UUID text or blank | Optional individually, but attribution for plot/SPK dashboards requires an unambiguous relationship. |
| `referensi_dokumen`, `catatan`, `legacy_source_ref`, audit/version/record-status fields` | — | Trace and administer without changing original source values. |

Do not sum price rates or snapshots. Transaction revenue/cost may be summed only by an approved metric/date basis. Keep source net separate from `gross revenue − verified fuel cost`; the latter remains a margin-after-fuel measure, not net profit.

### Overview Operasional and Overview Finance

Retain the current ordered A–P and A–K contracts until a separately approved dashboard contract migration. Generate rows from source records; keep existing headers, calculations, formatting where needed, and make the tabs protected/read-only to ordinary operators. Do not merge cells. Repeat plot/SPK labels on each generated activity/financial row where the legacy reader requires values. Repeated metadata is display projection only and must not be summed.

Overview Operasional maps one row per activity; refill K is projected from linked refill transactions according to a decided period/row allocation rule. Do not duplicate a refill across multiple activities. E is the latest/appropriate source snapshot selected under an explicit rule, not the sum of E or K. D comes from Master Petak once per plot, and is repeated in the projection only for compatibility. M, N, status, HM, estimates, and notes remain source-preserving. Any field with no deterministic mapping must produce a quality issue and remain blank, not be fabricated.

Overview Finance maps finance source records to the existing A–K presentation only when a unique plot/SPK relation and snapshot selection rule exist. Legacy snapshot records have no transaction date; they cannot appear as dated receipts or monthly cash totals. A derived view must expose coverage and excluded/ambiguous rows alongside totals.

## 3. Entity relationships

```text
Master Petak 1 ── * Relasi Petak-SPK * ── 0..1 Master SPK
      │                       │
      ├── * Aktivitas Operasional ── 0..* Pengisian Solar
      ├── * Pengisian Solar (activity link optional)
      └── * Data Keuangan (when explicitly attributed)

Master SPK ── * Data Keuangan (when explicitly attributed)
Aktivitas/Refill/Finance ── Overview projections (read-only, derived)
```

`Data Keuangan` may link to a plot, an SPK, both, or neither while unassigned; a verified per-plot dashboard total requires a unique attribution. Do not perform a many-to-many join that repeats one financial record. `association_id` is the preferred operational context for work under an SPK; it is not required for work to begin.

## 4. Identity, traceability, and archive strategy

- Generate immutable UUIDs on the trusted server for all new source records. Never expose a user-editable ID field.
- Keep source worksheet, source row at import time, original cell/field references, and raw-value fingerprint as provenance. Row is evidence for where a record was observed, never the record key.
- Migration assigns IDs once and persists a crosswalk before import. Re-runs must use that crosswalk, not regenerate IDs or match only by row number.
- Add a protected migration crosswalk/log area (a technical worksheet or controlled artifact) containing old workbook/sheet, old row, raw fingerprint, assigned entity IDs, import batch, decision, and issue disposition. Retain a backup copy of raw legacy values; do not use hidden sheets as an access-control boundary.
- Updates change the entity row using its stable ID and increment its version. Archive sets status and actor/time; it does not delete history or cascade-delete activities, refills, relationships, or finances.
- A plot code or SPK number correction must preserve the old value in audit/provenance history. Define uniqueness at the application/service boundary; Sheets itself does not provide relational foreign-key or unique-index guarantees.

## 5. Optional SPK association workflow

1. Create a plot with a required unique code; area and supporting metadata may be blank. No SPK FK is required.
2. Create a pending `Relasi Petak-SPK` row. The plot and its activities/refills are valid immediately.
3. If the SPK already exists, select it and link the association. If new, create a `Master SPK` record in its separate explicit workflow, then link it.
4. When an SPK is issued after work began, update the pending association in place, retaining `association_id`; activities/refills already pointing to it need no rewrite. If historical activities have no association, show an explicit candidate list and require a reviewed, auditable selection; never attach them all by plot or completion status.
5. For later work under another SPK, create a new association. Select association for each new activity/refill, keeping their immutable IDs and values distinct.
6. SPK administration status and plot work status are stored and filtered independently.

Unresolved rules: whether a pending association is always created with a plot or only when work is assigned; whether overlapping SPK associations are allowed; how to represent a reopened plot or partial completion; and how to handle a plot whose code is reused for a different physical area.

## 6. Existing data migration mapping

### Operational rows

1. Preserve a read-only workbook copy and capture current values, formulas, sheet IDs, merges, validations, protections, and named ranges.
2. Convert each valid plot code into a candidate `Master Petak`; normalize only for comparison. Grouping blank B/C cells is allowed only where the current merge metadata proves the merged range. Do not generic-forward-fill. Duplicate or conflicting plot identity/area candidates go to review and are not silently merged.
3. Convert B SPK values to `Master SPK` candidates as text. A source row with no SPK remains unassigned/pending. Create explicit plot-SPK associations only where source evidence unambiguously ties a plot and SPK; merged-cell ranges provide source scope, not a permanent ID.
4. Convert each operational row to an `Aktivitas Operasional` candidate with a new stable ID and source trace. Preserve invalid raw values and mark review status; do not discard the record merely because some measurements are invalid.
5. Convert K into a legacy-derived `Pengisian Solar` candidate only once per source activity row, unless inspection proves a different transaction grain. Preserve zero, blank, and invalid distinctly.
6. Preserve E on the activity/snapshot projection as a source snapshot. Never transform repeated E values into repeated consumption transactions or sum them.

### Finance rows

1. Preserve each non-summary row as a `source_group_id` and emit one metric record for each populated D–K field, with the appropriate metric code/unit and the original source trace.
2. Keep transaction date and as-of date blank because the present source does not provide them. Do not backfill from operational activity dates.
3. Link `plot_id` and `spk_id` only when the existing composite relation is unique. If SPK is missing, duplicate, conflicting, or plot-only matching is ambiguous, retain the finance record as unassigned/needs-review and exclude it from attributed totals under existing rules.
4. Preserve source gross and source net separately. Cost remains unverified unless the same completeness and reconciliation checks currently required by the finance engine pass.

### Unresolved migration evidence

The source contracts do not define whether `No` is stable, whether all K values represent distinct refill events, whether finance row-level amounts are transaction or contract snapshots, how `Pendapatan Bersih` is calculated, or how legacy SPK/plot reuse is handled. None of these are inferred. The preflight must quantify them and produce an issue register before any cutover.

## 7. Data flow and derived Overview generation

```text
Authenticated form (future)
  → server validation + actor/permission check
  → source-table repository write with stable ID + audit record
  → validation/reconciliation read
  → deterministic projection builder
  → Overview Operasional / Overview Finance
  → existing read-only Google Sheets adapter
  → existing normalization, validation, finance relation, and calculation engines
  → dashboards
```

The projection builder is a compatibility boundary, not a second calculation engine. It should map normalized source records into the existing overview row contracts; the existing engine remains responsible for the operational and financial calculations. Projection generation must be deterministic for the same source snapshot and must publish a generation ID/time, row counts, input versions/fingerprints, and quality summary. A dashboard should not read a partially generated overview as if it were current.

Preferred publish sequence: build the complete projection off-range/in memory; validate header, row widths, unique row mappings, and reconciliation; write to a staging tab/range; read back and compare generation ID and critical totals; then switch/publish the derived output in a controlled server operation. Keep the previous good output available for rollback. How the active view pointer is changed and protected must be proven in a staging spreadsheet before implementation.

Google `spreadsheets.batchUpdate` validates requests before applying them and applies its subrequests atomically; the API documentation also warns that concurrent collaborators can alter the final sheet state. This supports batching sheet-structure operations but does not supply relational constraints, application authorization, a durable cross-request transaction, or safe multi-user compare-and-swap. `spreadsheets.values:batchUpdate` is a separate endpoint and must not be assumed to provide a transaction across the broader migration workflow. See [Google Sheets batch requests](https://developers.google.com/workspace/sheets/api/guides/batch) and [spreadsheets.values.batchUpdate](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate).

## 8. Validation and reconciliation rules

- Validate required IDs, code/number types, FK existence, same-plot association consistency, date parsing, and nonnegative volume/area constraints at the server boundary. Never depend solely on client validation or Sheets dropdowns.
- Preserve invalid/missing/conflicting records in source tables or a review queue with issue code, severity, source references, and disposition. Exclude them only from affected derived metrics, with counts and reasons visible.
- Compare pre-migration and post-projection counts for distinct plots, SPKs, operational activity rows, refill candidates, finance source groups, and summary rows.
- Reconcile operational totals through the existing engine for identical input populations: dates, HM, actual usage, refill K, tank-stock diagnostics, unique-area inventory, work status history, and monthly target. Do not change existing formulas during migration.
- Refill totals are summed by refill transaction ID and approved date scope, not by plot snapshot. E is never summed. Each refill may appear at most once in a projection and KPI.
- HM and efficiency retain existing pair eligibility and invalid-measurement behavior. No imputation or automatic correction.
- Completion-area target keeps existing verified completion-event/month rules; count each plot once per month and preserve excluded-area issues.
- Finance totals reconcile by `financial_record_id`/`source_group_id` and metric semantics. Snapshot gross is selected once under an approved snapshot rule; dated transaction revenue is summed by transaction date. Never double count source net, allocated estimates, or one record joined to multiple activities.
- Validate margin as gross less verified fuel cost only where the current engine considers both complete; do not relabel it net profit.
- Diff every existing dashboard KPI, chart series, table row, and quality issue between old and projected Overview on the same fixture and live snapshot before cutover. Explain every nonzero difference; require sign-off for any intentional difference.
- Idempotency: rerunning one migration batch must not create new entity IDs or duplicate source rows. Updates/archive must not remove historical activities or finance values.

## 9. Repository/write boundary

The existing `src/features/management/repository.ts` contains type-only Read/Create/Update/Archive interfaces for Petak, SPK, activity, refill, and association. Keep the interfaces server-only in actual use; this phase does not implement adapters, mutation endpoints, or write scopes.

Before implementation, refine contracts to require authenticated actor context server-side, stable ID generation, idempotency key, expected entity version, audit metadata, validation issues, soft-archive semantics, and explicit association operations. Never accept actor, source row, ID, or `version` as trusted authorization input from the browser. Repository writes must check ownership and FK relationships again on the server.

## 10. Write permission and authorization requirements

- Keep the current Google Sheets credential at `spreadsheets.readonly`; no write permission is authorized in this checkpoint.
- Before a production writer exists, implement authentication (planned Auth.js/Google OAuth) and server-side role/permission checks for each operation. No unauthenticated route handler/server action may mutate Sheets.
- Use a dedicated least-privilege writer identity separate from the dashboard reader. Protect the workbook/ranges against direct human edits where operationally practical; hidden tabs are not security controls.
- Keep access tokens and private keys server-side, rotate credentials as part of migration/release, and audit every view-sensitive and write operation with actor, action, entity ID, timestamp, before/after digest, request ID, and outcome without logging secrets.
- Decide concurrency policy before multi-user CRUD. Google Sheets is collaborative and offers no relational FK/unique constraints; a single-writer queue or a transactional database may eventually be needed if lost updates cannot be prevented with the chosen deployment model. This is a decision gate, not a recommendation to add a database now.
- Restrict document references to approved storage/domains and apply access control; do not treat a pasted URL as proof of ownership or authorization.

## 11. Backup, migration, and rollback plan

1. **Preflight:** confirm workbook identity/owner, exact worksheet names and headers, full used ranges, formulas, merge ranges, named ranges, data validations, protected ranges, external links, and service-account access. Export a timestamped, access-controlled backup and record its revision/metadata. Do not expose credentials in the artifact.
2. **Inventory:** export raw source snapshots and calculate hashes; record row counts, summary rows, invalid rows, duplicate candidates, ambiguous merge scopes, and finance matching coverage. Produce a human-review mapping report.
3. **Staging copy:** perform all schema creation and import on a separate spreadsheet copy. Preserve raw source tabs as immutable legacy evidence. Add no production writer yet.
4. **Dry-run import:** assign stable IDs once, write a durable crosswalk, and import to target source tables. Re-run the importer to prove idempotency and no duplicate IDs/rows.
5. **Projection rehearsal:** generate Overview tabs in staging, verify schemas, mappings, formulas/protection, data quality, reconciliation, and existing dashboard compatibility. Run old and new projections in parallel without user-visible cutover.
6. **Approval gate:** obtain data-owner sign-off for ambiguous rows, association semantics, finance snapshot treatment, KPI parity, access roles, backup restore, and rollback rehearsal. Do not cut over on unexplained KPI differences.
7. **Cutover:** only after separate authorization, freeze or coordinate source edits, take a final backup, run the approved idempotent migration, validate readback, then switch the server-side source configuration to the generated overview. Monitor quality and parity.
8. **Rollback:** stop writes, switch read-only dashboard configuration to the retained legacy Overview source, preserve the failed target and logs for diagnosis, and restore from backup only if verified necessary. Never overwrite the only legacy copy during rollback.
9. **Closeout:** verify recovery/parity, audit access and scopes, and retain the migration crosswalk and backup under the approved retention policy.

## 12. Verification checklist

- [ ] Live source names, exact headers, columns, row counts, formulas, merges, validations, protections, and named ranges captured.
- [ ] Every legacy source row has a migration disposition: mapped, summary, duplicate candidate, invalid/needs review, or intentionally excluded with reason.
- [ ] Every plot/SPK/activity/refill/finance record has one stable ID; no row number is used as permanent identity.
- [ ] Leading zeroes and text identifiers survive round-trip export/import.
- [ ] Pending plot and activity/refill flows work without SPK; linking later preserves historical IDs and values.
- [ ] Multi-plot SPK and repeated work under different SPKs reconcile through explicit association IDs.
- [ ] Source tables contain no merged cells; overviews are deterministic, derived, and not manually editable.
- [ ] Existing operational and financial view models produce parity or signed-off explanations for differences.
- [ ] Missing dates, invalid HM/fuel/area, unknown status, duplicate, ambiguous association, and incomplete finance remain visible as quality issues.
- [ ] Duplicate retry, concurrent update, archive, restore, and projection interruption/rollback scenarios are rehearsed.
- [ ] Authentication, authorization, CSRF/session policy, audit trail, least-privilege writer, and secret handling pass review.
- [ ] Backup restore and rollback are tested on a staging copy.
- [ ] Read-only source and no-mutation acceptance checks pass before write scope is considered.

## 13. Implementation roadmap

1. **Decision and evidence gate:** live preflight; confirm duplicate/normalization policy, association overlap and effective dates, refill granularity, finance snapshot selection, document storage, and roles.
2. **Source-contract package:** define typed schemas, controlled enums, stable IDs, source trace, quality issue codes, and compatibility projection contracts. Keep dashboard calculations untouched.
3. **Migration tooling:** create backup/crosswalk, dry-run importer, idempotency, issue report, and reconciliation output; test only on a copied workbook.
4. **Read-only source tables:** populate staging target tabs and create overview projections; compare existing dashboards.
5. **Authentication/security:** implement and test Auth.js/OAuth, server authorization, audit, session/CSRF protections, and user roles before any write handler.
6. **Single safe mutation path:** implement and threat-model server-only repositories, input validation, concurrency and idempotency, soft archive, and controlled projections. Do not enable direct browser-to-Sheets access.
7. **Pilot and gated cutover:** migrate with owner approval, monitor parity and quality, retain rollback source, then consider expanding CRUD.

## Decisions required before CRUD activation

1. Is a pending plot-SPK association created automatically for every plot or when work is assigned?
2. Can two SPKs be active for one plot on overlapping dates, and how are completed/reopened or partial jobs represented?
3. What exact SPK number normalization is allowed while preserving leading zeroes?
4. Are legacy K values individual refill events, and what is the intended date/time when only a day or no date exists?
5. What does each Finance amount mean: contract snapshot, accrued revenue, paid revenue, or another measure? How are snapshot revisions selected?
6. Where are SPK documents stored, and which roles can view them?
7. What actor roles, approval steps, archive rules, concurrency strategy, backup retention, and rollback authority apply?

## 14. Final recap: Version 3.0

The owner confirmed `Version 3.0` as the final recap presentation, not as the master or transaction store. A read-only inspection on 2 November 2026 found these A–U headers, in order:

`No`, `No. SPK`, `Dokumen SPK`, `No. Berita Acara`, `Dokumen Berita Acara`, `No. Pencairan`, `Bukti Pencairan`, `Kode Petak`, `Luas Petak (Ha)`, `Total Konsumsi Solar`, `Tanggal`, `Pengambilan Solar ( L )`, `HM Awal`, `HM Akhir`, `HM Kerja (Jam)`, `Est. Jam Kerja`, `Pengisian Solar (L)`, `Pemakaian Solar per Jam (L/Hr)`, `Pemakaian Solar Riil (L)`, `Status Pekerjaan`, `Keterangan`.

The inspected sheet was a template: numbered rows had no operational records, and row 12 contained totals, formulas, and merged cells. Its total-row date displayed `30/12/1899`; do not interpret that as an activity date. Reinspect before any projection is enabled, since the workbook may change.

The recap must be derived from independently identified petak, optional SPK and administrative documents, operational activities, and solar purchase/refill records. Repeated plot or document metadata in a recap must not duplicate totals. Do not infer document links, disbursement status, or transaction dates.

The owner confirmed that SPK documents, Berita Acara, disbursement evidence, and monitor photos should be uploaded through the website and stored in Google Drive. The spreadsheet is in My Drive, and each authorized user should sign in and grant Drive access with their own Google account. The owner wants the application to find the spreadsheet's parent folder automatically, without a folder picker, and create or reuse an `SPK` subfolder there. Google classifies the broad `drive` scope needed for access to arbitrary existing Drive files as restricted; verification requirements and the consequences of granting access to the user's Drive must be presented before implementation. The narrower `drive.file` scope only covers files created by or explicitly shared with the app and cannot be assumed to provide automatic access to the existing spreadsheet and parent folder. See [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Each user must have appropriate access to the same destination folder; sharing the spreadsheet alone does not establish this. The application must resolve and verify the spreadsheet's parent, reuse a uniquely identified `SPK` folder, fail safely if the folder is inaccessible or ambiguous, and prevent duplicate uploads on retry. Store only a reference and relevant metadata in Sheets. Google OAuth configuration, Drive API permissions, stable document-to-plot association, upload authorization, and file retention remain to be established; do not store file contents or credentials in Sheets. The current form is draft-only and no Drive uploads are enabled.

For each plot's work campaign, the excavator monitor reports cumulative fuel consumption in liters. The owner defined total fuel consumption as `end cumulative reading - start cumulative reading`, supported by the operator's start and end monitor photos. Preserve both readings, their dates and photo references. A missing reading must not produce a total; if the final reading is lower than the initial reading, flag it for review instead of inventing a correction for a reset or meter replacement. Keep separate campaigns separate, and do not count a repeated recap value once per activity row. Do not alter existing dashboard calculations until the new rule, migration, and reconciliation are verified.

