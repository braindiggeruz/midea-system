import { getLeadAcquisitionAnalytics } from "./server/db.ts";

process.env.DATABASE_URL = "";

const adminScope = { userId: 1, role: "admin" };
const managerScope = { userId: 2, role: "manager" };

const admin = await getLeadAcquisitionAnalytics(adminScope);
const manager = await getLeadAcquisitionAnalytics(managerScope);

console.log(JSON.stringify({ admin, manager }, null, 2));
