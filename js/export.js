export function exportJSON(result) {
  const blob = new Blob([JSON.stringify(result,null,2)], {type:"application/json"});
  download(blob, "ranksmarter.json");
}

export function exportMarkdown(result) {
  const md = `# RankSmarter Report

Verdict: ${result.stable ? "Defensible cutoff" : "Likely fake precision"}

Required accuracy: ±${result.required.toFixed(3)}
`;
  download(new Blob([md]), "ranksmarter.md");
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
