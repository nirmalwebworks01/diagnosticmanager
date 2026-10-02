# Diagnostic Center Management PWA

A clean, fast, and simple Progressive Web App (PWA) designed as a digital replacement for a diagnostic center's handwritten financial register. It automatically handles calculations for patient dues, company payables, referrals, and net profit.

## Features

- **Dashboard**: Real-time financial summary with date filters (Today, Yesterday, This Week, This Month, Custom).
- **Entries**: Complete CRUD functionality to track every patient transaction.
- **Calculations Engine**: Automatically computes Patient Due and Net Profit based on standard formulas.
- **Reports**: Generate specific block reports, print them on A4 paper, or export to CSV.
- **PWA**: Installable on Android, iOS, and Desktop with offline state awareness.
- **Authentication**: Secure, invitation-only Firebase Authentication (no public signup).
- **Firestore**: Secure, per-user data isolation.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend & Auth**: Firebase (Authentication, Firestore)
- **PWA**: `next-pwa`

## Firebase Setup

1. Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** (start in production mode).
3. Enable **Authentication** (Email/Password provider).
4. Register a new Web App in your project settings to get your Firebase config keys.

### Authentication Setup

The application supports exactly two roles: **Admin** and **Staff**.
Public registration is intentionally disabled for security. 

### Creating the First Admin

You must manually create the first Admin user to access the application:

1. Go to **Authentication** > **Users** in the Firebase Console.
2. Click **Add User**.
3. Enter an email and password. Copy the generated `UID` for this user.
4. Go to **Firestore Database** in the Firebase Console.
5. Create a new collection called `users`.
6. Add a document with the Document ID exactly matching the `UID` you copied.
7. Add the following fields to the document:
   - `uid` (string) = The same UID
   - `name` (string) = Admin's full name
   - `email` (string) = Admin's email
   - `role` (string) = "admin"
   - `active` (boolean) = true
   - `createdAt` (string) = current date (e.g. `2024-01-01T00:00:00.000Z`)
   - `updatedAt` (string) = current date

Once logged in as Admin, you can easily create **Staff** users directly from the `Settings > Users` menu inside the application.

### Firestore Setup

Your Firestore instance requires a composite index to run the date-range queries efficiently.

Deploy the indexes using the Firebase CLI, or allow the app to generate a link in the console error the first time you run a custom date range query:

```json
{
  "indexes": [
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Security Rules

Go to **Firestore Database** > **Rules** and apply the following to ensure complete data privacy:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() { return request.auth != null; }
    function getUserData() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function isActiveUser() { return isAuthenticated() && getUserData().active == true; }
    function isAdmin() { return isActiveUser() && getUserData().role == 'admin'; }
    function isStaff() { return isActiveUser() && getUserData().role == 'staff'; }
    function isAuthorizedUser() { return isAdmin() || isStaff(); }

    match /{document=**} { allow read, write: if false; }

    match /users/{userId} {
      allow read: if isAuthorizedUser();
      allow create, update: if isAdmin();
      allow delete: if false;
    }

    match /entries/{entryId} {
      allow read: if isAuthorizedUser();
      allow create, update: if isAuthorizedUser();
      allow delete: if isAdmin();
    }

    match /referrers/{referrerId} {
      allow read: if isAuthorizedUser();
      allow create, update: if isAuthorizedUser();
      allow delete: if isAdmin();
    }
  }
}
```

## Environment Variables

Copy the provided example file:

```bash
cp .env.local.example .env.local
```

Fill in your `.env.local` with the keys from your Firebase Project Settings:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Never commit `.env.local` to version control.**

## Running Locally

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

To verify the build or run the production bundle locally:

```bash
npm run build
npm run start
```

## Deployment Instructions

The application is fully optimized for [Vercel](https://vercel.com).

1. Push your code to a GitHub repository.
2. Import the project into Vercel.
3. In the Vercel project settings, add all the environment variables from your `.env.local`.
4. Deploy!

## PWA Installation

Once deployed (or running locally on HTTPS), users can install the app:
- **Chrome Desktop**: Click the install icon (monitor with a down arrow) in the right side of the URL bar.
- **Android**: Tap the 3-dot menu in Chrome and select "Install app" or "Add to Home screen".
- **iOS**: Tap the Share button in Safari and select "Add to Home Screen".
