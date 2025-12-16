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
    return { loRank: lo + 1, hiRank: hi + 1 };
  }

  function fmt(x) {
    if (!Number.isFinite(x)) return "n/a";
    const ax = Math.abs(x);
    if (ax >= 100) return x.toFixed(1);
    if (ax >= 1) return x.toFixed(3);
    return x.toFixed(4);
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
    const required = gap / 2;
    const stable = eps < required;

    const band = tieBandAroundCut(sorted, eps, k);

    return {
      meta: {
        n,
        k,
        eps
      },
      sorted,
      boundary: {
        insideItem: inside.item,
        outsideItem: outside.item,
        insideScore: inside.score,
        outsideScore: outside.score,
        gap,
        required
      },
      stable,
      band,
      fmt
    };
  }

  window.RankSmarterAnalyze = analyze;
})();
