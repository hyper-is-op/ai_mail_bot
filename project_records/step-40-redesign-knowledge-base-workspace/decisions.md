# Step 40: Decisions - Redesign Knowledge Base Workspace

### 1. Workspace Layout Architecture
- **Options Considered**:
  - *Option A*: Full-width workspace with top KPI strip, 2-tab view (Directory vs Retrieval Sandbox), and an "Add Knowledge" modal dialog with drag-and-drop and text paste.
  - *Option B*: Split studio layout with 60% library on left and 40% upload/test panel on right.
- **Decision**: Option A (selected by user). Removes cramped scrollbars and unifies the page with modern AI SaaS standards (Pinecone, LangChain, Retool).

### 2. Document Inspection & Chunk Transparency
- Allow users to click on any document to inspect its full extracted text and chunk breakdown in a preview modal, improving trust and debuggability for AI drafting context.
