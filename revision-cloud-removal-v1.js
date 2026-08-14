function isRedStroke(color, alpha) {
  return Number(alpha) > 0 && color && color.length >= 3 && Number(color[0]) >= 0.65 && Number(color[0]) >= Number(color[1]) + 0.25 && Number(color[0]) >= Number(color[2]) + 0.25;
}

function pathRectToPixmap(pathRect, page, scale) {
  const b = page.getBounds();
  return [
    (pathRect[0] - b[0]) * scale,
    (pathRect[1] - b[1]) * scale,
    (pathRect[2] - b[0]) * scale,
    (pathRect[3] - b[1]) * scale
  ];
}

function pathTouchesCloud(pathRect, page, cloud) {
  const [x0, y0, x1, y1] = pathRectToPixmap(pathRect, page, cloud.scale || 0.18);
  const cx0 = cloud.minX;
  const cy0 = cloud.minY;
  const cx1 = cloud.minX + cloud.cropW;
  const cy1 = cloud.minY + cloud.cropH;
  const ix0 = Math.max(cx0, Math.floor(Math.min(x0, x1)) - 2);
  const iy0 = Math.max(cy0, Math.floor(Math.min(y0, y1)) - 2);
  const ix1 = Math.min(cx1, Math.ceil(Math.max(x0, x1)) + 2);
  const iy1 = Math.min(cy1, Math.ceil(Math.max(y0, y1)) + 2);
  if (ix1 <= ix0 || iy1 <= iy0) return false;
  for (let y = iy0; y < iy1; y++) {
    for (let x = ix0; x < ix1; x++) {
      if (cloud.crop[(y - cy0) * cloud.cropW + (x - cx0)]) return true;
    }
  }
  return false;
}

function collectRedPaths(mupdf, page, cloud) {
  const hits = [];
  const device = new mupdf.Device({
    strokePath(path, stroke, ctm, colorSpace, color, alpha) {
      if (!isRedStroke(color, alpha)) return;
      try {
        const r = path.getBounds(stroke, ctm);
        const rect = [Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3])];
        if (rect.every(Number.isFinite) && pathTouchesCloud(rect, page, cloud)) hits.push(rect);
      } catch (_) {}
    },
    fillPath() {}, clipPath() {}, clipStrokePath() {}, fillText() {}, clipText() {}, strokeText() {}, clipStrokeText() {}, ignoreText() {},
    fillShade() {}, fillImage() {}, fillImageMask() {}, clipImageMask() {}, beginMask() {}, endMask() {}, popClip() {}, beginGroup() {}, endGroup() {}, beginTile() { return 0; }, endTile() {}, beginLayer() {}, endLayer() {}, beginStructure() {}, endStructure() {}, beginMetatext() {}, endMetatext() {}, renderFlags() {}, setDefaultColorSpaces() {}, close() {}
  });
  try {
    page.run(device, mupdf.Matrix.identity);
  } finally {
    try { device.close?.(); } catch (_) {}
  }
  return hits;
}

function buildSelectedMask(page, cloud, paths) {
  const scale = cloud.scale || 0.18;
  const selected = new Uint8Array(cloud.cropW * cloud.cropH);
  const pathPixels = paths.map(r => pathRectToPixmap(r, page, scale));
  for (let y = 0; y < cloud.cropH; y++) {
    for (let x = 0; x < cloud.cropW; x++) {
      if (!cloud.crop[y * cloud.cropW + x]) continue;
      const gx = cloud.minX + x;
      const gy = cloud.minY + y;
      for (const r of pathPixels) {
        if (gx >= r[0] - 2 && gx <= r[2] + 2 && gy >= r[1] - 2 && gy <= r[3] + 2) {
          selected[y * cloud.cropW + x] = 1;
          break;
        }
      }
    }
  }
  return selected;
}

function rowRuns(mask, w, y) {
  const runs = [];
  let x = 0;
  while (x < w) {
    if (!mask[y * w + x]) { x++; continue; }
    const start = x;
    while (x < w && mask[y * w + x]) x++;
    runs.push([start, x]);
  }
  return runs;
}

function mergeMaskRuns(mask, w, h, tolerance = 1) {
  let active = [];
  const done = [];
  for (let y = 0; y < h; y++) {
    const runs = rowRuns(mask, w, y);
    const used = new Uint8Array(runs.length);
    const next = [];
    for (const rect of active) {
      const [rx0, ry0, rx1] = rect;
      let best = -1;
      let bestOverlap = -1;
      for (let i = 0; i < runs.length; i++) {
        if (used[i]) continue;
        const [x0, x1] = runs[i];
        const overlap = Math.min(rx1, x1) - Math.max(rx0, x0);
        const close = Math.max(Math.abs(rx0 - x0), Math.abs(rx1 - x1)) <= tolerance;
        if (overlap > 0 && close && overlap > bestOverlap) {
          best = i;
          bestOverlap = overlap;
        }
      }
      if (best >= 0) {
        const [x0, x1] = runs[best];
        used[best] = 1;
        next.push([Math.min(rx0, x0), ry0, Math.max(rx1, x1), y + 1]);
      } else {
        done.push(rect);
      }
    }
    for (let i = 0; i < runs.length; i++) {
      if (!used[i]) next.push([runs[i][0], y, runs[i][1], y + 1]);
    }
    active = next;
  }
  done.push(...active);
  return done;
}

function createMergedRedactions(page, cloud, paths) {
  const scale = cloud.scale || 0.18;
  const b = page.getBounds();
  const selected = buildSelectedMask(page, cloud, paths);
  const rects = mergeMaskRuns(selected, cloud.cropW, cloud.cropH, 1);
  let created = 0;
  for (const [lx0, ly0, lx1, ly1] of rects) {
    const x0 = b[0] + (cloud.minX + lx0 - 0.5) / scale;
    const y0 = b[1] + (cloud.minY + ly0 - 0.5) / scale;
    const x1 = b[0] + (cloud.minX + lx1 + 0.5) / scale;
    const y1 = b[1] + (cloud.minY + ly1 + 0.5) / scale;
    if (x1 <= x0 || y1 <= y0) continue;
    const annot = page.createAnnotation('Redact');
    annot.setRect([x0, y0, x1, y1]);
    created++;
  }
  return { created, selectedPixels: selected.reduce((n, v) => n + (v ? 1 : 0), 0), mergedRects: rects.length };
}

export async function eraseRevisionCloudVector(mupdf, page, cloud) {
  const paths = collectRedPaths(mupdf, page, cloud);
  if (!paths.length) return { paths: 0, redactions: 0, selectedPixels: 0 };
  const merged = createMergedRedactions(page, cloud, paths);
  if (!merged.created) return { paths: paths.length, redactions: 0, selectedPixels: merged.selectedPixels };
  const imageNone = mupdf.PDFPage?.REDACT_IMAGE_NONE ?? 0;
  const lineRemoveTouched = mupdf.PDFPage?.REDACT_LINE_ART_REMOVE_IF_TOUCHED ?? 2;
  const textNone = mupdf.PDFPage?.REDACT_TEXT_NONE ?? 1;
  page.applyRedactions(false, imageNone, lineRemoveTouched, textNone);
  return {
    paths: paths.length,
    redactions: merged.created,
    selectedPixels: merged.selectedPixels,
    mergedRects: merged.mergedRects
  };
}

export { mergeMaskRuns };
