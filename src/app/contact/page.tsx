"use client";

import { ArrowLeft, MessageSquare, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 h-16 flex items-center border-b border-border/40 sticky top-0 z-50 bg-background/95 backdrop-blur">
        <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Home
        </Link>
        <div className="flex items-center ml-4 border-l border-border/40 pl-4">
          <MessageSquare className="h-5 w-5 text-emerald-500" />
          <span className="ml-2 font-bold tracking-tight">Contact</span>
        </div>
      </header>

      <main className="flex-1 container max-w-5xl py-16 mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">Get in touch</h1>
            <p className="text-xl text-muted-foreground mb-12">
              Have questions about CTRForge? Our team of YouTube strategists is ready to help you optimize your workflow.
            </p>

            <div className="space-y-8">
              <div className="flex items-start">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mr-4">
                  <Mail className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email Us</h3>
                  <p className="text-muted-foreground text-sm mb-1">For general inquiries and support.</p>
                  <a href="mailto:hello@ctrforge.com" className="text-emerald-500 font-medium text-sm hover:underline">hello@ctrforge.com</a>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mr-4">
                  <MessageSquare className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Priority Agency Support</h3>
                  <p className="text-muted-foreground text-sm mb-1">Dedicated channel for Agency tier customers.</p>
                  <span className="text-emerald-500 font-medium text-sm">Available via Dashboard</span>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mr-4">
                  <MapPin className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Headquarters</h3>
                  <p className="text-muted-foreground text-sm">San Francisco, CA<br />United States</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border/40 rounded-2xl p-8 shadow-sm">
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                  <MessageSquare className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Message Sent</h3>
                <p className="text-muted-foreground">We've received your message and will get back to you within 24 hours.</p>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="mt-8 text-emerald-500 text-sm font-medium hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input required type="text" className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input required type="text" className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input required type="email" className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Inquiry Type</label>
                  <select className="w-full h-11 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors">
                    <option>General Support</option>
                    <option>Billing Question</option>
                    <option>Agency Plan Inquiry</option>
                    <option>Bug Report</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <textarea required rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 transition-colors resize-none"></textarea>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-11 rounded-md bg-emerald-500 text-black font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
