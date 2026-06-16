# CMS UX Improvement Notes - Ranking Creator Simplification (Post-P0 backlog)

This document outlines the UX improvement directions designed to reduce operational overhead when creating ranking content.

## Goal
Simplify the ranking creation process by lowering the input burden on operators, separating quick drafting from fine-grained details.

## Proposed Improvements

### 1. Two-Tier Editing Modes (Simplified vs. Detailed)
- Split the ranking creation flow into **Simple Draft Mode** and **Detailed Edit Mode**.
- Operators can quickly publish a draft layout without being forced to fill in all metadata upfront.

### 2. Simple Draft Mode Requirements
- Restrict required fields to the absolute minimum:
  - Title
  - Category
  - Summary
  - Item Rankings (list of items)
  - Editor's Selection Reasons (for each item)
- The draft must be publishable (or ready as a solid draft) using only these fields.

### 3. Automated Criteria Templates
- Instead of forcing operators to manually enter criteria names, descriptions, and weights for every new ranking:
  - Auto-insert pre-configured default templates based on the selected Category.
  - (e.g., A "Tech Product" category automatically gets "Performance", "Value", and "Design" criteria pre-populated).

### 4. Automatic Scope Generation
- Automate the candidate Scope logic instead of manual JSON configuration:
  - Generate the Scope rules automatically using Category, Subcategory, Facets, and Title keywords.

### 5. Collapsible Sources Section
- Collapse the "Sources" block by default or make it entirely optional.
- Hide input fields until the operator explicitly opts to add references.

### 6. Automated SEO Metadata Generation
- Generate `SEO Title` and `SEO Description` automatically on the fly based on the entered Title and Summary.
- Allow override only if needed.

### 7. Detailed Edit Mode Partitioning
- Hide advanced fields from the primary view.
- Expose properties like Weights, Source Type, Score JSON (`score_json`), Sponsor Flags (`sponsor_flag`), and Internal Notes (`internal_note`) exclusively in the **Detailed Edit Mode**.
