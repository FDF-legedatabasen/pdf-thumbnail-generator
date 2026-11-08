import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

/**
 * Default configuration matching the user's reference example
 */
const DEFAULT_SETTINGS = {
  pageCount: 3,
  customPages: '',
  zOrder: 'first-on-top', // 'first-on-top' | 'last-on-top'
  baseAngle: -9,
  stepAngle: 4,
  offsetX: 32, // % of page width
  offsetY: 24, // % of page height
  shadowBlur: 24,
  shadowOpacity: 28,
  shadowX: 4,
  shadowY: 10,
  borderStyle: 'none', // 'dotted' | 'solid' | 'dashed' | 'none'
  borderColor: '#757575',
  borderWidth: 4,
  cornerRadius: 0,
  canvasPreset: 'auto', // 'auto' or 'WxH'
  outputScale: 1200,
  padding: 6, // % of canvas
  bgMode: 'transparent', // 'transparent' | 'solid'
  bgColor: '#ffffff',
  webpQuality: 80,
};

const state = {
  pdfDoc: null,
  fileName: 'demo-stack',
  totalPages: 3,
  isDemo: true,
  /** @type {Map<number, HTMLCanvasElement>} 1-indexed page number -> rendered offscreen canvas */
  pageCache: new Map(),
  settings: { ...DEFAULT_SETTINGS },
  sizeEstimateTimer: null,
};

// DOM Elements
const els = {
  fileInput: document.getElementById('pdf-file-input'),
  loadDemoBtn: document.getElementById('load-demo-btn'),
  dropzone: document.getElementById('dropzone'),
  fileNameLabel: document.getElementById('file-name-label'),
  totalPagesPill: document.getElementById('total-pages-pill'),
  dimensionsReadout: document.getElementById('canvas-dimensions-readout'),
  canvas: document.getElementById('thumbnail-canvas'),
  presetReferenceBtn: document.getElementById('preset-reference-btn'),
  presetCleanBtn: document.getElementById('preset-clean-btn'),
  resetDefaultsBtn: document.getElementById('reset-defaults-btn'),
  downloadPngBtn: document.getElementById('download-png-btn'),
  downloadWebpBtn: document.getElementById('download-webp-btn'),
  pngSizeEst: document.getElementById('png-size-est'),
  webpSizeEst: document.getElementById('webp-size-est'),
  webpQBadge: document.getElementById('webp-q-badge'),
  savingsBadge: document.getElementById('savings-badge'),

  // Controls
  pageCountSlider: document.getElementById('page-count-slider'),
  pageCountVal: document.getElementById('page-count-val'),
  customPagesInput: document.getElementById('custom-pages-input'),
  zOrderSelect: document.getElementById('z-order-select'),

  baseAngleSlider: document.getElementById('base-angle-slider'),
  baseAngleVal: document.getElementById('base-angle-val'),
  stepAngleSlider: document.getElementById('step-angle-slider'),
  stepAngleVal: document.getElementById('step-angle-val'),
  offsetXSlider: document.getElementById('offset-x-slider'),
  offsetXVal: document.getElementById('offset-x-val'),
  offsetYSlider: document.getElementById('offset-y-slider'),
  offsetYVal: document.getElementById('offset-y-val'),

  shadowBlurSlider: document.getElementById('shadow-blur-slider'),
  shadowBlurVal: document.getElementById('shadow-blur-val'),
  shadowOpacitySlider: document.getElementById('shadow-opacity-slider'),
  shadowOpacityVal: document.getElementById('shadow-opacity-val'),
  shadowXSlider: document.getElementById('shadow-x-slider'),
  shadowXVal: document.getElementById('shadow-x-val'),
  shadowYSlider: document.getElementById('shadow-y-slider'),
  shadowYVal: document.getElementById('shadow-y-val'),

  borderStyleSelect: document.getElementById('border-style-select'),
  borderColorInput: document.getElementById('border-color-input'),
  borderWidthField: document.getElementById('border-width-field'),
  borderWidthSlider: document.getElementById('border-width-slider'),
  borderWidthVal: document.getElementById('border-width-val'),
  cornerRadiusSlider: document.getElementById('corner-radius-slider'),
  cornerRadiusVal: document.getElementById('corner-radius-val'),

  canvasPresetSelect: document.getElementById('canvas-preset-select'),
  autoScaleField: document.getElementById('auto-scale-field'),
  outputScaleSlider: document.getElementById('output-scale-slider'),
  outputScaleVal: document.getElementById('output-scale-val'),
  paddingSlider: document.getElementById('padding-slider'),
  paddingVal: document.getElementById('padding-val'),
  bgModeSelect: document.getElementById('bg-mode-select'),
  bgColorField: document.getElementById('bg-color-field'),
  bgColorInput: document.getElementById('bg-color-input'),
  webpQualitySlider: document.getElementById('webp-quality-slider'),
  webpQualityVal: document.getElementById('webp-quality-val'),
};

/**
 * Generates the 3 demo pages inspired by the user's attached example ("E / 1 Point", "S / 2 Point", "G / 4 Point")
 */
function buildDemoPages() {
  state.isDemo = true;
  state.pdfDoc = null;
  state.fileName = 'letter-cards-demo';
  state.totalPages = 5;
  state.pageCache.clear();

  const demoCards = [
    { letter: 'E', points: '1 Point' },
    { letter: 'S', points: '2 Point' },
    { letter: 'G', points: '4 Point' },
    { letter: 'A', points: '1 Point' },
    { letter: 'R', points: '3 Point' },
  ];

  const cardW = 720;
  const cardH = 900;

  demoCards.forEach((card, idx) => {
    const c = document.createElement('canvas');
    c.width = cardW;
    c.height = cardH;
    const ctx = c.getContext('2d');

    // Pure white card background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cardW, cardH);

    // Heavy block letter in the upper center
    ctx.fillStyle = '#09090b';
    ctx.font = '900 410px "Arial Black", Impact, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.letter, cardW / 2, cardH * 0.42);

    // Subtitle ("1 Point", "2 Point", etc.)
    ctx.font = '400 76px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#111827';
    ctx.fillText(card.points, cardW / 2, cardH * 0.79);

    state.pageCache.set(idx + 1, c);
  });

  els.fileNameLabel.textContent = 'Demo Cards (Sample)';
  els.totalPagesPill.textContent = `${state.totalPages} pages available`;
  els.pageCountSlider.max = String(state.totalPages);
  renderStack();
}

/**
 * Parses the user's page selection (either custom range like "1, 2, 4" or first N pages)
 * @returns {number[]} Array of 1-based page numbers
 */
function getSelectedPageNumbers() {
  const maxPage = state.totalPages || 1;
  const rawCustom = state.settings.customPages.trim();

  if (rawCustom) {
    const pages = [];
    const parts = rawCustom.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          const step = start <= end ? 1 : -1;
          for (let p = start; step > 0 ? p <= end : p >= end; p += step) {
            if (p >= 1 && p <= maxPage && pages.length < 12) {
              pages.push(p);
            }
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= maxPage && pages.length < 12) {
          pages.push(num);
        }
      }
    }
    if (pages.length > 0) {
      return pages;
    }
  }

  const count = Math.min(Math.max(1, state.settings.pageCount), maxPage);
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Ensures all requested pages from the loaded PDF are rendered into state.pageCache
 */
async function ensurePagesRendered(pageNumbers) {
  if (state.isDemo || !state.pdfDoc) return;

  for (const pageNum of pageNumbers) {
    if (state.pageCache.has(pageNum)) continue;
    const page = await state.pdfDoc.getPage(pageNum);
    // Render at a crisp base resolution (~1100px along longest edge)
    const unscaledViewport = page.getViewport({ scale: 1 });
    const targetMaxDim = 1100;
    const scale = targetMaxDim / Math.max(unscaledViewport.width, unscaledViewport.height);
    const viewport = page.getViewport({ scale });

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(viewport.width);
    offscreen.height = Math.round(viewport.height);
    const ctx = offscreen.getContext('2d');

    // Fill white background for PDF pages that have transparent backgrounds
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    state.pageCache.set(pageNum, offscreen);
  }
}

/**
 * Helper to trace a rounded rectangle path on a 2D context
 */
function traceRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (radius === 0) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.roundRect(x, y, w, h, radius);
  }
  ctx.closePath();
}

/**
 * Computes the bounding box of all transformed pages in local stack coordinates
 * and renders the composite stack onto the main canvas.
 */
async function renderStack() {
  const pageNumbers = getSelectedPageNumbers();
  await ensurePagesRendered(pageNumbers);

  const pageCanvases = pageNumbers
    .map((n) => state.pageCache.get(n))
    .filter(Boolean);

  if (pageCanvases.length === 0) return;

  const s = state.settings;
  const firstPage = pageCanvases[0];
  const baseW = firstPage.width;
  const baseH = firstPage.height;

  // Compute each page's pose in unscaled stack space (where page 0 center is at 0,0)
  const poses = pageCanvases.map((pageCanvas, i) => {
    const w = pageCanvas.width;
    const h = pageCanvas.height;
    const cx = i * (s.offsetX / 100) * baseW;
    const cy = i * (s.offsetY / 100) * baseH;
    const angleDeg = s.baseAngle + i * s.stepAngle;
    const angleRad = (angleDeg * Math.PI) / 180;
    return { pageCanvas, w, h, cx, cy, angleRad, index: i };
  });

  // Compute exact bounding box of all rotated page corners in stack space
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pose of poses) {
    const hw = pose.w / 2;
    const hh = pose.h / 2;
    const cos = Math.cos(pose.angleRad);
    const sin = Math.sin(pose.angleRad);
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ];
    for (const [lx, ly] of corners) {
      const rx = pose.cx + lx * cos - ly * sin;
      const ry = pose.cy + lx * sin + ly * cos;
      if (rx < minX) minX = rx;
      if (ry < minY) minY = ry;
      if (rx > maxX) maxX = rx;
      if (ry > maxY) maxY = ry;
    }
  }

  // Account for shadow bleed and border thickness in stack space
  const shadowBleedLeft = Math.max(0, s.shadowBlur * 1.6 - s.shadowX) + s.borderWidth;
  const shadowBleedRight = Math.max(0, s.shadowBlur * 1.6 + s.shadowX) + s.borderWidth;
  const shadowBleedTop = Math.max(0, s.shadowBlur * 1.6 - s.shadowY) + s.borderWidth;
  const shadowBleedBottom = Math.max(0, s.shadowBlur * 1.6 + s.shadowY) + s.borderWidth;

  minX -= shadowBleedLeft;
  maxX += shadowBleedRight;
  minY -= shadowBleedTop;
  maxY += shadowBleedBottom;

  const stackW = Math.max(1, maxX - minX);
  const stackH = Math.max(1, maxY - minY);
  const stackCenterX = (minX + maxX) / 2;
  const stackCenterY = (minY + maxY) / 2;

  // Determine target output canvas dimensions
  let canvasW;
  let canvasH;
  const padFraction = s.padding / 100;

  if (s.canvasPreset === 'auto') {
    const maxDim = s.outputScale;
    const aspect = stackW / stackH;
    if (aspect >= 1) {
      canvasW = Math.round(maxDim);
      canvasH = Math.round(maxDim / aspect);
    } else {
      canvasH = Math.round(maxDim);
      canvasW = Math.round(maxDim * aspect);
    }
  } else {
    const [pw, ph] = s.canvasPreset.split('x').map(Number);
    canvasW = pw;
    canvasH = ph;
  }

  els.canvas.width = canvasW;
  els.canvas.height = canvasH;
  els.dimensionsReadout.textContent = `${canvasW} × ${canvasH} px`;

  const usableW = canvasW * (1 - padFraction * 2);
  const usableH = canvasH * (1 - padFraction * 2);
  const scaleFactor = Math.min(usableW / stackW, usableH / stackH);

  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, canvasW, canvasH);

  // Fill background if solid
  if (s.bgMode === 'solid') {
    ctx.fillStyle = s.bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Order layers: if 'first-on-top', draw from back (N-1) down to front (0)
  const orderedPoses =
    s.zOrder === 'first-on-top' ? [...poses].reverse() : [...poses];

  const cornerRadiusScaled = s.cornerRadius * (baseW / 600);
  const borderWidthScaled = s.borderWidth * (baseW / 600);

  for (const pose of orderedPoses) {
    ctx.save();

    // Transform from canvas center -> scaled stack coordinate -> page center & rotation
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(pose.cx - stackCenterX, pose.cy - stackCenterY);
    ctx.rotate(pose.angleRad);

    const x = -pose.w / 2;
    const y = -pose.h / 2;

    // 1. Draw page backing with drop shadow
    if (s.shadowOpacity > 0 && (s.shadowBlur > 0 || s.shadowX !== 0 || s.shadowY !== 0)) {
      ctx.save();
      const alpha = (s.shadowOpacity / 100).toFixed(3);
      ctx.shadowColor = `rgba(0, 0, 0, ${alpha})`;
      ctx.shadowBlur = s.shadowBlur * scaleFactor * (baseW / 600);
      ctx.shadowOffsetX = s.shadowX * scaleFactor * (baseW / 600);
      ctx.shadowOffsetY = s.shadowY * scaleFactor * (baseW / 600);
      ctx.fillStyle = '#ffffff';
      traceRoundedRect(ctx, x, y, pose.w, pose.h, cornerRadiusScaled);
      ctx.fill();
      ctx.restore();
    }

    // 2. Clip to rounded rect and draw the cached PDF page bitmap
    ctx.save();
    traceRoundedRect(ctx, x, y, pose.w, pose.h, cornerRadiusScaled);
    ctx.clip();
    ctx.drawImage(pose.pageCanvas, x, y, pose.w, pose.h);
    ctx.restore();

    // 3. Draw optional border (dotted, dashed, or solid)
    if (s.borderStyle !== 'none' && s.borderWidth > 0) {
      ctx.save();
      traceRoundedRect(ctx, x, y, pose.w, pose.h, cornerRadiusScaled);
      ctx.strokeStyle = s.borderColor;
      ctx.lineWidth = borderWidthScaled;

      if (s.borderStyle === 'dotted') {
        // Crisp square/rectangular dots matching the reference cutout border
        const dotSize = borderWidthScaled * 1.15;
        const gapSize = borderWidthScaled * 1.25;
        ctx.setLineDash([dotSize, gapSize]);
        ctx.lineCap = 'butt';
      } else if (s.borderStyle === 'dashed') {
        ctx.setLineDash([borderWidthScaled * 3.5, borderWidthScaled * 2]);
        ctx.lineCap = 'butt';
      } else {
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  scheduleFileSizeEstimate();
}

/**
 * Formats byte size into human-readable KB / MB
 */
function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Debounced calculation of live PNG vs WebP file sizes so user can see space savings
 */
function scheduleFileSizeEstimate() {
  if (state.sizeEstimateTimer) {
    clearTimeout(state.sizeEstimateTimer);
  }
  state.sizeEstimateTimer = setTimeout(() => {
    const q = state.settings.webpQuality / 100;
    els.canvas.toBlob((pngBlob) => {
      els.canvas.toBlob(
        (webpBlob) => {
          if (!pngBlob || !webpBlob) return;
          els.pngSizeEst.textContent = formatBytes(pngBlob.size);
          els.webpSizeEst.textContent = formatBytes(webpBlob.size);
          const savedPct = Math.round((1 - webpBlob.size / pngBlob.size) * 100);
          if (savedPct > 0) {
            els.savingsBadge.textContent = `-${savedPct}% smaller`;
          } else {
            els.savingsBadge.textContent = '';
          }
        },
        'image/webp',
        q
      );
    }, 'image/png');
  }, 180);
}

/**
 * Loads a PDF file uploaded by the user
 */
async function loadPdfFile(file) {
  if (!file) return;
  try {
    els.fileNameLabel.textContent = `Loading ${file.name}…`;
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    state.pdfDoc = pdfDoc;
    state.isDemo = false;
    state.totalPages = pdfDoc.numPages;
    state.fileName = file.name.replace(/\.pdf$/i, '') || 'pdf-thumbnail';
    state.pageCache.clear();

    els.fileNameLabel.textContent = file.name;
    els.totalPagesPill.textContent = `${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? '' : 's'}`;

    const maxSlider = Math.min(10, pdfDoc.numPages);
    els.pageCountSlider.max = String(Math.max(1, maxSlider));
    if (state.settings.pageCount > pdfDoc.numPages) {
      state.settings.pageCount = Math.min(3, pdfDoc.numPages);
      syncUIFromSettings();
    }

    await renderStack();
  } catch (err) {
    console.error('Failed to load PDF:', err);
    alert(`Could not read PDF file: ${err.message || err}`);
    els.fileNameLabel.textContent = 'Error loading PDF';
  }
}

/**
 * Triggers browser download of the composited canvas in PNG or WebP format
 */
function exportImage(format) {
  const mime = format === 'webp' ? 'image/webp' : 'image/png';
  const quality = format === 'webp' ? state.settings.webpQuality / 100 : undefined;
  const ext = format === 'webp' ? 'webp' : 'png';

  els.canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-thumbnail.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    mime,
    quality
  );
}

/**
 * Syncs all DOM inputs and output labels with state.settings
 */
function syncUIFromSettings() {
  const s = state.settings;

  els.pageCountSlider.value = s.pageCount;
  els.pageCountVal.textContent = s.pageCount;
  els.customPagesInput.value = s.customPages;
  els.zOrderSelect.value = s.zOrder;

  els.baseAngleSlider.value = s.baseAngle;
  els.baseAngleVal.textContent = `${s.baseAngle > 0 ? '+' : ''}${s.baseAngle}°`;
  els.stepAngleSlider.value = s.stepAngle;
  els.stepAngleVal.textContent = `${s.stepAngle > 0 ? '+' : ''}${s.stepAngle}°`;
  els.offsetXSlider.value = s.offsetX;
  els.offsetXVal.textContent = `${s.offsetX}%`;
  els.offsetYSlider.value = s.offsetY;
  els.offsetYVal.textContent = `${s.offsetY}%`;

  els.shadowBlurSlider.value = s.shadowBlur;
  els.shadowBlurVal.textContent = `${s.shadowBlur}px`;
  els.shadowOpacitySlider.value = s.shadowOpacity;
  els.shadowOpacityVal.textContent = `${s.shadowOpacity}%`;
  els.shadowXSlider.value = s.shadowX;
  els.shadowXVal.textContent = `${s.shadowX}px`;
  els.shadowYSlider.value = s.shadowY;
  els.shadowYVal.textContent = `${s.shadowY}px`;

  els.borderStyleSelect.value = s.borderStyle;
  els.borderColorInput.value = s.borderColor;
  els.borderWidthSlider.value = s.borderWidth;
  els.borderWidthVal.textContent = `${s.borderWidth}px`;
  els.borderWidthField.style.display = s.borderStyle === 'none' ? 'none' : '';
  els.cornerRadiusSlider.value = s.cornerRadius;
  els.cornerRadiusVal.textContent = `${s.cornerRadius}px`;

  els.canvasPresetSelect.value = s.canvasPreset;
  els.autoScaleField.style.display = s.canvasPreset === 'auto' ? '' : 'none';
  els.outputScaleSlider.value = s.outputScale;
  els.outputScaleVal.textContent = `${s.outputScale}px`;
  els.paddingSlider.value = s.padding;
  els.paddingVal.textContent = `${s.padding}%`;

  els.bgModeSelect.value = s.bgMode;
  els.bgColorField.style.display = s.bgMode === 'solid' ? '' : 'none';
  els.bgColorInput.value = s.bgColor;

  els.webpQualitySlider.value = s.webpQuality;
  els.webpQualityVal.textContent = `${s.webpQuality}%`;
  els.webpQBadge.textContent = s.webpQuality;
}

/**
 * Wire up all event listeners
 */
function bindEvents() {
  // File upload input
  els.fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) loadPdfFile(file);
    e.target.value = '';
  });

  els.loadDemoBtn.addEventListener('click', () => {
    buildDemoPages();
  });

  // Drag and drop on stage
  ['dragenter', 'dragover'].forEach((evtName) => {
    els.dropzone.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      els.dropzone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach((evtName) => {
    els.dropzone.addEventListener(evtName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (evtName === 'drop' || !els.dropzone.contains(e.relatedTarget)) {
        els.dropzone.classList.remove('drag-over');
      }
    });
  });

  els.dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      loadPdfFile(file);
    } else if (file) {
      alert('Please drop a valid .pdf file.');
    }
  });

  // Presets & Reset
  els.resetDefaultsBtn.addEventListener('click', () => {
    state.settings = { ...DEFAULT_SETTINGS };
    syncUIFromSettings();
    renderStack();
  });

  els.presetReferenceBtn.addEventListener('click', () => {
    Object.assign(state.settings, {
      baseAngle: -9,
      stepAngle: 4,
      offsetX: 32,
      offsetY: 24,
      shadowBlur: 24,
      shadowOpacity: 28,
      shadowX: 4,
      shadowY: 10,
      borderStyle: 'dotted',
      borderColor: '#757575',
      borderWidth: 4,
      cornerRadius: 0,
    });
    syncUIFromSettings();
    renderStack();
  });

  els.presetCleanBtn.addEventListener('click', () => {
    Object.assign(state.settings, {
      baseAngle: -7,
      stepAngle: 3.5,
      offsetX: 26,
      offsetY: 18,
      shadowBlur: 32,
      shadowOpacity: 32,
      shadowX: 6,
      shadowY: 12,
      borderStyle: 'solid',
      borderColor: '#e5e7eb',
      borderWidth: 1.5,
      cornerRadius: 8,
    });
    syncUIFromSettings();
    renderStack();
  });

  // Control bindings helper
  const bindSlider = (el, key, parseFn = Number) => {
    el.addEventListener('input', () => {
      state.settings[key] = parseFn(el.value);
      syncUIFromSettings();
      renderStack();
    });
  };

  bindSlider(els.pageCountSlider, 'pageCount', (v) => parseInt(v, 10));
  els.customPagesInput.addEventListener('input', () => {
    state.settings.customPages = els.customPagesInput.value;
    renderStack();
  });
  els.zOrderSelect.addEventListener('change', () => {
    state.settings.zOrder = els.zOrderSelect.value;
    renderStack();
  });

  bindSlider(els.baseAngleSlider, 'baseAngle', parseFloat);
  bindSlider(els.stepAngleSlider, 'stepAngle', parseFloat);
  bindSlider(els.offsetXSlider, 'offsetX', parseFloat);
  bindSlider(els.offsetYSlider, 'offsetY', parseFloat);

  bindSlider(els.shadowBlurSlider, 'shadowBlur', parseFloat);
  bindSlider(els.shadowOpacitySlider, 'shadowOpacity', parseFloat);
  bindSlider(els.shadowXSlider, 'shadowX', parseFloat);
  bindSlider(els.shadowYSlider, 'shadowY', parseFloat);

  els.borderStyleSelect.addEventListener('change', () => {
    state.settings.borderStyle = els.borderStyleSelect.value;
    syncUIFromSettings();
    renderStack();
  });
  els.borderColorInput.addEventListener('input', () => {
    state.settings.borderColor = els.borderColorInput.value;
    renderStack();
  });
  bindSlider(els.borderWidthSlider, 'borderWidth', parseFloat);
  bindSlider(els.cornerRadiusSlider, 'cornerRadius', parseFloat);

  els.canvasPresetSelect.addEventListener('change', () => {
    state.settings.canvasPreset = els.canvasPresetSelect.value;
    syncUIFromSettings();
    renderStack();
  });
  bindSlider(els.outputScaleSlider, 'outputScale', (v) => parseInt(v, 10));
  bindSlider(els.paddingSlider, 'padding', parseFloat);

  els.bgModeSelect.addEventListener('change', () => {
    state.settings.bgMode = els.bgModeSelect.value;
    syncUIFromSettings();
    renderStack();
  });
  els.bgColorInput.addEventListener('input', () => {
    state.settings.bgColor = els.bgColorInput.value;
    renderStack();
  });
  bindSlider(els.webpQualitySlider, 'webpQuality', (v) => parseInt(v, 10));

  // Export buttons
  els.downloadPngBtn.addEventListener('click', () => exportImage('png'));
  els.downloadWebpBtn.addEventListener('click', () => exportImage('webp'));
}

// Initialize app
syncUIFromSettings();
bindEvents();
buildDemoPages();
