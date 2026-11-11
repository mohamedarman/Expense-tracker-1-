# CostCurve — Firebase Authentication & Cloud Firestore Setup Guide

This guide explains how **CostCurve** is configured with **Firebase Authentication** and **Cloud Firestore**, how strict per-user isolation and Owner/Admin governance work, and how to deploy to GitHub Pages without triggering GitHub Secret Scanning alerts.

---

## 1. Architecture Overview

1. **Authentication (`src/firebase.ts`, `src/api.ts`, `src/components/AuthModal.tsx`)**
   * Uses **Firebase Authentication** (`firebase/auth`).
   * Passwords are never stored in `localStorage`, JSON files, or Firestore documents.
   * Supports 1-click **Google Sign-In** (`signInWithPopup`) out of the box, plus **Email & Password** authentication.

2. **Cloud Database (`firestore.rules`, `firebase-blueprint.json`)**
   * All user profiles and financial data are stored in **Cloud Firestore** across 9 collections:
     * `/users/{userId}` — Student profile, currency, allowance targets, and account status (`active` | `suspended`).
     * `/admins/{adminId}` — Server/Owner-controlled administrator registry.
     * `/categories/{categoryId}` — User-owned custom categories (merged with static default student categories).
     * `/transactions/{transactionId}` — Private income and expense ledger entries (`userId == request.auth.uid`).
     * `/budgets/{budgetId}` — Monthly category budget limits (`userId == request.auth.uid`).
     * `/savingsGoals/{goalId}` — Savings goal vaults (`userId == request.auth.uid`).
     * `/recurringPayments/{recurringId}` — Recurring hostel, mess, and subscription bills (`userId == request.auth.uid`).
     * `/splitExpenses/{splitId}` — Shared roommate/classmate bill splits (`userId == request.auth.uid`).
     * `/debts/{debtId}` — Peer IOU records (`userId == request.auth.uid`).

3. **Zero-Trust Security Rules (`firestore.rules`)**
   * **Per-User Financial Privacy**: Every `get`, `list`, `create`, `update`, and `delete` operation on financial collections requires `userId == request.auth.uid` enforced directly by Firestore Security Rules. User A can never read, list, modify, or delete User B's financial records.
   * **Owner & Admin Governance**:
     * The primary owner account (`costcurveexpensetracker@gmail.com` with `email_verified == true`) is bootstrapped in `firestore.rules`.
     * Additional administrators are stored in `/admins/{uid}`, which only an existing verified administrator can create, update, or delete.
     * Normal users cannot set or modify admin roles or alter their own account `status` (`active` vs `suspended`).

---

## 2. Preventing GitHub Secret Scanning Alerts (`firebase-applet-config.json` & `docs/`)

GitHub automatically scans pushed commits for strings starting with `AIzaSy...` (Google/Firebase API keys). To keep your GitHub repository 100% free of secret scanning alerts:

1. **`firebase-applet-config.json` and `docs/` are gitignored**:
   * Both `firebase-applet-config.json` and `docs/` are listed in `.gitignore`, and the tracked `docs/` build folder has been removed because GitHub Actions deploys directly from `./dist`.
   * If `firebase-applet-config.json` was already committed in an earlier commit on GitHub, run this once in your local Git repo before pushing:
     ```bash
     git rm --cached firebase-applet-config.json
     git commit -m "Stop tracking local firebase config"
     git push
     ```
2. **Restrict Your API Key in Google Cloud Console (Recommended Best Practice)**:
   * Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
   * Click your Browser/Firebase API key → under **Application restrictions**, select **Websites** and add:
     * `https://mohamedarman.github.io/*`
     * `https://*.run.app/*`
     * `https://quaint-rite-rn50x.firebaseapp.com/*`
   * Save and close the alert in your GitHub repository under **Security → Secret scanning alerts**.
3. **Add Your Firebase Config as GitHub Repository Secrets**:
   * In your GitHub repository (`mohamedarman/Expense-tracker-1-`), go to **Settings → Secrets and variables → Actions → New repository secret** and add:
     * `VITE_FIREBASE_API_KEY`
     * `VITE_FIREBASE_AUTH_DOMAIN`
     * `VITE_FIREBASE_PROJECT_ID`
     * `VITE_FIREBASE_STORAGE_BUCKET`
     * `VITE_FIREBASE_MESSAGING_SENDER_ID`
     * `VITE_FIREBASE_APP_ID`
     * `VITE_FIREBASE_FIRESTORE_DATABASE_ID`
   * `.github/workflows/static.yml` and `.github/workflows/ci.yml` automatically inject these secrets at build time.

---

## 3. Enabling Authentication Providers in Firebase Console

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Navigate to **Build → Authentication → Sign-in method**.
3. Ensure **Google** is enabled, and optionally enable **Email/Password**.
4. Under **Authentication → Settings → Authorized domains**, add `mohamedarman.github.io` so Google Sign-In popups work on your GitHub Pages URL.

---

## 4. Environment Variables (`.env.example`)

Copy `.env.example` to `.env` for local development outside AI Studio:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
# Optional: Leave blank for standard default Firestore databases
VITE_FIREBASE_FIRESTORE_DATABASE_ID=
VITE_OWNER_ADMIN_EMAIL=costcurveexpensetracker@gmail.com
```
