import "dotenv/config";
import {
  resolveTargetUser
} from "./firebaseAdmin.js";

try {
  const user =
    await resolveTargetUser();

  console.log(
    "✓ Firebase Admin connected to abide-809d9"
  );
  console.log(
    `✓ Bridge target: ${user.email}`
  );
  console.log(
    "✓ UID resolved"
  );
} catch (error) {
  console.error(
    `ERROR: ${error.message}`
  );
  process.exit(1);
}
