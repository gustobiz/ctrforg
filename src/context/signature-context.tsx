"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  UserSignature, 
  getNormalizedSocialLinks, 
  renderSignatureHtml 
} from '@/lib/email/signature';

export interface GlobalSignatureContextType {
  signature: UserSignature | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSignature: (sig: UserSignature) => void;
  renderedHtml: string;
}

const GlobalSignatureContext = createContext<GlobalSignatureContextType>({
  signature: null,
  loading: true,
  error: null,
  refresh: async () => {},
  updateSignature: () => {},
  renderedHtml: '',
});

export function GlobalSignatureProvider({ children }: { children: React.ReactNode }) {
  const [signature, setSignatureState] = useState<UserSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignature = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/signature', { cache: 'no-store' });
      const data = await res.json();
      console.log('[GlobalSignatureContext] GET /api/signature response:', data);
      if (data.success && data.signature) {
        const rawSig = data.signature;
        const nameStr = rawSig.signature_name || rawSig.display_name || 'Main Outreach';
        const displayStr = rawSig.display_name || rawSig.signature_name || nameStr;
        const roleStr = rawSig.role ?? '';
        
        let contentHtml = rawSig.content_html || '';
        if (!contentHtml || !contentHtml.trim()) {
          contentHtml = `Thanks,<br/><br/><strong>${displayStr}</strong>${roleStr ? `<br/>${roleStr}` : ''}`;
        }

        const normalized: UserSignature = {
          ...rawSig,
          signature_name: nameStr,
          display_name: displayStr,
          role: roleStr,
          content_html: contentHtml,
          social_links: getNormalizedSocialLinks(rawSig),
          is_enabled: rawSig.is_enabled ?? true,
        };

        console.log('[GlobalSignatureContext] setSignatureState():', normalized);
        setSignatureState(normalized);
      } else {
        setError(data.error || 'Failed to fetch signature');
      }
    } catch (err: any) {
      console.error('Failed to fetch signature in GlobalSignatureProvider:', err);
      setError(err.message || 'Failed to fetch signature');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignature();
  }, [fetchSignature]);

  const updateSignature = useCallback((newSig: UserSignature) => {
    console.log('[GlobalSignatureContext] updateSignature():', newSig);
    setSignatureState(newSig);
  }, []);

  const renderedHtml = (signature && signature.is_enabled)
    ? renderSignatureHtml(signature)
    : '';

  return (
    <GlobalSignatureContext.Provider
      value={{
        signature,
        loading,
        error,
        refresh: fetchSignature,
        updateSignature,
        renderedHtml,
      }}
    >
      {children}
    </GlobalSignatureContext.Provider>
  );
}

export function useGlobalSignature(): GlobalSignatureContextType {
  const context = useContext(GlobalSignatureContext);
  if (!context) {
    throw new Error('useGlobalSignature must be used within a GlobalSignatureProvider');
  }
  return context;
}
