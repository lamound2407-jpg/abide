import "dotenv/config";
import {
  applicationDefault,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  getAuth
} from "firebase-admin/auth";
import {
  FieldValue,
  getFirestore
} from "firebase-admin/firestore";

function requireFirebaseConfig() {
  const projectId =
    String(
      process.env.FIREBASE_PROJECT_ID ||
      "abide-809d9"
    ).trim();

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is not configured. Run: npm run configure:firebase"
    );
  }

  return { projectId };
}

export function getAdminServices() {
  const { projectId } =
    requireFirebaseConfig();

  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId
    });

  return {
    auth: getAuth(app),
    db: getFirestore(app),
    FieldValue
  };
}

export async function resolveTargetUser() {
  const email =
    String(
      process.env.ABIDE_TARGET_EMAIL ||
      ""
    ).trim();

  if (!email) {
    throw new Error(
      "ABIDE_TARGET_EMAIL is not configured. Run: npm run configure:firebase"
    );
  }

  const { auth } =
    getAdminServices();

  const user =
    await auth.getUserByEmail(email);

  return {
    uid: user.uid,
    email: user.email || email
  };
}
