import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SPAM_TRIGGER_WORDS = [
  'free', 'money', 'claim', 'winner', 'risk free', 'make money', 'guarantee',
  'limited time', 'urgent', 'act now', 'earn', 'cheap', 'save $', 'pure profit',
  'credit card', 'investment', 'no fees', '100% satisfied', 'amazing', 'cash'
];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { subject = '', htmlBody = '' } = body;

    let healthScore = 100;
    const recommendations: string[] = [];
    const detectedSpamWords: string[] = [];

    // Analyze Subject Line
    const subjectClean = subject.trim();
    if (!subjectClean) {
      healthScore -= 20;
      recommendations.push('Subject line is empty. A descriptive subject is mandatory.');
    } else {
      // Length check
      if (subjectClean.length < 10) {
        healthScore -= 5;
        recommendations.push('Subject line is very short. Aim for 20-50 characters.');
      } else if (subjectClean.length > 60) {
        healthScore -= 10;
        recommendations.push('Subject line is too long (over 60 chars). Keep it compact.');
      }

      // Check ALL CAPS
      if (subjectClean === subjectClean.toUpperCase() && subjectClean.match(/[A-Z]/)) {
        healthScore -= 15;
        recommendations.push('Subject line is fully capitalized. Avoid ALL CAPS as spam filters flag them.');
      }

      // Check exclamations
      const exclamations = (subjectClean.match(/!/g) || []).length;
      if (exclamations > 1) {
        healthScore -= 10;
        recommendations.push('Subject line contains multiple exclamation marks. Avoid hype symbols.');
      }
    }

    // Analyze Body HTML/Text
    const bodyClean = htmlBody.toLowerCase();
    
    // Check spam trigger words
    SPAM_TRIGGER_WORDS.forEach(word => {
      if (bodyClean.includes(word)) {
        detectedSpamWords.push(word);
        healthScore -= 5;
      }
    });

    if (detectedSpamWords.length > 0) {
      recommendations.push(`Detected spam trigger words: "${detectedSpamWords.slice(0, 3).join(', ')}". Try replacing them with milder synonyms.`);
    }

    // Check link count
    const linksMatches = bodyClean.match(/href=["']/gi) || [];
    const linkCount = linksMatches.length;
    if (linkCount > 3) {
      healthScore -= 15;
      recommendations.push(`Contains ${linkCount} links. Emails with >3 links have higher spam scores. Condense to 1-2 essential links.`);
    }

    // Check unsubscribe link
    const hasUnsubscribe = bodyClean.includes('unsubscribe') || bodyClean.includes('opt out') || bodyClean.includes('remove');
    if (!hasUnsubscribe) {
      healthScore -= 15;
      recommendations.push('Missing unsubscribe or opt-out mechanism. Including a clear opt-out improves deliverability and legal compliance.');
    }

    // Ensure score doesn't dip below 0
    healthScore = Math.max(10, healthScore);

    // Save Deliverability Check in Supabase if campaign_id is provided
    const { campaignId } = body;
    if (campaignId) {
      await supabase.from('deliverability_checks').insert({
        user_id: user.id,
        campaign_id: campaignId,
        subject_text: subjectClean,
        spam_score: Number((10 - (healthScore / 10)).toFixed(1)), // Scale 0-10
        spam_words: detectedSpamWords,
        link_count: linkCount,
        has_unsubscribe: hasUnsubscribe,
        health_score: healthScore,
        recommendations: recommendations,
      });
    }

    return NextResponse.json({
      success: true,
      healthScore,
      spamScore: Number((10 - (healthScore / 10)).toFixed(1)),
      detectedSpamWords,
      linkCount,
      hasUnsubscribe,
      recommendations,
    });
  } catch (error: any) {
    console.error('Deliverability check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
