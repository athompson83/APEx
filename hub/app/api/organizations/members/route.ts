/**
 * GET    /api/organizations/members  — list members
 * POST   /api/organizations/members  — invite member (placeholder)
 * DELETE /api/organizations/members  — remove member
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { OrgMemberRole } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
  paginationParams,
} from '@/lib/api/helpers';

async function requireAdminOrOwner(userId: string, organizationId: string) {
  const membership = await db.organizationMember.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw apiError('Forbidden: insufficient permissions', 403);
  }
  return membership;
}

// ---------------------------------------------------------------------------
// GET — list members
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);

    const [members, total] = await Promise.all([
      db.organizationMember.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true, createdAt: true },
          },
        },
      }),
      db.organizationMember.count({ where: { organizationId: org.id } }),
    ]);

    return apiSuccess({
      members: members.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/organizations/members]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — invite member (placeholder — real impl would send an email invite)
// ---------------------------------------------------------------------------

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(OrgMemberRole).default(OrgMemberRole.MEMBER),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);
    await requireAdminOrOwner(session.user.id, org.id);

    const body = await req.json();
    const input = validateRequest(inviteMemberSchema, body);

    // Look up existing user by email
    const invitee = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true },
    });

    if (!invitee) {
      // TODO: send invitation email and create pending invite record
      return apiSuccess(
        {
          message: 'Invitation sent',
          status: 'pending',
          email: input.email,
          role: input.role,
        },
        202,
      );
    }

    // Check if already a member
    const existing = await db.organizationMember.findUnique({
      where: { userId_organizationId: { userId: invitee.id, organizationId: org.id } },
    });
    if (existing) return apiError('User is already a member of this organisation', 409);

    const member = await db.organizationMember.create({
      data: {
        userId: invitee.id,
        organizationId: org.id,
        role: input.role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return apiSuccess(
      {
        message: 'Member added',
        member: {
          id: member.id,
          role: member.role,
          joinedAt: member.createdAt,
          user: member.user,
        },
      },
      201,
    );
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/organizations/members]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove member
// ---------------------------------------------------------------------------

const removeMemberSchema = z.object({
  userId: z.string().cuid(),
});

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);
    await requireAdminOrOwner(session.user.id, org.id);

    const body = await req.json();
    const input = validateRequest(removeMemberSchema, body);

    // Prevent removing yourself
    if (input.userId === session.user.id) {
      return apiError('Cannot remove yourself from the organisation', 400);
    }

    // Prevent removing the owner
    const targetMembership = await db.organizationMember.findUnique({
      where: { userId_organizationId: { userId: input.userId, organizationId: org.id } },
    });
    if (!targetMembership) return apiError('Member not found', 404);
    if (targetMembership.role === OrgMemberRole.OWNER) {
      return apiError('Cannot remove the organisation owner', 403);
    }

    await db.organizationMember.delete({
      where: { userId_organizationId: { userId: input.userId, organizationId: org.id } },
    });

    return apiSuccess({ message: 'Member removed' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/organizations/members]', err);
    return apiError('Internal server error', 500);
  }
}
