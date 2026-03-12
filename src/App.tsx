import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Upload, Download, Image as ImageIcon, X, CheckCircle2, 
  AlertCircle, Loader2, Sliders, FolderOpen, RefreshCcw, 
  FileText, Maximize2, RotateCw, FlipHorizontal, Settings2,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

type OutputFormat = 'image/webp' | 'image/png' | 'image/jpeg';

interface ConversionSettings {
  format: OutputFormat;
  quality: number;
  resize: {
    enabled: boolean;
    width: number;
    height: number;
    maintainAspectRatio: boolean;
  };
  rotation: number;
  flip: {
    horizontal: boolean;
    vertical: boolean;
  };
}

interface ConversionResult {
  id: string;
  originalName: string;
  originalSize: number;
  convertedBlob: Blob;
  convertedUrl: string;
  convertedSize: number;
  width: number;
  height: number;
  status: 'pending' | 'converting' | 'success' | 'error';
  format: string;
}

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<ConversionSettings>({
    format: 'image/webp',
    quality: 0.85,
    resize: {
      enabled: false,
      width: 0,
      height: 0,
      maintainAspectRatio: true,
    },
    rotation: 0,
    flip: {
      horizontal: false,
      vertical: false,
    },
  });
  
  const [isConverting, setIsConverting] = useState(false);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [view, setView] = useState<'upload' | 'settings' | 'results'>('upload');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (selectedFiles: FileList | File[]) => {
    const validFiles = Array.from(selectedFiles).filter(file => 
      file.type.startsWith('image/')
    );

    if (validFiles.length === 0) {
      setError('Veuillez sélectionner au moins une image.');
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    setError(null);
    setView('settings');
  };

  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const processFile = async (file: File, s: ConversionSettings): Promise<ConversionResult> => {
    const id = Math.random().toString(36).substring(7);
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      let targetWidth = img.width;
      let targetHeight = img.height;

      if (s.resize.enabled) {
        if (s.resize.width > 0 && s.resize.height > 0) {
          if (s.resize.maintainAspectRatio) {
            const ratio = Math.min(s.resize.width / img.width, s.resize.height / img.height);
            targetWidth = img.width * ratio;
            targetHeight = img.height * ratio;
          } else {
            targetWidth = s.resize.width;
            targetHeight = s.resize.height;
          }
        } else if (s.resize.width > 0) {
          const ratio = s.resize.width / img.width;
          targetWidth = s.resize.width;
          targetHeight = img.height * ratio;
        } else if (s.resize.height > 0) {
          const ratio = s.resize.height / img.height;
          targetHeight = s.resize.height;
          targetWidth = img.width * ratio;
        }
      }

      // Handle rotation dimensions
      const isVerticalRotation = s.rotation === 90 || s.rotation === 270;
      canvas.width = isVerticalRotation ? targetHeight : targetWidth;
      canvas.height = isVerticalRotation ? targetWidth : targetHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context error');
      
      // Apply transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.scale(s.flip.horizontal ? -1 : 1, s.flip.vertical ? -1 : 1);
      ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Conversion failed')),
          s.format,
          s.format === 'image/png' ? undefined : s.quality
        );
      });

      const convertedUrl = URL.createObjectURL(blob);
      URL.revokeObjectURL(objectUrl);

      return {
        id,
        originalName: file.name,
        originalSize: file.size,
        convertedBlob: blob,
        convertedUrl,
        convertedSize: blob.size,
        width: canvas.width,
        height: canvas.height,
        status: 'success',
        format: s.format.split('/')[1].toUpperCase()
      };
    } catch (err) {
      return {
        id,
        originalName: file.name,
        originalSize: file.size,
        convertedBlob: new Blob(),
        convertedUrl: '',
        convertedSize: 0,
        width: 0,
        height: 0,
        status: 'error',
        format: ''
      };
    }
  };

  const convertAll = async () => {
    setIsConverting(true);
    setError(null);
    
    results.forEach(res => URL.revokeObjectURL(res.convertedUrl));
    
    const newResults: ConversionResult[] = [];
    for (const file of files) {
      const res = await processFile(file, settings);
      newResults.push(res);
    }
    
    setResults(newResults);
    setIsConverting(false);
    setView('results');
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    results.forEach(res => {
      if (res.status === 'success') {
        const ext = settings.format.split('/')[1];
        const fileName = res.originalName.replace(/\.[^/.]+$/, "") + '.' + ext;
        zip.file(fileName, res.convertedBlob);
      }
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixillion_export_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const reset = () => {
    results.forEach(res => URL.revokeObjectURL(res.convertedUrl));
    setFiles([]);
    setResults([]);
    setError(null);
    setView('upload');
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    if (newFiles.length === 0) setView('upload');
  };

  const totalOriginalSize = results.reduce((acc, res) => acc + res.originalSize, 0);
  const totalConvertedSize = results.reduce((acc, res) => acc + res.convertedSize, 0);
  const averageReduction = totalOriginalSize > 0 
    ? Math.round((1 - totalConvertedSize / totalOriginalSize) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-serif italic mb-4"
          >
            Pixillion Web Converter
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm uppercase tracking-widest opacity-60"
          >
            Conversion d'images multi-format & Retouche
          </motion.p>
        </header>

        <main className="grid gap-8">
          {/* View: Upload */}
          {view === 'upload' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300 ${
                dragActive ? 'border-[#141414] bg-white' : 'border-[#141414]/20 hover:border-[#141414]/40'
              }`}
              onDragEnter={onDrag}
              onDragLeave={onDrag}
              onDragOver={onDrag}
              onDrop={onDrop}
            >
              <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="hidden" />
              <input ref={folderInputRef} type="file" // @ts-ignore
                webkitdirectory="" directory="" onChange={handleFileChange} className="hidden" />
              
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#141414]/5">
                <Upload className="w-8 h-8 opacity-60" />
              </div>
              <h3 className="text-xl font-medium mb-2">Déposez vos images ici</h3>
              <p className="text-sm opacity-50 mb-8">Supporte JPEG, PNG, WebP, BMP et plus</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => fileInputRef.current?.click()} className="bg-[#141414] text-white px-8 py-3 rounded-full text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Choisir des fichiers
                </button>
                <button onClick={() => folderInputRef.current?.click()} className="bg-white text-[#141414] border border-[#141414]/10 px-8 py-3 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <FolderOpen className="w-4 h-4" /> Dossier complet
                </button>
              </div>
            </motion.div>
          )}

          {/* View: Settings */}
          {view === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <FileText className="w-5 h-5" /> {files.length} image{files.length > 1 ? 's' : ''}
                </h3>
                <button onClick={reset} className="text-xs uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Annuler</button>
              </div>

              {/* Settings Grid */}
              <div className="grid md:grid-cols-2 gap-12 mb-12">
                {/* Basic Settings */}
                <div className="space-y-8">
                  <div>
                    <label className="text-xs uppercase tracking-widest opacity-40 mb-4 block">Format de sortie</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['image/webp', 'image/png', 'image/jpeg'] as OutputFormat[]).map(f => (
                        <button 
                          key={f} 
                          onClick={() => setSettings({...settings, format: f})}
                          className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                            settings.format === f ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-[#141414] border-[#141414]/10 hover:bg-gray-50'
                          }`}
                        >
                          {f.split('/')[1].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {settings.format !== 'image/png' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-medium">Qualité</label>
                        <span className="text-sm font-mono">{Math.round(settings.quality * 100)}%</span>
                      </div>
                      <input type="range" min="0.1" max="1" step="0.05" value={settings.quality} onChange={(e) => setSettings({...settings, quality: parseFloat(e.target.value)})} className="w-full h-2 bg-[#F5F5F0] rounded-lg appearance-none cursor-pointer accent-[#141414]" />
                    </div>
                  )}

                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
                  >
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Options avancées (Redimensionner, Rotation...)
                  </button>
                </div>

                {/* File List Preview */}
                <div className="bg-[#F5F5F0] rounded-2xl p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                  <p className="text-[10px] uppercase tracking-widest opacity-40 mb-3">Liste des fichiers</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#141414]/5 last:border-0">
                      <span className="text-xs truncate max-w-[150px]">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="p-1 text-red-400 hover:bg-red-50 rounded-full"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advanced Options Panel */}
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-[#141414]/5 pt-8 mb-12">
                    <div className="grid md:grid-cols-3 gap-8">
                      {/* Resize */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Maximize2 className="w-4 h-4 opacity-40" />
                          <label className="text-sm font-medium">Dimensions</label>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                          <button 
                            onClick={() => setSettings({...settings, resize: {...settings.resize, enabled: false}})}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${!settings.resize.enabled ? 'bg-[#141414] text-white' : 'bg-white border-[#141414]/10'}`}
                          >
                            Originales
                          </button>
                          <button 
                            onClick={() => setSettings({...settings, resize: {...settings.resize, enabled: true}})}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${settings.resize.enabled ? 'bg-[#141414] text-white' : 'bg-white border-[#141414]/10'}`}
                          >
                            Personnalisées
                          </button>
                        </div>

                        <div className={`space-y-3 transition-opacity ${!settings.resize.enabled && 'opacity-30 pointer-events-none'}`}>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] uppercase opacity-40 mb-1">Largeur (px)</p>
                              <input 
                                type="number" 
                                value={settings.resize.width || ''} 
                                onChange={(e) => setSettings({...settings, resize: {...settings.resize, width: parseInt(e.target.value) || 0}})} 
                                className="w-full bg-[#F5F5F0] border-0 rounded-xl p-3 text-sm" 
                                placeholder="Largeur" 
                              />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase opacity-40 mb-1">Hauteur (px)</p>
                              <input 
                                type="number" 
                                value={settings.resize.height || ''} 
                                onChange={(e) => setSettings({...settings, resize: {...settings.resize, height: parseInt(e.target.value) || 0}})} 
                                className="w-full bg-[#F5F5F0] border-0 rounded-xl p-3 text-sm" 
                                placeholder="Hauteur" 
                              />
                            </div>
                          </div>
                          
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={settings.resize.maintainAspectRatio} 
                              onChange={(e) => setSettings({...settings, resize: {...settings.resize, maintainAspectRatio: e.target.checked}})}
                              className="w-4 h-4 rounded border-[#141414]/20 accent-[#141414]"
                            />
                            <span className="text-[11px] opacity-60 group-hover:opacity-100 transition-opacity">Conserver le ratio d'aspect</span>
                          </label>
                        </div>
                      </div>

                      {/* Rotation */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <RotateCw className="w-4 h-4 opacity-40" />
                          <label className="text-sm font-medium">Rotation</label>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[0, 90, 180, 270].map(deg => (
                            <button key={deg} onClick={() => setSettings({...settings, rotation: deg})} className={`py-2 rounded-xl text-xs font-mono border transition-all ${settings.rotation === deg ? 'bg-[#141414] text-white' : 'bg-white border-[#141414]/10'}`}>
                              {deg}°
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Flip */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FlipHorizontal className="w-4 h-4 opacity-40" />
                          <label className="text-sm font-medium">Miroir</label>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setSettings({...settings, flip: {...settings.flip, horizontal: !settings.flip.horizontal}})} className={`flex-1 py-3 rounded-xl text-xs font-medium border transition-all ${settings.flip.horizontal ? 'bg-[#141414] text-white' : 'bg-white border-[#141414]/10'}`}>Horizontal</button>
                          <button onClick={() => setSettings({...settings, flip: {...settings.flip, vertical: !settings.flip.vertical}})} className={`flex-1 py-3 rounded-xl text-xs font-medium border transition-all ${settings.flip.vertical ? 'bg-[#141414] text-white' : 'bg-white border-[#141414]/10'}`}>Vertical</button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={convertAll} disabled={isConverting} className="w-full bg-[#141414] text-white py-5 rounded-2xl font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[#141414]/10">
                {isConverting ? <><Loader2 className="w-5 h-5 animate-spin" /> Traitement de {files.length} images...</> : <>Lancer la conversion</>}
              </button>
            </motion.div>
          )}

          {/* View: Results */}
          {view === 'results' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#141414]/5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#059669]/10 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-8 h-8 text-[#059669]" /></div>
                    <div><h3 className="text-xl font-medium">Conversion terminée</h3><p className="text-sm opacity-50">{results.length} images traitées</p></div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-center"><p className="text-[10px] uppercase opacity-40 mb-1">Réduction moyenne</p><p className="text-3xl font-serif italic text-[#059669]">-{averageReduction}%</p></div>
                    <div className="h-12 w-px bg-[#141414]/5 hidden md:block" />
                    <div className="text-center"><p className="text-[10px] uppercase opacity-40 mb-1">Espace gagné</p><p className="text-3xl font-serif italic">{formatSize(totalOriginalSize - totalConvertedSize)}</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
                  <button onClick={downloadZip} className="bg-[#141414] text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"><Download className="w-5 h-5" /> Télécharger tout (.zip)</button>
                  <button onClick={() => setView('settings')} className="bg-white text-[#141414] border border-[#141414]/10 py-4 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><RefreshCcw className="w-5 h-5" /> Ajuster les réglages</button>
                </div>
              </div>

              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-[#141414]/5">
                <div className="p-6 border-b border-[#141414]/5 flex justify-between items-center"><h4 className="font-medium text-sm uppercase tracking-widest opacity-60">Fichiers exportés</h4><button onClick={reset} className="text-xs text-red-500 hover:underline">Nouveau projet</button></div>
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {results.map((res) => (
                    <div key={res.id} className="p-4 border-b border-[#141414]/5 last:border-0 flex items-center justify-between hover:bg-[#F5F5F0]/50 transition-colors">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-[#F5F5F0] overflow-hidden flex-shrink-0">
                          {res.status === 'success' ? <img src={res.convertedUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-5 h-5 opacity-20" /></div>}
                        </div>
                        <div className="min-w-0"><p className="text-sm font-medium truncate">{res.originalName}</p><p className="text-[10px] opacity-40 uppercase">{res.width}x{res.height}px • {res.format}</p></div>
                      </div>
                      <div className="flex items-center gap-8 text-right">
                        <div className="hidden sm:block"><p className="text-[10px] opacity-40 uppercase">Original</p><p className="text-xs font-mono">{formatSize(res.originalSize)}</p></div>
                        <div><p className="text-[10px] opacity-40 uppercase">Export</p><p className="text-xs font-mono font-bold">{formatSize(res.convertedSize)}</p></div>
                        <div className="w-16 text-[#059669] font-serif italic text-sm">-{Math.round((1 - res.convertedSize / res.originalSize) * 100)}%</div>
                        <a href={res.convertedUrl} download={res.originalName.replace(/\.[^/.]+$/, "") + '.' + settings.format.split('/')[1]} className="p-2 hover:bg-[#141414] hover:text-white rounded-full transition-all"><Download className="w-4 h-4" /></a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm"><AlertCircle className="w-5 h-5 shrink-0" /> {error}</motion.div>}
          </AnimatePresence>
        </main>

        <footer className="mt-16 pt-8 border-t border-[#141414]/5 text-center opacity-40 text-xs">
          <p>Pixillion Web - Traitement local sécurisé. Vos données ne quittent jamais votre navigateur.</p>
        </footer>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(20, 20, 20, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(20, 20, 20, 0.2); }
      `}</style>
    </div>
  );
}
