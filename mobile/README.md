# Centre Pitch — Mobile (Expo)

React Native client for Centre Pitch, mirroring flows from the `frontend` (Vite) web app. Styling uses **NativeWind** (Tailwind for React Native). Navigation uses **React Navigation** (to be wired in `src/navigation/`).

This document explains the **intended folder layout** and **navigation paths** so new screens and role-based flows stay consistent.

**Scope:** This README is the **planned** `.js` layout (parity with `frontend/src/pages/`). **Do not scaffold `src/`** until you approve implementation.

### Table of contents

1. [Current status](#current-status)
2. [Tech stack](#tech-stack)
3. [Folder structure](#folder-structure-mobile)
4. [Reusable code (native-first)](#reusable-code-native-first)
5. [What each top-level `src/` area is for](#what-each-top-level-src-area-is-for)
6. [File list note](#file-list-note)
7. [Navigation model](#navigation-model)
8. [Navigation paths reference](#navigation-paths-reference)
9. [Conventions](#conventions)
10. [Scripts](#scripts)
11. [Related repo](#related-repo)

---

## Current status

| Item | State |
|------|--------|
| **Expo app** | `App.js` at project root; NativeWind + `global.css`. |
| **`src/`** | **Not created yet** — tree below is the plan. |
| **Layout** | **Strategy B:** shared routes live **only** in `screens/common/`; role folders hold **role-specific** screens. Pass `role` / `scope` via `route.params` or auth state. |
| **React Navigation** | Add when wiring `src/navigation/` (see [Planned dependencies](#planned-dependencies)). |

### Monorepo layout

```
Centre-Pitch mobile/
├── backend/     # API
├── frontend/    # Vite + React (reference)
└── mobile/      # This Expo app
```

### Planned dependencies

When implementing navigation: `@react-navigation/native`, `@react-navigation/native-stack`, optional `@react-navigation/bottom-tabs`, `react-native-screens`. `react-native-safe-area-context` is already in `package.json`.

---

## Tech stack

| Area        | Choice                          |
|------------|----------------------------------|
| Runtime    | Expo (~54)                       |
| UI         | React Native + NativeWind v4     |
| Navigation | `@react-navigation/native` + native stack (+ tabs where needed) |
| State/API  | Same patterns as web: Redux Toolkit, services (ported over time) |

---

## Folder structure (`mobile/`)

Planned **`.js`** layout:

- **`screens/common/`** — **Single** implementation for routes shared across roles (`Dashboard`, `EventDetails`, `Profile`, …). Drive behavior with **`route.params`** (`role`, `scope`, `id`) and **`useRole()`** / Redux `user`.
- **`screens/<role>/`** — **Only** screens that are **not** shared (admin moderation, player court booking, scorer event list, …).
- **`components/`** + **`sections/`** + **`hooks/`** — **Native-safe** reusable UI and logic (see [Reusable code](#reusable-code-native-first)).

```
mobile/
├── App.js
├── index.js
├── app.json
├── package.json
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── global.css
├── README.md
│
└── src/
    ├── navigation/
    │   ├── AppNavigator.js
    │   ├── AuthNavigator.js
    │   ├── MainNavigator.js          # optional: pick navigator by user.role
    │   ├── linking.js
    │   └── navigators/
    │       ├── PublicNavigator.js
    │       ├── AdminNavigator.js
    │       ├── OrganizerNavigator.js
    │       ├── PlayerNavigator.js
    │       ├── AcademyNavigator.js
    │       ├── CoachNavigator.js
    │       └── ScorerNavigator.js
    │
    ├── constants/
    │   ├── navigation.js
    │   ├── roles.js
    │   └── config.js
    │
    ├── hooks/
    │   ├── useAuth.js
    │   ├── useRole.js
    │   └── useRoleScreen.js          # optional: permissions / API helpers for common screens
    │
    ├── theme/
    │   ├── colors.js
    │   └── spacing.js
    │
    ├── store/
    │   ├── store.js
    │   └── slices/
    │       ├── authSlice.js
    │       ├── uiSlice.js
    │       ├── eventSlice.js
    │       └── notificationSlice.js
    │
    ├── services/
    │   ├── api.js
    │   ├── index.js
    │   ├── academyService.js
    │   ├── academyRoleService.js
    │   ├── adminService.js
    │   ├── authService.js
    │   ├── bookingService.js
    │   ├── coachService.js
    │   ├── coachStudentService.js
    │   ├── coachTeamService.js
    │   ├── coachPayoutService.js
    │   ├── coachingEnrollmentService.js
    │   ├── courtService.js
    │   ├── courtPlanService.js
    │   ├── courtSubscriptionService.js
    │   ├── eventService.js
    │   ├── joinRequestService.js
    │   ├── notificationService.js
    │   ├── organizerService.js
    │   ├── paymentService.js
    │   ├── playerService.js
    │   ├── playerJoinRequestService.js
    │   ├── scorerService.js
    │   ├── sessionService.js
    │   ├── sportService.js
    │   ├── staffService.js
    │   ├── subscriptionService.js
    │   ├── teamService.js
    │   ├── trainingPlanService.js
    │   └── uploadService.js
    │
    ├── utils/
    │   ├── authVerification.js
    │   ├── courtDisplay.js
    │   ├── discoveryVisibility.js
    │   ├── errorHandler.js
    │   ├── helpers.js
    │   ├── publicProfileView.js
    │   └── subscriptionStatus.js
    │
    ├── sections/                    # reusable screen chunks (not routes)
    │   ├── dashboard/
    │   │   ├── StatsRow.js
    │   │   └── QuickActions.js
    │   ├── events/
    │   │   ├── EventListSection.js
    │   │   └── EventFilters.js
    │   ├── bookings/
    │   │   ├── BookingListSection.js
    │   │   └── BookingSummarySection.js
    │   ├── courts/
    │   │   ├── CourtListSection.js
    │   │   └── CourtHeaderSection.js
    │   ├── profile/
    │   │   ├── ProfileHeader.js
    │   │   └── ProfileFields.js
    │   └── notifications/
    │       └── NotificationListSection.js
    │
    ├── components/
    │   ├── common/
    │   │   ├── Avatar.js
    │   │   ├── Badge.js
    │   │   ├── Button.js
    │   │   ├── Card.js
    │   │   ├── CoachAvatar.js
    │   │   ├── CourtImageCarousel.js
    │   │   ├── DataTable.js
    │   │   ├── EmptyState.js
    │   │   ├── FileUpload.js
    │   │   ├── GoogleSignInButton.js
    │   │   ├── Input.js
    │   │   ├── KYCReviewModal.js
    │   │   ├── Loading.js
    │   │   ├── Modal.js
    │   │   ├── Pagination.js
    │   │   ├── ProgressBar.js
    │   │   ├── SearchInput.js
    │   │   ├── Select.js
    │   │   ├── SubscriptionModal.js
    │   │   ├── Table.js
    │   │   ├── TextArea.js
    │   │   └── index.js
    │   ├── layout/
    │   │   ├── DashboardLayout.js
    │   │   ├── Header.js
    │   │   ├── PublicLayout.js
    │   │   ├── Sidebar.js
    │   │   └── index.js
    │   ├── forms/
    │   │   ├── FormField.js
    │   │   └── SubmitButton.js
    │   ├── landingPage/
    │   │   ├── Footer.js
    │   │   ├── Header.js
    │   │   ├── LandingLocationContext.js
    │   │   └── MainLayout.js
    │   ├── court/
    │   │   ├── AvailabilityCalendar.js
    │   │   ├── CourtCard.js
    │   │   ├── CourtForm.js
    │   │   └── SlotPicker.js
    │   ├── booking/
    │   │   ├── BookingCard.js
    │   │   ├── BookingForm.js
    │   │   ├── BookingSummary.js
    │   │   └── PaymentModal.js
    │   ├── coach/
    │   │   ├── ApprovalActions.js
    │   │   ├── CoachCard.js
    │   │   └── CoachForm.js
    │   ├── academy/
    │   │   ├── AcademyCard.js
    │   │   ├── AcademyForm.js
    │   │   ├── AcademyStep1.js
    │   │   ├── AcademyStep2.js
    │   │   ├── AcademyStep3.js
    │   │   ├── AcademyStep4.js
    │   │   ├── AcademyStep5.js
    │   │   ├── ApprovalActions.js
    │   │   └── StatsWidget.js
    │   ├── subscription/
    │   │   └── PricingSection.js
    │   ├── public/
    │   │   └── PublicPlayerLoginPanel.js
    │   ├── hooks/
    │   │   └── useFileUpload.js
    │   ├── LiveMatchesCarousel.js
    │   └── ScrollToTop.js
    │
    └── screens/                     # full-screen routes (RN “pages”)
        ├── common/                  # merged shared routes — register once; use params / role
        │   ├── Dashboard.js
        │   ├── EventDetails.js      # all event detail UIs (public, player, admin, organizer, scorer)
        │   ├── Profile.js
        │   ├── Notifications.js
        │   ├── Teams.js
        │   ├── SubscriptionPlans.js
        │   └── index.js
        ├── auth/
        │   ├── AdminLogin.js
        │   ├── ForgotPassword.js
        │   ├── Login.js
        │   ├── Register.js
        │   ├── ResetPassword.js
        │   └── VerifyAccount.js
        ├── landingPage/
        │   └── Landingpage.js
        ├── pending/
        │   ├── KycUpload.js
        │   └── PendingApproval.js
        ├── public/
        │   ├── Contact.js
        │   ├── Events.js
        │   ├── Home.js
        │   ├── events/
        │   │   └── BrowseEvents.js
        │   ├── academies/
        │   │   ├── AcademyPage.js
        │   │   └── BrowseAcademies.js
        │   ├── coaches/
        │   │   ├── BrowseCoaches.js
        │   │   └── CoachPage.js
        │   └── courts/
        │       ├── BrowseCourts.js
        │       └── CourtPage.js
        ├── bookings/
        │   └── AllBookings.js
        ├── admin/
        │   ├── AllEvents.js
        │   ├── AllPlayers.js
        │   ├── CreateEvent.js
        │   ├── EditEvent.js
        │   ├── EventPublishPricing.js
        │   ├── MyEvents.js
        │   ├── Organizers.js
        │   ├── Queries.js
        │   ├── Registrations.js
        │   ├── Sports.js
        │   ├── SubscriptionHistory.js
        │   ├── academies/
        │   │   ├── AcademyDetails.js
        │   │   ├── AllAcademies.js
        │   │   └── PendingAcademies.js
        │   ├── coaches/
        │   │   ├── AllCoaches.js
        │   │   ├── CoachDetails.js
        │   │   └── PendingCoaches.js
        │   └── courts/
        │       ├── AllCourts.js
        │       └── CourtDetails.js
        ├── organizer/
        │   ├── ContactAdmin.js
        │   ├── CreateEvent.js
        │   ├── EditEvent.js
        │   ├── MatchSchedule.js
        │   ├── MyEvents.js
        │   ├── MyQueries.js
        │   ├── Sports.js
        │   └── Staff.js
        ├── player/
        │   ├── AttendedEvents.js
        │   ├── EventTracker.js
        │   ├── FindAcademy.js
        │   ├── FindCoach.js
        │   ├── FindEvents.js
        │   ├── MyCoachTeams.js
        │   ├── MyEvents.js
        │   ├── MyMatches.js
        │   ├── MySubscriptions.js
        │   ├── SubscriptionDetails.js
        │   ├── TeamInvites.js
        │   ├── TeamRegistration.js
        │   ├── courts/
        │   │   ├── BookCourt.js
        │   │   ├── BrowseCourts.js
        │   │   └── CourtDetails.js
        │   └── bookings/
        │       ├── BookingDetails.js
        │       └── MyBookings.js
        ├── academy/
        │   ├── AdminProfile.js
        │   ├── BookingDetail.js
        │   ├── Bookings.js
        │   ├── CoachDetail.js
        │   ├── CoachList.js
        │   ├── Coaches.js
        │   ├── CourtForm.js
        │   ├── CourtPlanForm.js
        │   ├── CourtPlans.js
        │   ├── Courts.js
        │   ├── JoinRequests.js
        │   ├── Revenue.js
        │   ├── Settings.js
        │   ├── Staff.js
        │   ├── TrainingSessions.js
        │   └── Team/
        │       ├── AllPlayers.js
        │       ├── Players.js
        │       └── TeamDetail.js
        ├── coach/
        │   ├── AddStudent.js
        │   ├── Bookings.js
        │   ├── Sessions.js
        │   ├── Students.js
        │   ├── TeamDetail.js
        │   └── TeamPlayers.js
        └── scorer/
            └── Events.js            # scorer workflow list; row → common/EventDetails.js
```

Optional **barrel** files (not drawn above): e.g. `screens/common/index.js`, `screens/admin/index.js`, `services/index.js` — re-exports only.

### Reusable code (native-first)

Put **UI reuse** in **`components/`** and **`sections/`**; put **shared full-screen routes** in **`screens/common/`**. When porting from web (`frontend/src`), **rewrite** DOM-specific code to React Native primitives — do not copy `div`, `window`, or web-only libraries.

| Layer | Use for | Native notes |
|-------|---------|----------------|
| **`components/`** | Buttons, inputs, cards, modals, lists built from `View`, `Text`, `Pressable`, `TextInput`, `FlatList` / `SectionList` | Prefer **NativeWind** `className` or `StyleSheet`. Use **`expo-image`** or `Image` for images. |
| **`sections/`** | Larger blocks (stats row, filters, profile header, notification list) used inside **multiple** screens | No `react-router` — pass **`navigation`** / data via props. |
| **`hooks/`** | `useAuth`, `useRole`, `useRoleScreen`, data/orientation/keyboard helpers | Pure JS hooks are portable; avoid **`localStorage`** → **SecureStore** / **AsyncStorage**. |
| **`screens/common/`** | Shared routes (`Dashboard`, `EventDetails`, `Profile`, …) | One component; branch with **`route.params`** (`role`, `scope`, `id`) or Redux `user`. |
| **Avoid on RN** | — | **`chart.js` / `react-chartjs-2`** → RN chart library; **`<table>`** → `FlatList` + rows; **`react-icons`** → `@expo/vector-icons`; **CSS-only** layout → Flexbox. |

### What each top-level `src/` area is for

| Path | Purpose |
|------|--------|
| `navigation/` | **Only** navigation trees: stacks, tabs, linking. Keeps routing out of business UI. |
| `navigation/navigators/` | Focused navigators: **public** browsing vs **role-specific** app shells (admin, player, …). |
| `screens/common/` | **Single** copy of cross-role routes; register once; pass **params** / read **role** from auth. |
| `screens/<role>/` | **Role-only** screens (no duplicate `Dashboard` / `Profile` here — use `common/`). |
| `sections/` | Composed chunks shared by multiple screens or roles. |
| `components/` | Small, reusable RN UI pieces. |
| `store/`, `services/` | Global state and HTTP/API — same responsibilities as the web app. |
| `constants/` | **Screen route names** and **user roles** for guards and `navigation.navigate(...)`. |

---

## File list note

Every planned **`.js`** filename lives in the **Folder structure** tree above (single source of truth).

**Merged routes:** `Dashboard`, `EventDetails`, `Profile`, `Notifications`, `Teams`, and `SubscriptionPlans` exist **only** under `screens/common/`. On web, logic may live in multiple files per role — **merge** into these `common` files when porting.

**Role folders** list **non-shared** screens only; paths mirror `frontend/src/pages/<role>/` where a dedicated file still exists on web.

---

## Navigation model

### Root flow (`AppNavigator.js`)

1. **`NavigationContainer`** wraps the app.
2. **Auth gate**: if there is no valid session → show **`AuthNavigator`** (stack: Login, Register, …).
3. If authenticated → show **role-specific navigator** (or a small **Main** switch that picks `PlayerNavigator`, `AdminNavigator`, etc. from `user.role`).

This mirrors the web app’s split between public/auth routes and `DashboardLayout` with `allowedRoles`.

### Navigator naming (conceptual)

| Navigator file | Who it serves | Typical pattern |
|----------------|---------------|-----------------|
| `PublicNavigator.js` | Unauthenticated or generic browse | Stack: landing, home, browse lists, read-only details |
| `AuthNavigator.js` | Sign-in / sign-up | Stack only |
| `AdminNavigator.js` | `superadmin` | Stack or tabs + stack for admin URLs |
| `OrganizerNavigator.js` | Organizer | Tabs + stack for event detail/edit |
| `PlayerNavigator.js` | Player | Tabs + stack |
| `AcademyNavigator.js` | Academy admin | Tabs + stack |
| `CoachNavigator.js` | Coach | Stack or tabs + stack |
| `ScorerNavigator.js` | Scorer | Stack |

Exact tabs vs stacks are decided per role when screens are implemented.

---

## Navigation paths reference

React Navigation uses **screen names** (strings), not URLs. Shared routes use the **same** names as in `screens/common/` (`Dashboard`, `EventDetails`, `Profile`, …) with **`route.params`** for context. The tables below map **logical paths** (web) to **suggested screen names**.

### Auth

| Logical path (web) | Suggested screen name |
|--------------------|------------------------|
| `/login` | `Login` |
| `/adminlogin` | `AdminLogin` |
| `/register` | `Register` |
| `/verify-account` | `VerifyAccount` |
| `/forgot-password` | `ForgotPassword` |
| `/reset-password/:token` | `ResetPassword` |

### Public (browse / marketing)

| Logical path (web) | Suggested screen name |
|--------------------|------------------------|
| `/` (landing) | `Landing` |
| `/home` | `Home` |
| `/events` | `BrowseEvents` |
| `/events/:id` | `EventDetails` (`scope: 'public'` or equivalent param) |
| `/contact` | `Contact` |
| `/academies` | `BrowseAcademies` |
| `/academies/:id` or `/academies/view` | `AcademyPage` |
| `/coaches` | `BrowseCoaches` |
| `/coaches/:id` or `/coaches/view` | `CoachPage` |
| `/courts` | `BrowseCourts` |
| `/courts/:id` | `CourtPage` |

### Pending registration

| Logical path | Suggested screen name |
|--------------|------------------------|
| `/pending/kyc-upload` | `KycUpload` |
| `/pending/approval` | `PendingApproval` |

### Super admin (`superadmin`)

| Logical path prefix | Suggested screen name |
|---------------------|------------------------|
| `/admin/dashboard`, `/admin/profile`, `/admin/notifications`, `/admin/subscriptions` (plans) | `Dashboard`, `Profile`, `Notifications`, `SubscriptionPlans` — **shared** (`screens/common/`), params or auth carry `role: 'superadmin'` |
| `/admin/events`, `/admin/events/:id`, `/admin/events/create` | `AllEvents`, `EventDetails`, `CreateEvent`, … |
| `/admin/academies`, `/admin/academies/:id` | `AllAcademies`, `AcademyDetails`, … |
| `/admin/coaches`, `/admin/coaches/:id` | `AllCoaches`, `CoachDetails`, … |
| `/admin/courts`, `/admin/courts/:id` | `AllCourts`, `CourtDetails` |
| `/admin/bookings` | `AllBookings` |

Use one **stack** under `AdminNavigator`; **params** replace `:id` (e.g. `navigation.navigate('EventDetails', { id, role: 'superadmin' })`).

### Academy admin (`academyadmin`)

| Logical prefix | Notes |
|----------------|--------|
| `/academy/dashboard`, `/academy/profile`, `/academy/notifications`, `/academy/teams` (if applicable) | Shared **`Dashboard`**, **`Profile`**, **`Notifications`**, **`Teams`** from `screens/common/` with **`role: 'academyadmin'`**. |
| Other `/academy/*` | Role-specific files under `screens/academy/` (e.g. `Courts.js`, `Team/TeamDetail.js`). |

### Organizer

| Logical prefix | Notes |
|----------------|--------|
| Dashboard, profile, notifications, teams | Shared common screens with **`role: 'organizer'`**. |
| Events, staff, match schedule, … | `screens/organizer/`. |

### Player

| Logical prefix | Notes |
|----------------|--------|
| Dashboard, profile, notifications, teams, event detail | Shared **`Dashboard`**, **`Profile`**, **`Notifications`**, **`Teams`**, **`EventDetails`**. |
| Courts, bookings, subscription detail, … | `screens/player/courts/`, `bookings/`, `SubscriptionDetails.js`. |

### Coach

| Logical prefix | Notes |
|----------------|--------|
| Dashboard, profile, notifications, teams | Shared common screens with **`role: 'coach'`**. |
| Sessions, students, team detail, … | `screens/coach/`. |

### Scorer

| Logical prefix | Notes |
|----------------|--------|
| Dashboard, notifications, event detail | Shared **`Dashboard`**, **`Notifications`**, **`EventDetails`**. |
| `/scorer/events` (list) | `Events.js` under `screens/scorer/` → navigate to **`EventDetails`**. |

---

## Conventions

- **Files**: use **`.js`** (JSX allowed inside `.js`). Reserve **`.jsx`** only if the team prefers it for screen files; stay consistent.
- **Screen names**: PascalCase. Shared routes from **`screens/common/`** use **one** name each (`Dashboard`, `EventDetails`, …); nested navigators may reuse the same component with different stacks.
- **Params**: pass `id`, **`role`**, **`scope`** (e.g. public vs authenticated), tokens, and filters via `route.params`, not globals.
- **Guards**: centralize “allowed roles for this navigator” to match web `DashboardLayout` behavior.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Expo dev server |
| `npm run android` | Android |
| `npm run ios` | iOS (macOS) |
| `npm run web` | Web (Expo) |

---

## Related repo

- **Web app** (`../frontend`): Port logic into **`screens/common/`** where routes are merged; keep role-specific pages aligned with **`screens/<role>/`**.
- **Backend** (`../backend`): Shared API for web and mobile; authorization remains server-side.
