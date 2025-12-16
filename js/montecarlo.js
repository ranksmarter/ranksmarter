export function monteCarlo(scores, k, eps, runs=2000) {
  const base = scores.slice(0,k).map(x=>x.item).sort().join("|");
  let stable = 0;

  for (let i=0;i<runs;i++) {
    const perturbed = scores.map(s => ({
      item: s.item,
      score: s.score + (Math.random()*2-1)*eps
    })).sort((a,b)=>b.score-a.score);

    const sel = perturbed.slice(0,k).map(x=>x.item).sort().join("|");
    if (sel === base) stable++;
  }
  return stable / runs;
}
