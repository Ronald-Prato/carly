/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_conversations from "../agent/conversations.js";
import type * as agent_messages from "../agent/messages.js";
import type * as crons from "../crons.js";
import type * as cv_enrichResume from "../cv/enrichResume.js";
import type * as cv_enrichmentState from "../cv/enrichmentState.js";
import type * as database_hello from "../database/hello.js";
import type * as database_profiles from "../database/profiles.js";
import type * as database_sessions from "../database/sessions.js";
import type * as database_tasks from "../database/tasks.js";
import type * as database_users from "../database/users.js";
import type * as jobs_jobsV2Search from "../jobs/jobsV2Search.js";
import type * as jobs_matchJobsWithCv from "../jobs/matchJobsWithCv.js";
import type * as linkedinCredentials from "../linkedinCredentials.js";
import type * as savedJobOffers from "../savedJobOffers.js";
import type * as storage_resume from "../storage/resume.js";
import type * as storage_resumeSearchHelpers from "../storage/resumeSearchHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/conversations": typeof agent_conversations;
  "agent/messages": typeof agent_messages;
  crons: typeof crons;
  "cv/enrichResume": typeof cv_enrichResume;
  "cv/enrichmentState": typeof cv_enrichmentState;
  "database/hello": typeof database_hello;
  "database/profiles": typeof database_profiles;
  "database/sessions": typeof database_sessions;
  "database/tasks": typeof database_tasks;
  "database/users": typeof database_users;
  "jobs/jobsV2Search": typeof jobs_jobsV2Search;
  "jobs/matchJobsWithCv": typeof jobs_matchJobsWithCv;
  linkedinCredentials: typeof linkedinCredentials;
  savedJobOffers: typeof savedJobOffers;
  "storage/resume": typeof storage_resume;
  "storage/resumeSearchHelpers": typeof storage_resumeSearchHelpers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
