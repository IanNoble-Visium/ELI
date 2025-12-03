import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { validateCredentials, getDemoUser, generateToken } from "./auth";
import {
  getEvents,
  getEventById,
  getSnapshotsByEventId,
  getChannels,
  getDashboardMetrics,
  getRecentWebhookRequests,
  insertEvent,
  insertSnapshot,
  upsertChannel,
  insertWebhookRequest,
  getSystemConfig,
  setSystemConfig,
  getIncidentNotes,
  addIncidentNote,
  deleteIncidentNote,
  getIncidentTags,
  addIncidentTag,
  deleteIncidentTag,
  getAllTags,
  purgeOldData,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    /**
     * Hardcoded login with admin/admin credentials
     */
    login: publicProcedure
      .input(
        z.object({
          username: z.string(),
          password: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!validateCredentials(input.username, input.password)) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid credentials",
          });
        }

        const user = getDemoUser();
        const token = await generateToken(user.id);

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        return {
          success: true,
          user,
        };
      }),

    me: publicProcedure.query(({ ctx }) => ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /**
   * Dashboard data endpoints
   */
  dashboard: router({
    metrics: protectedProcedure
      .input(
        z.object({
          startTime: z.number().optional(),
          endTime: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getDashboardMetrics(input?.startTime, input?.endTime);
      }),
  }),

  /**
   * Events endpoints
   */
  events: router({
    list: protectedProcedure
      .input(
        z.object({
          startTime: z.number().optional(),
          endTime: z.number().optional(),
          level: z.string().optional(),
          module: z.string().optional(),
          channelId: z.string().optional(),
          limit: z.number().default(100),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input }) => {
        return await getEvents(input);
      }),

    byId: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const event = await getEventById(input.id);
        if (!event) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Event not found",
          });
        }
        return event;
      }),
  }),

  /**
   * Snapshots endpoints
   */
  snapshots: router({
    byEventId: protectedProcedure
      .input(z.object({ eventId: z.string() }))
      .query(async ({ input }) => {
        return await getSnapshotsByEventId(input.eventId);
      }),
  }),

  /**
   * Channels/Cameras endpoints
   */
  channels: router({
    list: protectedProcedure
      .input(
        z.object({
          region: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getChannels(input);
      }),
  }),

  /**
   * Webhook ingestion endpoints (public for external systems)
   */
  webhook: router({
    /**
     * Modern webhook endpoint - single call with nested data
     */
    irex: publicProcedure
      .input(
        z.object({
          id: z.string(),
          start_time: z.number(),
          topic: z.string().optional(),
          module: z.string().optional(),
          level: z.string().optional(),
          params: z.record(z.string(), z.any()).optional(),
          channel: z.object({
            id: z.string(),
            channel_type: z.string().optional(),
            name: z.string().optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
            address: z.object({
              country: z.string().optional(),
              city: z.string().optional(),
              region: z.string().optional(),
              address: z.string().optional(),
            }).optional(),
            tags: z.array(z.object({
              name: z.string(),
              value: z.string().optional(),
            })).optional(),
          }),
          snapshots: z.array(
            z.object({
              type: z.string(),
              path: z.string().optional(),
              image: z.string().optional(), // Base64 or data URI
            })
          ).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const startTime = Date.now();
        
        try {
          // Upsert channel
          await upsertChannel({
            id: input.channel.id,
            name: input.channel.name || null,
            channelType: input.channel.channel_type || null,
            latitude: input.channel.latitude || null,
            longitude: input.channel.longitude || null,
            address: input.channel.address || null,
            tags: input.channel.tags || null,
            status: "active",
            region: input.channel.address?.region || null,
            policeStation: null,
          });

          // Insert event
          await insertEvent({
            id: input.id,
            eventId: input.id,
            topic: input.topic || null,
            module: input.module || null,
            level: input.level || "info",
            startTime: input.start_time,
            endTime: null,
            latitude: input.channel.latitude || null,
            longitude: input.channel.longitude || null,
            channelId: input.channel.id,
            channelType: input.channel.channel_type || null,
            channelName: input.channel.name || null,
            channelAddress: input.channel.address || null,
            params: input.params || null,
            tags: input.channel.tags || null,
          });

          // Insert snapshots
          if (input.snapshots) {
            for (const snapshot of input.snapshots) {
              await insertSnapshot({
                id: `${input.id}_${snapshot.type}_${Date.now()}`,
                eventId: input.id,
                type: snapshot.type,
                path: snapshot.path || null,
                imageUrl: null, // Would upload to Cloudinary in production
                cloudinaryPublicId: null,
              });
            }
          }

          // Log webhook request
          const processingTime = Date.now() - startTime;
          await insertWebhookRequest({
            endpoint: "/webhook/irex",
            method: "POST",
            payload: input as any,
            eventId: input.id,
            level: input.level || "info",
            module: input.module || null,
            status: "success",
            error: null,
            processingTime,
          });

          return {
            status: "success",
            eventId: input.id,
            processingTime,
          };
        } catch (error) {
          const processingTime = Date.now() - startTime;
          await insertWebhookRequest({
            endpoint: "/webhook/irex",
            method: "POST",
            payload: input as any,
            eventId: input.id,
            level: input.level || "info",
            module: input.module || null,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
            processingTime,
          });

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to process webhook",
            cause: error,
          });
        }
      }),

    /**
     * Get recent webhook requests for real-time viewer
     */
    recent: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ input }) => {
        return await getRecentWebhookRequests(input.limit);
      }),
  }),

  /**
   * Incident notes and tags endpoints
   */
  incidents: router({
    // Get notes for an incident
    getNotes: protectedProcedure
      .input(z.object({ incidentId: z.string() }))
      .query(async ({ input }) => {
        return await getIncidentNotes(input.incidentId);
      }),

    // Add a note to an incident
    addNote: protectedProcedure
      .input(
        z.object({
          incidentId: z.string(),
          note: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await addIncidentNote({
          incidentId: input.incidentId,
          userId: ctx.user.id,
          note: input.note,
        });
        return { success: true };
      }),

    // Delete a note
    deleteNote: protectedProcedure
      .input(z.object({ noteId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteIncidentNote(input.noteId);
        return { success: true };
      }),

    // Get tags for an incident
    getTags: protectedProcedure
      .input(z.object({ incidentId: z.string() }))
      .query(async ({ input }) => {
        return await getIncidentTags(input.incidentId);
      }),

    // Add a tag to an incident
    addTag: protectedProcedure
      .input(
        z.object({
          incidentId: z.string(),
          tag: z.string(),
          color: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await addIncidentTag({
          incidentId: input.incidentId,
          tag: input.tag,
          color: input.color || null,
        });
        return { success: true };
      }),

    // Delete a tag
    deleteTag: protectedProcedure
      .input(z.object({ tagId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteIncidentTag(input.tagId);
        return { success: true };
      }),

    // Get all unique tags
    getAllTags: protectedProcedure.query(async () => {
      return await getAllTags();
    }),
  }),

  /**
   * System configuration endpoints
   */
  config: router({
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return await getSystemConfig(input.key);
      }),

    set: protectedProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.string(),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await setSystemConfig(input.key, input.value, input.description);
        return { success: true };
      }),

    /**
     * Purge old data based on retention policy
     */
    purge: protectedProcedure
      .input(z.object({ retentionDays: z.number().min(1).max(365) }))
      .mutation(async ({ input }) => {
        const result = await purgeOldData(input.retentionDays);
        return {
          success: true,
          ...result,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
