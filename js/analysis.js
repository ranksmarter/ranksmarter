// analysis.js (global)
// Provides window.RankSmarterAnalyze(data, k, eps)
//
// Purpose:
// - Given a ranked list (item, score), a selection size k, and an assumed bounded error eps,
//   compute whether the cutoff between k and k+1 is forced by the score spacing.
// - If the boundary is inside a near-tie region, compute a tie band [L..U] around the boundary.
// - Derive:
//   * guaranteedIn = ranks 1..(L-1) (safe inside)
//   * tieBand = ranks L..U (uncertain region that spans the boundary)
//   * guaranteedOut = ranks (U+1)..n (safe outside)
// - Also report conservative and inclusive defensible hard cutoffs around the band.

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

  function gaps(sorted) {
    const out = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      out.push({
        betweenRanks: [i + 1, i + 2],
        gap: sorted[i].score - sorted[i + 1].score
      });
    }
    return out;
  }

  // Build a tie band around the selection boundary if the boundary gap is within 2*eps.
  // Tie-band rule: adjacent items are inseparable when gap <= 2*eps.
  function tieBandAroundBoundary(sorted, eps, k) {
    const n = sorted.length;
    const cut = k - 1; // boundary between cut and cut+1 (0-indexed)
    if (cut < 0 || cut >= n - 1) return null;

    const gapAtCut = sorted[cut].score - sorted[cut + 1].score;
    if (gapAtCut > 2 * eps) return null;

    let lo = cut;
    let hi = cut + 1;

    // Expand upward while adjacent gaps are within 2*eps
    while (lo > 0) {
      const g = sorted[lo - 1].score - sorted[lo].score;
      if (g <= 2 * eps) lo--;
      else break;
    }

    // Expand downward while adjacent gaps are within 2*eps
    while (hi < n - 1) {
      const g = sorted[hi].score - sorted[hi + 1].score;
      if (g <= 2 * eps) hi++;
      else break;
    }

    return { loRank: lo + 1, hiRank: hi + 1, reason: "boundary gap <= 2ε implies boundary is inside a tie band" };
  }

  // The deterministic threshold at a boundary is forced by the two scores:
  // boundary can flip if eps >= (gap/2).
  function boundaryThreshold(sorted, k) {
    const inside = sorted[k - 1];
    const outside = sorted[k];
    const gap = inside.score - outside.score;
    return {
      insideItem: inside.item,
      outsideItem: outside.item,
      insideScore: inside.score,
      outsideScore: outside.score,
      gap,
      requiredEpsForGuarantee: gap / 2
    };
  }

  // Compute per-adjacent-pair epsilon thresholds (gap/2) for interpretability and export.
  function pairwiseThresholds(sorted) {
    const out = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i].score - sorted[i + 1].score;
      out.push({
        betweenRanks: [i + 1, i + 2],
        gap,
        requiredEpsToPreventSwap: gap / 2
      });
    }
    return out;
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

    const boundary = boundaryThreshold(sorted, k);

    // If eps < gap/2 at the boundary, the selected set is guaranteed unchanged (under bounded error model).
    const stableSelectedSet = eps < boundary.requiredEpsForGuarantee;

    // Tie band around boundary at this eps (if any).
    const band = tieBandAroundBoundary(sorted, eps, k);

    // Derive guaranteed regions and alternative defensible hard cutoffs.
    let guaranteedInMaxRank = k;     // default: top-k is safe (only true when stableSelectedSet)
    let guaranteedOutMinRank = k + 1;
    let conservativeCutoffK = k;     // smallest defensible hard cutoff
    let inclusiveCutoffK = k;        // largest defensible hard cutoff
    let tieBand = null;

    if (!band) {
      // No tie band at this eps, but the boundary could still be unstable if eps >= gap/2.
      // In that case, "no band" means boundary gap > 2*eps, which implies eps < gap/2,
      // so stableSelectedSet should be true. Still, keep logic consistent.
      guaranteedInMaxRank = k;
      guaranteedOutMinRank = k + 1;
      conservativeCutoffK = k;
      inclusiveCutoffK = k;
    } else {
      // Boundary lies inside [L..U].
      const L = band.loRank;
      const U = band.hiRank;

      // Guaranteed-in items are above the tie band.
      guaranteedInMaxRank = Math.max(0, L - 1);
      // Guaranteed-out items are below the tie band.
      guaranteedOutMinRank = Math.min(n + 1, U + 1);

      // Two defensible hard cutoffs around the uncertainty band:
      // - conservative: only take items guaranteed to remain inside
      // - inclusive: take everything up to the bottom of the tie band
      conservativeCutoffK = guaranteedInMaxRank;
      inclusiveCutoffK = U;

      tieBand = {
        loRank: L,
        hiRank: U,
        size: U - L + 1,
        spansBoundary: (L <= k && U >= k + 1),
        items: sorted.slice(L - 1, U).map((r, idx) => ({
          rank: (L - 1) + idx + 1,
          item: r.item,
          score: r.score
        }))
      };
    }

    // Helpful local comparison facts (common “5 vs 6 vs 7” type reasoning).
    const local = {
      boundaryRank: k,
      boundaryPair: { ranks: [k, k + 1], gap: boundary.gap, requiredEpsForGuarantee: boundary.requiredEpsForGuarantee },
      gapAboveBoundary: (k - 2 >= 0) ? (sorted[k - 2].score - sorted[k - 1].score) : null, // gap between k-1 and k
      gapBelowBoundary: (k + 1 < n) ? (sorted[k].score - sorted[k + 1].score) : null       // gap between k+1 and k+2
    };

    return {
      meta: { n, k, eps },
      sorted,

      // Primary interpretation objects
      boundary,
      stableSelectedSet,

      // Regions implied at this eps
      regions: {
        guaranteedIn: { fromRank: 1, toRank: guaranteedInMaxRank },
        tieBand: tieBand, // null if no band
        guaranteedOut: { fromRank: guaranteedOutMinRank, toRank: n }
      },

      // Optional "hard cutoff" suggestions around a boundary-spanning band
      // conservativeCutoffK may be 0 if tie band starts at rank 1 (rare but possible)
      suggestions: {
        conservativeCutoffK,
        inclusiveCutoffK
      },

      // Diagnostics for UI, exports, and "Explain" content
      diagnostics: {
        pairwiseThresholds: pairwiseThresholds(sorted),
        gaps: gaps(sorted),
        local
      },

      fmt
    };
  }

  window.RankSmarterAnalyze = analyze;
})();
