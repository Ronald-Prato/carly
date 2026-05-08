import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "rotate-linkedin-session-pool",
  { minutes: 30 },
  internal.database.sessions.rotateLinkedInSessionPool,
  {},
);

export default crons;
