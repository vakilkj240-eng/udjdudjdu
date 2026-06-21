import React, { useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Download, Shield, Calendar, AlertTriangle, TrendingUp } from 'lucide-react';

const NyayIDCard = ({ nyayData }) => {
  const cardRef = useRef(null);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const { nyay_id, case_summary, risk_assessment, complexity, generated_at, next_steps, user_answers } = nyayData;

    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Gavel & Brief - NyayID Report', 15, 20);
    doc.setFontSize(14);
    doc.text(nyay_id, 15, 32);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date(generated_at).toLocaleString()}`, 15, 40);

    // Reset text color
    doc.setTextColor(30, 41, 59);
    let y = 55;

    // Case Summary
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Case Summary', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Category: ${case_summary?.category || 'N/A'}`, 15, y); y += 6;
    doc.text(`Location: ${case_summary?.location || 'N/A'}`, 15, y); y += 6;
    doc.text(`Urgency: ${case_summary?.urgency || 'N/A'}`, 15, y); y += 6;
    
    if (case_summary?.description) {
      const descLines = doc.splitTextToSize(`Description: ${case_summary.description}`, 180);
      doc.text(descLines, 15, y);
      y += descLines.length * 5 + 4;
    }

    // Risk Assessment
    y += 4;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Risk Assessment', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Risk Level: ${risk_assessment?.risk_level || 'N/A'}`, 15, y); y += 6;
    doc.text(`Case Strength: ${risk_assessment?.case_strength || 'N/A'}`, 15, y); y += 6;
    doc.text(`Success Probability: ${risk_assessment?.success_probability || 'N/A'}%`, 15, y); y += 6;

    if (risk_assessment?.warnings?.length > 0) {
      doc.text('Warnings:', 15, y); y += 5;
      risk_assessment.warnings.forEach(w => {
        doc.text(`  - ${w}`, 15, y); y += 5;
      });
    }
    if (risk_assessment?.strengths?.length > 0) {
      doc.text('Strengths:', 15, y); y += 5;
      risk_assessment.strengths.forEach(s => {
        doc.text(`  - ${s}`, 15, y); y += 5;
      });
    }

    // Complexity
    y += 4;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Complexity Assessment', 15, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Level: ${complexity?.level || 'N/A'}`, 15, y); y += 6;
    doc.text(`Est. Duration: ${complexity?.estimated_duration || 'N/A'}`, 15, y); y += 6;
    doc.text(`Est. Cost: ${complexity?.estimated_cost || 'N/A'}`, 15, y); y += 6;

    // Next Steps
    if (next_steps?.length > 0) {
      y += 4;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Recommended Next Steps', 15, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      next_steps.forEach((step, i) => {
        doc.text(`${i + 1}. ${step}`, 15, y); y += 6;
      });
    }

    // Disclaimer
    y += 8;
    doc.setFillColor(255, 251, 235);
    doc.rect(10, y - 4, 190, 20, 'F');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    const disclaimer = 'DISCLAIMER: This analysis is for informational purposes only and does not constitute legal advice. Please consult a qualified legal professional for advice specific to your situation.';
    const discLines = doc.splitTextToSize(disclaimer, 180);
    doc.text(discLines, 15, y + 2);

    doc.save(`Gavel & Brief-${nyay_id}.pdf`);
  };

  if (!nyayData) return null;

  const { nyay_id, case_summary, risk_assessment, complexity, generated_at, next_steps } = nyayData;

  const riskColor = {
    Low: 'text-green-700 bg-green-100',
    Medium: 'text-amber-700 bg-amber-100',
    High: 'text-red-700 bg-red-100'
  };

  return (
    <div ref={cardRef} data-testid="nyayid-card">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 text-sm font-medium">Gavel & Brief NyayID</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide" data-testid="nyayid-value">{nyay_id}</h2>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Calendar className="w-3 h-3" />
                {new Date(generated_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Risk Level</p>
              <span className={`text-sm font-bold px-2 py-0.5 rounded ${riskColor[risk_assessment?.risk_level] || 'text-slate-700 bg-slate-100'}`}>
                {risk_assessment?.risk_level || 'N/A'}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Complexity</p>
              <p className="text-sm font-bold text-slate-800">{complexity?.level || 'N/A'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Success Prob.</p>
              <p className="text-sm font-bold text-slate-800">{risk_assessment?.success_probability || 'N/A'}%</p>
            </div>
          </div>

          {/* Case Summary */}
          <div>
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-3">Case Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Category:</span> <span className="font-medium text-slate-800">{case_summary?.category}</span></div>
              <div><span className="text-slate-500">Location:</span> <span className="font-medium text-slate-800">{case_summary?.location || 'Not specified'}</span></div>
              <div><span className="text-slate-500">Urgency:</span> <span className="font-medium text-slate-800">{case_summary?.urgency || 'Medium'}</span></div>
              <div><span className="text-slate-500">Est. Duration:</span> <span className="font-medium text-slate-800">{complexity?.estimated_duration}</span></div>
            </div>
          </div>

          {/* Risk Details */}
          {risk_assessment?.warnings?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">Warnings</p>
              </div>
              <ul className="space-y-1">
                {risk_assessment.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-700">- {w}</li>
                ))}
              </ul>
            </div>
          )}

          {risk_assessment?.strengths?.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">Strengths</p>
              </div>
              <ul className="space-y-1">
                {risk_assessment.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-green-700">- {s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Steps */}
          {next_steps?.length > 0 && (
            <div>
              <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-3">Recommended Next Steps</h3>
              <ol className="space-y-2">
                {next_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-slate-800 text-white rounded text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-sm text-slate-700">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Cost Estimate */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-2">Cost Estimate</h3>
            <p className="text-2xl font-bold text-slate-800">{complexity?.estimated_cost}</p>
            <p className="text-xs text-slate-500 mt-1">This is an estimate. Actual costs may vary.</p>
          </div>

          {/* Download Button */}
          <button
            onClick={downloadPDF}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            data-testid="download-nyayid-pdf"
          >
            <Download className="w-5 h-5" />
            Download NyayID Report (PDF)
          </button>
        </div>
      </div>
    </div>
  );
};

export default NyayIDCard;
