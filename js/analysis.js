// analysis.js (global)
// Provides window.RankSmarterAnalyze(data, k, eps)

(function () {
  function sortDesc(data) {
    return [...data].sort((a, b) => b.score - a.score);
  }

  function clampInt(x, lo, hi) {
    const v = Math.floor(Number(x));
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function fmt(x) {
    if (!Number.isFinite(x)) return "n/a";
    const ax = Math.abs(x);
    if (ax >= 100) return x.toFixed(1);
    if (ax >= 1) return x.toFixed(3);
    return x.toFixed(4);
  }

  // Tie band defined as a contiguous region where each adjacent gap <= 2*eps.
  // If the boundary (k vs k+1) is inside such a region, strict cutoff is not defensible there.
  function tieBandAroundCut(sorted, eps, k) {
    const n = sorted.length;
    const cut = k - 1;
    if (cut < 0 || cut >= n - 1) return null;

    const gapAtCut = sorted[cut].score - sorted[cut + 1].score;
    if (gapAtCut > 2 * eps) return null;

    let lo = cut;
    let hi = cut + 1;

    while (lo > 0) {
      const g = sorted[lo - 1].score - sorted[lo].score;
      if (g <= 2 * eps) lo--;
      else break;
    }
    while (hi < n - 1) {
      const g = sorted[hi].score - sorted[hi + 1].score;
      if (g <= 2 * eps) hi++;
      else break;
    }

    return {
      loRank: lo + 1,
      hiRank: hi + 1,
      size: (hi - lo + 1),
      spansBoundary: (lo <= cut && hi >= cut + 1),
      items: sorted.slice(lo, hi + 1)
    };
  }

  function analyze(data, kInput, epsInput) {
    const cleaned = (data || [])
      .map(d => ({ item: String(d.item || "").trim(), score: Number(d.score) }))
      .filter(d => d.item && Number.isFinite(d.score));

    if (cleaned.length < 2) {
      throw new Error("Need at least two valid rows with item and numeric score.");
    }

    const sorted = sortDesc(cleaned);
    const n = sorted.length;

    const k = clampInt(kInput, 1, n - 1);
    const eps = Math.max(0, Number(epsInput) || 0);

    const inside = sorted[k - 1];
    const outside = sorted[k];

    const gap = inside.score - outside.score;
    const requiredEpsForGuarantee = gap / 2;

    // Stable selected set condition at the boundary only (classic criterion).
    const stableSelectedSet = eps < requiredEpsForGuarantee;

    const band = tieBandAroundCut(sorted, eps, k);

    // Guaranteed regions:
    // If tie band spans boundary:
    // - guaranteed in: ranks 1..(loRank-1)
    // - tie band: loRank..hiRank
    // - guaranteed out: (hiRank+1)..n
    // If no tie band, then boundary is stable under the simple model.
    let guaranteedIn = { fromRank: 1, toRank: k };
    let guaranteedOut = { fromRank: k + 1, toRank: n };
    let tieBand = null;

    if (band && band.spansBoundary) {
      tieBand = band;
      guaranteedIn = { fromRank: 1, toRank: Math.max(0, band.loRank - 1) };
      guaranteedOut = { fromRank: Math.min(n, band.hiRank + 1), toRank: n };
    }

    // Suggested defensible hard cutoffs if user insists on a single number:
    // - conservative: select only guaranteed-in
    // - inclusive: select guaranteed-in + entire tie band (if boundary is within tie band)
    const conservativeCutoffK = (tieBand && tieBand.spansBoundary) ? guaranteedIn.toRank : k;
    const inclusiveCutoffK = (tieBand && tieBand.spansBoundary) ? tieBand.hiRank : k;

    return {
      meta: { n, k, eps },
      sorted,
      boundary: {
        insideItem: inside.item,
        outsideItem: outside.item,
        insideScore: inside.score,
        outsideScore: outside.score,
        gap,
        requiredEpsForGuarantee
      },
      stableSelectedSet,
      regions: {
        guaranteedIn,
        tieBand,
        guaranteedOut
      },
      suggestions: {
        conservativeCutoffK,
        inclusiveCutoffK
      },
      fmt
    };
  }

  window.RankSmarterAnalyze = analyze;
})();
