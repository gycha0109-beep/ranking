# P1-1.6 PR Summary

This change replaces the non-atomic ranking editor save sequence with a single PostgreSQL transaction. Published rankings are withdrawn to draft as part of the same commit, child collections are replaced atomically, and database-side validation prevents malformed or duplicate relationships from committing.
