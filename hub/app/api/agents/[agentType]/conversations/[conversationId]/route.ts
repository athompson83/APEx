/**
 * GET    /api/agents/[agentType]/conversations/[conversationId]  — full conversation with messages
 * DELETE /api/agents/[agentType]/conversations/[conversationId]  — archive conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { ConversationStatus } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { agentType: string; conversationId: string } };

// ---------------------------------------------------------------------------
// GET — full conversation with messages
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const conversation = await db.agentConversation.findFirst({
      where: {
        id: params.conversationId,
        organizationId: org.id,
        userId: session.user.id,
      },
      include: {
        agent: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!conversation) return apiError('Conversation not found', 404);

    return apiSuccess({ conversation });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/agents/.../conversations/[conversationId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — archive conversation
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await db.agentConversation.findFirst({
      where: {
        id: params.conversationId,
        organizationId: org.id,
        userId: session.user.id,
      },
    });

    if (!existing) return apiError('Conversation not found', 404);

    await db.agentConversation.update({
      where: { id: params.conversationId },
      data: { status: ConversationStatus.ARCHIVED },
    });

    return apiSuccess({ message: 'Conversation archived' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/agents/.../conversations/[conversationId]]', err);
    return apiError('Internal server error', 500);
  }
}
