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
import type * as cv_enrichResume from "../cv/enrichResume.js";
import type * as cv_enrichmentState from "../cv/enrichmentState.js";
import type * as database_hello from "../database/hello.js";
import type * as database_profiles from "../database/profiles.js";
import type * as database_tasks from "../database/tasks.js";
import type * as database_users from "../database/users.js";
import type * as storage_resume from "../storage/resume.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/conversations": typeof agent_conversations;
  "agent/messages": typeof agent_messages;
  "cv/enrichResume": typeof cv_enrichResume;
  "cv/enrichmentState": typeof cv_enrichmentState;
  "database/hello": typeof database_hello;
  "database/profiles": typeof database_profiles;
  "database/tasks": typeof database_tasks;
  "database/users": typeof database_users;
  "storage/resume": typeof storage_resume;
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
