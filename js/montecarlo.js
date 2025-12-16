// montecarlo.js (global)
// Provides window.RankSmarterMonteCarlo(sorted, k, eps, samples, seed)

(function () {
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function setOfTopK(sorted, k) {
    return new Set(sorted.slice(0, k).map(r => r.item));
  }

  function monteCarlo(sorted, k, eps, samples, seed) {
    const rng = mulberry32(seed >>> 0);
    const n = sorted.length;

    const baseSet = setOfTopK(sorted, k);

    let sameSet = 0;
    let overlapSum = 0;

    // inclusion count for each item
    const incl = new Map();
    for (const r of sorted) incl.set(r.item, 0);

    for (let s = 0; s < samples; s++) {
      const pert = sorted.map(r => {
        const u = rng();
        const delta = (u * 2 - 1) * eps;
        return { item: r.item, score: r.score + delta };
      }).sort((a, b) => b.score - a.score);

      const trialSet = setOfTopK(pert, k);

      // set equality check
      let ok = trialSet.size === baseSet.size;
      if (ok) {
        for (const it of baseSet) {
          if (!trialSet.has(it)) { ok = false; break; }
        }
      }
      if (ok) sameSet++;

      // overlap
      let overlap = 0;
      for (const it of trialSet) if (baseSet.has(it)) overlap++;
      overlapSum += overlap;

      // inclusion
      for (const it of trialSet) incl.set(it, (incl.get(it) || 0) + 1);
    }

    const inclusion = Array.from(incl.entries())
      .map(([item, cnt]) => ({ item, prob: cnt / samples }))
      .sort((a, b) => b.prob - a.prob);

    return {
      samples,
      seed,
      eps,
      k,
      sameSetProb: sameSet / samples,
      avgOverlapFrac: (overlapSum / samples) / k,
      inclusionTop: inclusion.slice(0, Math.min(20, inclusion.length))
    };
  }

  window.RankSmarterMonteCarlo = monteCarlo;
})();
