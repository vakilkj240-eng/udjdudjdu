import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2, Brain, CheckCircle, FileImage, File, ChevronDown, ChevronUp } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const FILE_ICONS = {
  'application/pdf': { Icon: FileText, color: 'text-red-500', bg: 'bg-red-50', label: 'PDF' },
  'image/png': { Icon: FileImage, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Image' },
  'image/jpeg': { Icon: FileImage, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Image' },
  'image/webp': { Icon: FileImage, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Image' },
  'text/plain': { Icon: File, color: 'text-green-500', bg: 'bg-green-50', label: 'TXT' },
};

const extractPdfText = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  return fullText.trim();
};

const extractImageText = async (file, onProgress) => {
  const worker = await createWorker('eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
  return text.trim();
};

const extractTxtText = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const DocumentUpload = ({ onTextExtracted, onAnalyze, analyzing = false }) => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [done, setDone] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    setFiles(acceptedFiles);
    setExtractedText('');
    setDone(false);
    setShowPreview(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    maxFiles: 3,
    maxSize: 20 * 1024 * 1024,
  });

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setExtractedText('');
    setDone(false);
  };

  const handleExtract = async (autoAnalyze = false) => {
    if (files.length === 0) return;
    setProcessing(true);
    setProgress(0);
    setProgressLabel('Starting extraction...');

    try {
      let allText = '';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressLabel(`Processing ${file.name}...`);

        if (file.type === 'application/pdf') {
          setProgressLabel(`Reading PDF: ${file.name}...`);
          const text = await extractPdfText(file);
          allText += text + '\n\n';
          setProgress(Math.round(((i + 1) / files.length) * 100));
        } else if (file.type.startsWith('image/')) {
          setProgressLabel(`Running OCR on ${file.name}...`);
          const text = await extractImageText(file, (p) => {
            const base = (i / files.length) * 100;
            setProgress(Math.round(base + (p / files.length)));
          });
          allText += text + '\n\n';
        } else if (file.type === 'text/plain') {
          setProgressLabel(`Reading ${file.name}...`);
          const text = await extractTxtText(file);
          allText += text + '\n\n';
          setProgress(Math.round(((i + 1) / files.length) * 100));
        }
      }

      const cleaned = allText.trim();
      setExtractedText(cleaned);
      setDone(true);
      setProgress(100);
      setProgressLabel('Extraction complete!');

      if (onTextExtracted) onTextExtracted(cleaned);
      if (autoAnalyze && onAnalyze && cleaned) onAnalyze(cleaned);
    } catch (err) {
      console.error('Extraction error:', err);
      setProgressLabel('Extraction failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getFileInfo = (file) => FILE_ICONS[file.type] || { Icon: File, color: 'text-slate-500', bg: 'bg-slate-50', label: 'FILE' };

  if (files.length === 0) {
    return (
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
          isDragActive ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 bg-white'
        }`}
        data-testid="dropzone"
      >
        <input {...getInputProps()} data-testid="file-input" />
        <Upload className={`w-9 h-9 mx-auto mb-3 ${isDragActive ? 'text-amber-500' : 'text-slate-300'}`} />
        <p className="text-sm font-semibold text-slate-700 mb-1">
          {isDragActive ? 'Drop it here!' : 'Upload your document'}
        </p>
        <p className="text-xs text-slate-400">PDF, JPG, PNG, TXT &nbsp;·&nbsp; Max 20 MB &nbsp;·&nbsp; Up to 3 files</p>
        <div className="mt-4 flex justify-center gap-3">
          {['PDF', 'JPG/PNG', 'TXT'].map(t => (
            <span key={t} className="text-xs bg-white border border-slate-200 text-slate-500 px-2.5 py-1 rounded-lg">{t}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="document-upload">
      {/* File list */}
      <div className="space-y-2">
        {files.map((file, index) => {
          const { Icon, color, bg, label } = getFileInfo(file);
          return (
            <div key={index} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5"
              data-testid={`uploaded-file-${index}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate max-w-[220px]">{file.name}</p>
                  <p className="text-xs text-slate-400">{label} · {(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              {!processing && (
                <button onClick={() => removeFile(index)} className="text-slate-300 hover:text-red-400 transition-colors ml-2">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add more files */}
      {!processing && !done && (
        <div {...getRootProps()} className="text-center text-xs text-slate-400 py-1.5 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 transition-colors">
          <input {...getInputProps()} />
          + Add another file
        </div>
      )}

      {/* Progress bar */}
      {processing && (
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
            <p className="text-xs font-medium text-slate-700">{progressLabel}</p>
          </div>
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{progress}% complete</p>
        </div>
      )}

      {/* Extracted text preview */}
      {done && extractedText && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-700">Text extracted — {extractedText.split(/\s+/).length} words found</span>
            </div>
            <button onClick={() => setShowPreview(p => !p)} className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800">
              {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showPreview ? 'Hide' : 'Preview'}
            </button>
          </div>
          {showPreview && (
            <p className="text-xs text-green-900 whitespace-pre-line max-h-32 overflow-y-auto leading-relaxed border-t border-green-200 pt-2 mt-1">
              {extractedText.slice(0, 800)}{extractedText.length > 800 ? '…' : ''}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {!processing && !done && (
        <div className="flex gap-2">
          <button
            onClick={() => handleExtract(false)}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            data-testid="extract-text-btn"
          >
            <FileText className="w-4 h-4" /> Extract Text Only
          </button>
          {onAnalyze && (
            <button
              onClick={() => handleExtract(true)}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              data-testid="extract-analyze-btn"
            >
              <Brain className="w-4 h-4" /> Extract & Analyse
            </button>
          )}
        </div>
      )}

      {done && !processing && (
        analyzing ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-amber-500 animate-spin flex-shrink-0" />
            <p className="text-xs font-medium text-amber-700">Analysing extracted text with AI — please wait...</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setFiles([]); setExtractedText(''); setDone(false); }}
              className="flex-1 border border-slate-200 text-slate-600 text-sm py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Upload Another
            </button>
            {onAnalyze && (
              <button
                onClick={() => onAnalyze(extractedText)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Brain className="w-4 h-4" /> Analyse This
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default DocumentUpload;
