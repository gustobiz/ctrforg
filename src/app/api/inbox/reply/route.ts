import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, htmlToPlainText } from '@/lib/gmail/sender';
import { getValidAccessToken } from '@/lib/gmail/oauth';

// POST /api/inbox/reply — Send reply in Gmail thread and insert outbound message record
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { threadId, parentMessageId, toEmail, subject, htmlBody, campaignId, leadId } = body;

    if (!toEmail || !htmlBody) {
      return NextResponse.json({ error: 'Recipient (toEmail) and reply content (htmlBody) are required' }, { status: 400 });
    }

    console.log(`[INBOX REPLY API] Sending reply to "${toEmail}", threadId: "${threadId || 'none'}"`);

    // Verify Gmail connection
    const tokenData = await getValidAccessToken(user.id);
    if (!tokenData) {
      return NextResponse.json({ error: 'Gmail is not connected. Please connect your Gmail account in Settings.' }, { status: 400 });
    }

    // Format reply subject (ensure "Re: " prefix if not present)
    const replySubject = subject 
      ? (subject.toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`)
      : 'Re: Outreach';

    const plainText = htmlToPlainText(htmlBody);

    // Send email via Gmail API inside the existing thread
    const sendResult = await sendEmail({
      userId: user.id,
      to: toEmail,
      subject: replySubject,
      htmlBody: htmlBody,
      textBody: plainText,
      threadId: threadId || undefined,
      parentGmailMessageId: parentMessageId || undefined,
    });

    console.log(`[INBOX REPLY API] Sent via Gmail — messageId: ${sendResult.messageId}, threadId: ${sendResult.threadId}`);

    // Insert outbound reply into inbox_messages
    const { data: insertedMsg, error: insertError } = await supabase
      .from('inbox_messages')
      .insert({
        user_id: user.id,
        campaign_id: campaignId || null,
        lead_id: leadId || null,
        gmail_message_id: sendResult.messageId,
        gmail_thread_id: sendResult.threadId || threadId || null,
        from_email: tokenData.email,
        to_email: toEmail,
        subject: replySubject,
        snippet: plainText.slice(0, 200),
        body_preview: htmlBody,
        is_inbound: false,
        is_read: true,
        category: 'followup_needed',
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.warn('[INBOX REPLY API] Failed to insert outbound reply to inbox_messages:', insertError.message);
    }

    return NextResponse.json({
      success: true,
      message: insertedMsg || {
        id: `sent_${Date.now()}`,
        from_email: tokenData.email,
        to_email: toEmail,
        subject: replySubject,
        snippet: plainText.slice(0, 200),
        body_preview: htmlBody,
        is_inbound: false,
        is_read: true,
        received_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[INBOX REPLY API] Error sending reply:', error);
    return NextResponse.json({ error: error.message || 'Failed to send reply' }, { status: 500 });
  }
}
