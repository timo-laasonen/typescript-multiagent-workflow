
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";
import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

/*
Note the Keycloak claim structure
This code assumes that:
- iss matches the OIDC_ISSUER setting.
- aud contains the OIDC_AUDIENCE value.
- the role is found in the realm_access.roles claim.
- the tenant identifier is found in the tenant_id claim.
These are example conventions, not the defaults of every Keycloak installation. If you use client roles (resource_access), 
change the role reading to match the claim structure of that client. 
If the tenant is not included in the token, derive it from the server's own user or organization registry.
The JWKS URL construction above matches Keycloak's standard realm endpoint. If your OIDC server uses different routing, 
define the JWKS URL as a separate setting. In production, use HTTPS and trust only a predefined identity provider.
JWT verification must always validate the signature, issuer, audience and expiration. 
The custom authentication function attached to Fastify is intentionally kept separate from the agents' operation.
*/


// Authentication utility for Fastify using OIDC and JWTs

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} puuttuu`);
  return value;
}

// Load and validate required environment variables for OIDC configuration

const issuer = requiredEnv("OIDC_ISSUER");
const audience = requiredEnv("OIDC_AUDIENCE");
const requiredRole = requiredEnv("OIDC_REQUIRED_ROLE");
const tenantClaim = process.env.OIDC_TENANT_CLAIM ?? "tenant_id";

const issuerUrl = new URL(issuer);

if (issuerUrl.protocol !== "https:") {
  throw new Error("OIDC_ISSUER must use HTTPS");
}

const jwks = createRemoteJWKSet(
  new URL(
    `${issuer.replace(/\/$/, "")}/protocol/openid-connect/certs`,
  ),
);

export interface AuthenticatedUser {
  subject: string;
  tenantId: string;
  roles: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthenticatedUser | null;
  }
}

function getRoles(payload: JWTPayload): string[] {
  const realmAccess = payload.realm_access;

  if (
    typeof realmAccess !== "object" ||
    realmAccess === null ||
    !("roles" in realmAccess) ||
    !Array.isArray(realmAccess.roles)
  ) {
    return [];
  }

  return realmAccess.roles.filter(
    (role): role is string => typeof role === "string",
  );
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    await reply.code(401).send({
      error: "UNAUTHENTICATED",
    });
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token || token.length > 16_384) {
    await reply.code(401).send({
      error: "INVALID_TOKEN",
    });
    return;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });

    const roles = getRoles(payload);
    const tenantId = payload[tenantClaim];
    const subject = payload.sub;

    if (
      !subject ||
      typeof tenantId !== "string" ||
      !tenantId.trim()
    ) {
      await reply.code(403).send({
        error: "REQUIRED_CLAIMS_MISSING",
      });
      return;
    }

    if (!roles.includes(requiredRole)) {
      await reply.code(403).send({
        error: "INSUFFICIENT_ROLE",
      });
      return;
    }

    request.authUser = {
      subject,
      tenantId,
      roles,
    };
  } catch {
    await reply.code(401).send({
      error: "INVALID_TOKEN",
    });
  }
}
