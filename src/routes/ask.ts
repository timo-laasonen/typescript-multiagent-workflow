
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/authenticate.ts";
import { answerQuestion } from "../agents/coordinator.ts";

// Schema for validating the request body of the ask route. 

const bodySchema = z.object({
  question: z.string().trim().min(1).max(4000),
}).strict();

// Route for handling user questions to the knowledge assistant. Requires authentication.

export const askRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/api/v1/ask",
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = bodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_REQUEST",
        });
      }

      const user = request.authUser;

      // Defensive check in the route handler as well.
      if (!user) {
        return reply.code(401).send({
          error: "UNAUTHENTICATED",
        });
      }

      try {
        const answer = await answerQuestion(
          user.tenantId,
          parsed.data.question,
        );

        return reply.send({
          answer,
        });
      } catch (error) {
        request.log.error(
          { err: error, subject: user.subject },
          "Agenttipyyntö epäonnistui",
        );

        return reply.code(502).send({
          error: "AGENT_REQUEST_FAILED",
        });
      }
    },
  );
};
