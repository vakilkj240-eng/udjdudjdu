import React from 'react';
import { Scale } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background px-6 md:px-12 py-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-2 mb-2 md:mb-0">
          <Scale className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="font-serif font-bold text-primary text-sm">Gavel &amp; Brief</p>
            <p className="text-xs text-foreground/55 max-w-xs leading-relaxed mt-0.5">
              AI-powered legal intelligence connecting clients and lawyers through smart case analysis, document drafting, and predictive analytics.
            </p>
          </div>
        </div>
        <div className="text-xs text-foreground/40 max-w-md leading-relaxed">
          <span className="font-semibold text-foreground/55">Disclaimer:</span> Gavel &amp; Brief is an AI-assisted legal technology platform and does not constitute legal advice. All information provided is for informational purposes only. Please consult a qualified legal professional for advice specific to your situation.
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-border/50 text-center text-xs text-foreground/30">
        © {new Date().getFullYear()} Gavel &amp; Brief. All rights reserved.
      </div>
    </footer>
  );
}
