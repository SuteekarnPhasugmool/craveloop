import "dotenv/config";
import { migrate, closeDatabase } from "../src/server/database";
import { env } from "../src/server/env";
await migrate();
console.log(`Migrations applied (${env().driver}).`);
await closeDatabase();
