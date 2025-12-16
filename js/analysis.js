export function analyze(scores, k, eps) {
  const sorted = [...scores].sort((a,b) => b.score - a.score);
  const sN = sorted[k-1].score;
  const sNext = sorted[k]?.score;

  if (sNext === undefined) {
    return { stable: true, threshold: Infinity };
  }

  const required = (sN - sNext) / 2;
  return {
    stable: eps < required,
    required
  };
}
