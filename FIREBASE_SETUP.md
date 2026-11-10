# CostCurve — Firebase Authentication & Cloud Firestore Setup Guide

This guide explains how **CostCurve** is configured with **Firebase Authentication** and **Cloud Firestore**, how strict per-user isolation and Owner/Admin governance work, and how to configure or deploy the app to custom environments (such as GitHub Pages or Vercel).

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
   * **Per-User Financial Isolation**: Every `get`, `list`, `create`, `update`, and `delete` operation on financial collections requires `userId == request.auth.uid` enforced directly by Firestore Security Rules. User A can never read, list, modify, or delete User B's financial records even if the frontend is bypassed.
   * **Owner & Admin Governance**:
     * The primary owner account (`mohamedarman536@gmail.com` with `email_verified == true`) is bootstrapped in `firestore.rules`.
     * Additional administrators are stored in `/admins/{uid}`, which only an existing verified administrator can create, update, or delete.
     * Normal users cannot set or modify admin roles or alter their own account `status` (`active` vs `suspended`).
   * **Sensitive Financial Privacy**: Administrator privileges allow viewing the registered user directory (`/users`), suspending/reactivating accounts, and managing `/admins`, but do **not** expose private user transaction ledgers in bulk.

---

## 2. Enabling Authentication Providers in Firebase Console

By default, provisioning configures **Google Sign-In**. If you also want users to register with **Email & Password**:

1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project (`quaint-rite-rn50x` or your custom project).
2. Navigate to **Build → Authentication → Sign-in method**.
3. Click **Add new provider** → select **Email/Password** → toggle **Enable** → click **Save**.
4. For **GitHub Pages** or custom domains:
   * Navigate to **Authentication → Settings → Authorized domains**.
   * Click **Add domain** and add `mohamedarman.github.io` (or your custom domain) so Firebase allows Google Sign-In popups from your live domain.

---

## 3. Environment Variables (`.env.example`)

In AI Studio, the app automatically loads `/firebase-applet-config.json`. To override the Firebase project in a local or external deployment, copy `.env.example` to `.env` and fill in your public Firebase Web SDK configuration:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000000000
VITE_FIREBASE_FIRESTORE_DATABASE_ID=(default)
VITE_OWNER_ADMIN_EMAIL=mohamedarman536@gmail.com
```

> **Security Note**: Never commit `.env` files or service account private keys to Git. Firebase Web API keys identify your Firebase project to Google servers, and all access control is enforced by `firestore.rules`.

---

## 4. Verification & Security Testing

Run the automated test suite and Firestore security rule linter at any time:

```bash
# Lint Firestore Security Rules
npx eslint firestore.rules

# Run all unit, isolation, and security rule verification tests
npm test

# Type-check and build production bundle
npm run lint
npm run build
```
