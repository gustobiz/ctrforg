/**
 * CTRForge Enrichment Pipeline — GeminiProvider
 * 
 * Invokes Gemini AI to compute deep creator intelligence metrics
 * and lead scoring options. It accepts the consolidated enrichment data
 * (emails, website, social presence, channel statistics) and returns the scoring block.
 * 
 * Preserves the exact same JSON schema and default values as the original scoring pipeline.
 */

import { BaseProvider } from './base';
import { EnrichmentResult, EnrichmentContext, ProviderConfig } from '../types';
import { retryWithJitter } from '../retry';
import { enrichmentLog, LogLevel } from '../logger';

export class GeminiProvider extends BaseProvider {
  readonly name = 'GeminiProvider';
  readonly config: ProviderConfig = {
    enabled: true,
    maxRetries: 2,
    timeoutMs: 15000,
    cacheTtlMs: 30 * 60 * 1000, // 30 minutes
  };

  private geminiKey: string | undefined;

  constructor(geminiKey: string | undefined) {
    super();
    this.geminiKey = geminiKey;
  }

  async execute(ctx: EnrichmentContext): Promise<EnrichmentResult> {
    // This is a scoring provider, it returns scoring fields as EnrichmentResult meta/attributes.
    // For clean merge flow, it calculates these fields and packs them into a custom structure.
    return this.emptyResult(); 
  }

  /**
   * Run Gemini AI Scoring with retry and rich context.
   */
  async computeAIScores(
    ctx: EnrichmentContext,
    mergedContacts: Record<string, any>
  ): Promise<any> {
    if (!this.geminiKey) {
      enrichmentLog(LogLevel.DEBUG, this.name, ctx.channelId, 'No GEMINI_API_KEY — skipping AI analysis');
      return {};
    }

    const email = mergedContacts.contact_email || mergedContacts.support_email || mergedContacts.founder_email || null;

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
      
      const prompt = `You are a YouTube creator intelligence and lead scoring AI.
Analyze this creator channel metadata:
${JSON.stringify({
  channelName: ctx.channelName,
  subscriberCount: ctx.subscriberCount,
  averageViews: ctx.averageViews,
  latestVideoTitle: ctx.latestVideoTitle,
  description: ctx.channelDescription,
  website: mergedContacts.website,
  hasEmail: !!email,
  uploadFrequency: ctx.uploadFrequency,
  channelAge: ctx.channelAge,
  latestVideoUrl: ctx.latestVideoUrl,
  thumbnailUrl: ctx.thumbnailUrl
})}

Compute metrics and return a JSON object with:
{
  "packagingScore": number,
  "curiosityScore": number,
  "opportunityScore": number,
  "buyingScore": number,
  "growthScore": number,
  "replyProbability": number,
  "ctrOpportunity": number,
  "growthPotential": "growing" | "stable" | "declining",
  "brandMaturity": "early" | "established" | "mature",
  "thumbnailQuality": number,
  "titleQuality": number,
  "curiosityGap": "string",
  "visualHierarchy": "string",
  "estimatedBudget": "string",
  "estimatedMonthlyRevenue": "string",
  "estimatedRevenueTier": "string",
  "idealOutreachAngle": "string",
  "decisionMakerConfidence": number,
  "detectedWeaknesses": ["string"],
  "whyThisLead": "string",
  "audienceType": "string",
  "recentTopic": "string",
  "topPerformingVideo": {
    "title": "string",
    "views": "string",
    "url": "string"
  },
  "aiOutreachSummary": "string",
  "thumbnailOpportunityAnalysis": "string"
}
Return ONLY valid JSON. No markdown formatting.`;

      const resultText = await retryWithJitter(
        async () => {
          const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            }),
            signal: AbortSignal.timeout(this.config.timeoutMs)
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
          }

          const json = await response.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) {
            throw new Error('Gemini API returned empty parts');
          }

          return rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        },
        { maxRetries: this.config.maxRetries, baseDelayMs: 1500, label: 'GeminiScoring' }
      );

      return JSON.parse(resultText);

    } catch (err: any) {
      enrichmentLog(LogLevel.ERROR, this.name, ctx.channelId, `Gemini scoring execution failed: ${err.message}`);
      return {};
    }
  }
}
