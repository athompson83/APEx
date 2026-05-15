/**
 * NextAuth v4 configuration for APEx Hub.
 *
 * Auth strategy : JWT  (no database sessions)
 * Providers     : Credentials (email + bcrypt password)
 *                 Google OAuth — see "Enable Google OAuth" comment below
 *
 * JWT payload extras  : role, orgId, userId
 * Session extras      : user.id, user.role, user.orgId
 *
 * Pages: /login
 *
 * Exports:
 *   handlers   — { GET, POST } for the App Router catch-all route
 *   auth()     — server-side session helper (getServerSession wrapper)
 *   signIn()   — re-exported from next-auth (for server actions)
 *   signOut()  — re-exported from next-auth (for server actions)
 *   authOptions — full config object (for getServerSession in RSC / API routes)
 */

import NextAuth, {
  type NextAuthOptions,
  type DefaultSession,
  type Session,
} from 'next-auth';
import { PrismaAdapter }     from '@auth/prisma-adapter';
import CredentialsProvider   from 'next-auth/providers/credentials';
import { getServerSession }  from 'next-auth/next';
import bcrypt                from 'bcryptjs';
import { PrismaClient }      from '@prisma/client';

// ─── Prisma singleton ─────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

// ─── Module augmentation ──────────────────────────────────────────────────────
// Extend built-in NextAuth types so TypeScript knows about our extra fields.

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: string;
      orgId: string | null;
    };
  }

  interface User {
    role?: string;
    orgId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    role: string;
    orgId: string | null;
  }
}

// ─── NextAuth config ──────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  // @ts-expect-error — @auth/prisma-adapter type slightly mismatches next-auth v4
  adapter: PrismaAdapter(getPrisma()),

  session: {
    strategy: 'jwt',
    maxAge:    30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,      // refresh token every 24 h of activity
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  providers: [
    // ── Credentials (email + password) ──────────────────────────────────────
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email:    { label: 'Email',    type: 'email',    placeholder: 'you@company.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required.');
        }

        const prisma = getPrisma();

        // Case-insensitive email lookup.
        const user = await prisma.user.findFirst({
          where: { email: { equals: credentials.email, mode: 'insensitive' } },
          include: {
            organizations: {
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        });

        if (!user) {
          throw new Error('No account found with that email address.');
        }

        // Hashed passwords are stored in a meta field on the user record.
        // The field is named `passwordHash` but lives under the JSON `settings`
        // column; adapt this to your actual schema as needed.
        const storedHash = (user as unknown as { passwordHash?: string }).passwordHash;

        if (!storedHash) {
          throw new Error(
            'This account uses a social login provider. ' +
              'Please sign in using the appropriate provider.'
          );
        }

        const valid = await bcrypt.compare(credentials.password, storedHash);
        if (!valid) {
          throw new Error('Incorrect password. Please try again.');
        }

        // Resolve the user's primary organisation.
        const orgId = user.organizations[0]?.organizationId ?? null;

        return {
          id:    user.id,
          name:  user.name,
          email: user.email,
          image: user.image,
          role:  user.role as string,
          orgId,
        };
      },
    }),

    // ── Google OAuth ─────────────────────────────────────────────────────────
    // To enable Google OAuth:
    //   1. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local
    //   2. Add your callback URL to Google Cloud Console:
    //      http://localhost:3000/api/auth/callback/google
    //   3. Uncomment the block below.
    //
    // ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    //   ? [
    //       GoogleProvider({
    //         clientId:     process.env.GOOGLE_CLIENT_ID,
    //         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    //         authorization: {
    //           params: { prompt: 'consent', access_type: 'offline', response_type: 'code' },
    //         },
    //       }),
    //     ]
    //   : []),
  ],

  callbacks: {
    // ── jwt ─ runs on sign-in, token refresh, and session update ─────────────
    async jwt({ token, user, trigger, session: updateData }) {
      // Initial sign-in: user object is populated.
      if (user) {
        token.userId = user.id;
        token.role   = (user.role as string) ?? 'VIEWER';
        token.orgId  = (user.orgId as string | null) ?? null;
      }

      // Client-side session.update() call — allow org / role switching.
      if (trigger === 'update' && updateData) {
        const data = updateData as Record<string, unknown>;
        if (typeof data.orgId === 'string')  token.orgId = data.orgId;
        if (typeof data.role  === 'string')  token.role  = data.role;
      }

      return token;
    },

    // ── session ─ shapes the object returned by useSession() / getServerSession() ──
    async session({ session, token }) {
      if (session.user) {
        session.user.id    = token.userId;
        session.user.role  = token.role  ?? 'VIEWER';
        session.user.orgId = token.orgId ?? null;
      }
      return session;
    },

    // ── signIn ─ block unauthenticated / invalid users ────────────────────
    async signIn({ user }) {
      return Boolean(user?.email);
    },

    // ── redirect ─ keep redirects within the same origin ─────────────────
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/'))     return `${baseUrl}${url}`;
      return `${baseUrl}/dashboard`;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug:  process.env.NODE_ENV === 'development',
};

// ─── App Router handlers ──────────────────────────────────────────────────────

const nextAuth = NextAuth(authOptions);

export const handlers = {
  GET:  nextAuth,
  POST: nextAuth,
};

// ─── Server-side helpers ──────────────────────────────────────────────────────

/**
 * Returns the current server-side session, or null when unauthenticated.
 * Use inside Server Components, API Route Handlers, and Server Actions.
 */
export async function auth(): Promise<Session | null> {
  return getServerSession(authOptions);
}

/** Re-export sign-in / sign-out for use in Server Actions. */
export { signIn, signOut } from 'next-auth/react';
