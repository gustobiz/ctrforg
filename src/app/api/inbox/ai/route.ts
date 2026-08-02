import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { mode, snippet, fullThread, draft, leadName } = body;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

    let prompt = '';
    const contextText = fullThread || snippet || 'Lead inquiring about services.';
    const recipientName = leadName || 'there';

    switch (mode) {
      case 'short':
        prompt = `Write a short, polite 1-2 sentence email reply to this prospect message. Keep it concise.\nProspect Message:\n"${contextText}"`;
        break;
      case 'professional':
        prompt = `Write a professional, structured corporate email reply addressing the prospect's points in a clear business tone.\nProspect Message:\n"${contextText}"`;
        break;
      case 'friendly':
        prompt = `Write a warm, enthusiastic, and approachable email reply to build a great relationship with the prospect.\nProspect Message:\n"${contextText}"`;
        break;
      case 'cta':
        prompt = `Write an engaging sales reply asking the prospect for a quick 10-minute discovery call or demo meeting. Offer specific times.\nProspect Message:\n"${contextText}"`;
        break;
      case 'summarize':
        prompt = `Provide a concise 3-bullet point executive summary of key takeaways and actionable intent from this email thread:\n"${contextText}"`;
        break;
      case 'rewrite':
        prompt = `Improve and polish the following draft email response so it is persuasive, error-free, and clean:\nDraft:\n"${draft || snippet}"`;
        break;
      default:
        prompt = `Write a helpful response to this email snippet:\n"${contextText}"`;
    }

    if (GEMINI_API_KEY) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 300,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return NextResponse.json({ success: true, text: generatedText.trim() });
          }
        }
      } catch (geminiErr) {
        console.warn('[INBOX AI API] Gemini call failed, using fallback:', geminiErr);
      }
    }

    // Fallback generator if Gemini is unavailable
    const fallbackText = getFallbackResponse(mode, recipientName, contextText);
    return NextResponse.json({ success: true, text: fallbackText, fallback: true });
  } catch (error: any) {
    console.error('[INBOX AI API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getFallbackResponse(mode: string, name: string, context: string): string {
  switch (mode) {
    case 'short':
      return `Hi ${name},\n\nThanks for following up! I'd be happy to discuss this further. Let me know when you're available for a quick chat.\n\nBest regards,`;
    case 'professional':
      return `Dear ${name},\n\nThank you for reaching out regarding our outreach proposal. We appreciate your response and would be glad to outline how we can tailor our workflow to meet your specific goals.\n\nPlease let me know if you have availability later this week for a brief call.\n\nSincerely,`;
    case 'friendly':
      return `Hey ${name}!\n\nAwesome to hear from you! Thanks for getting back to me. I'd love to jump on a quick call and share a few ideas tailored for you.\n\nHow does tomorrow look for you?\n\nBest,`;
    case 'cta':
      return `Hi ${name},\n\nThanks for your interest! Would you be open to a 10-minute Zoom call this Thursday at 2:00 PM EST to walk through the details?\n\nIf that time doesn't work, feel free to reply with a couple of times that work best for you.\n\nLooking forward to speaking!`;
    case 'summarize':
      return `• Prospect responded to the outreach campaign.\n• Expressed interest in learning more about services.\n• Action Item: Schedule discovery call and share overview documentation.`;
    case 'rewrite':
      return `Hi ${name},\n\nThank you for your response. I wanted to follow up and answer your questions directly so we can move forward seamlessly.\n\nLet me know your thoughts!`;
    default:
      return `Hi ${name},\n\nThanks for your message! Looking forward to connecting further.\n\nBest,`;
  }
}
