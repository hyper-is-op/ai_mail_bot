# Decisions: Step 06 - Settings Page Windows 11 Template C Redesign

## 1. Structure of Settings Page (Windows 11 System/Apps Pattern)
- **Choice**: Implement Windows 11 Template C (Hierarchical Category Expander List) for `/settings`:
  - When no specific tab is selected (or user clicks back), render the full-width stacked category cards (like "System" and "Apps" in Screenshots 3 & 4) with icons, subtitles, status pills, and right chevrons.
  - Clicking any category navigates into that category's view with a breadcrumb `← Settings > [Category Name]`.
  - Maintain URL search param synchronization (`?tab=...`) to ensure deep-linking from other pages remains fully functional.
- **Reasoning**: This matches the authentic Windows 11 navigation model where top-level categories expand into detail sub-pages while preserving backward compatibility for bookmarks and direct links.
