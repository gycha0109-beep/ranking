# Error Log - Login & Sign-Up Flow Fixes

## Issues Identified

### 1. Stuck Sign-up Button (UI Freeze)
- **Symptom**: Clicking the sign-up button changes its state to disabled (with the loading spinner) but it remains disabled indefinitely without showing any error feedback.
- **Root Cause**:
  - The React 19 `useTransition` was wrapping the asynchronous calls to `signUp` and `signIn` inside `startTransition`.
  - When an asynchronous error occurred (such as Supabase Auth rejects or connection failures), the promise inside `startTransition` was rejected. Under certain configurations or when unhandled by Try-Catch inside the transition, `isPending` remained stuck in `true`.
  - This prevented the button from ever being re-enabled upon action failure.

### 2. Missing Admin Bootstrap in SignUp Action
- **Symptom**: Users logging in as `ADMIN_BOOTSTRAP_EMAIL` for the first time after signing up did not get their admin role automatically assigned in `user_roles`.
- **Root Cause**:
  - The role bootstrapping logic was previously hardcoded directly within the `signIn` action and did not exist inside `signUp` action at all.
  - This meant that if a user completed sign-up, there was no auto-elevation attempt until a subsequent manual sign-in occurred, and even then, any failure during the transition caused the UI to break.

### 3. Inconsistent Action Response Format
- **Symptom**: Type conflicts and runtime property access issues in `LoginForm.tsx` when accessing error and message fields.
- **Root Cause**:
  - `signIn` returned `{ error: ... }` on failure and `{ success: true }` on success.
  - `signUp` returned `{ error: ... }` on failure and `{ success: true, message: ... }` on success.
  - The lack of a standardized result structure made it fragile to scale or map consistently to states in frontend forms.

---

## Resolution Steps

1. **Standardized Server Action Result Object**:
   - Refactored `signIn` and `signUp` in `src/lib/actions/auth.ts` to return:
     - Success: `{ ok: true, message?: string }`
     - Failure: `{ ok: false, error: string }`

2. **Implemented Robust Error Recovery in UI**:
   - Replaced `useTransition` with explicit `useState(false)` state management in `src/app/login/LoginForm.tsx`.
   - Wrapped form submission within a `try-catch-finally` block to guarantee that `isPending` is set to `false` when the async operations finish, successfully resolving the button freeze issue.

3. **Created Unified Admin Bootstrap Helper**:
   - Extracted bootstrap logic to `ensureBootstrapAdminRole(user)` helper.
   - Handled cases where `SUPABASE_SERVICE_ROLE_KEY` is missing by warning in console and skipping the process instead of failing the signup/login flow completely.
   - Handled email matching case-insensitively using `trim().toLowerCase()`.
   - Integrated this helper inside both `signIn` and `signUp`.
