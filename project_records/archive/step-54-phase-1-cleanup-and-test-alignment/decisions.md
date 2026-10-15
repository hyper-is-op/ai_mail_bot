# Step 54: Decisions - Phase 1 Repository Cleanup & Test Alignment

## 1. Zero-Risk File Deletion
- **Choice**: Permanently remove unreferenced scratchpads and orphan files (`.Test_files/`, `qdrant_storage/`, `frontend/src/components/LangGraphVisualizer.tsx`, `frontend/src/pages/auth/ApproveRegistration.tsx`, `Email_Bot_Architecture.pdf`, `scripts/generate_flow_pdf.py`).
- **Rationale**: These files have zero references across runtime services, frontend routes, or production compose definitions. Removing them immediately frees disk space and removes developer confusion.

## 2. Test Suite Alignment via File Rename
- **Choice**: Rename `tests/realworld_scenarios_test.py` to `tests/test_realworld_scenarios.py` rather than deleting it.
- **Rationale**: This file contains 15.7 KB of comprehensive end-to-end multi-turn scenario tests. The standard test discovery pattern in `tests/run_all.py` searches for `test_*.py`. Renaming it restores automated testing of real-world dialogue flows without modifying test logic.

## 3. Git Status Sanitation
- **Choice**: Stage the removals of dead `project_docs/*` files and deleted frontend pages (`ApiTesting.tsx`, `OrderTracking.tsx`, `SystemHealth.tsx`).
- **Rationale**: These files were already physically deleted from disk in past refactoring steps, but remained as noisy unstaged deletions in git status.

## 4. Project Records Maintenance (Steps 01-30 Archival)
- **Choice**: Archive `step-01` through `step-30` into `project_records/archive/` and update `index.md` with an archival pointer.
- **Rationale**: `project_records/index.md` exceeded 50 entries (54 entries total), triggering mandatory archival per `project_records_maintenance.md`.
