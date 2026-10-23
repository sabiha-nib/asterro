/* ===== Interface languages for the Markdown report =====
 * The baseline builds the report as English Markdown (reportMD, protected). In another language the report sheet
 * shows, and "Copy as Markdown" copies, the same report with its prose, headings, labels and table cells translated
 * through the route catalogue; Markdown syntax, numbers (locale-formatted), names, identifiers and the JSON
 * reproduction block stay exactly as computed. The English report is unchanged. */
function i18gStr(s) {
  if (s == null || !/\p{L}/u.test(s)) return s;
  const t = document.createTextNode(s), k = i18gKey([t]);
  const hit = i18gLookup(k);
  if (!hit) { if (!i18gAuto(k.key)) I18G.miss.set(k.key, "report.md"); return s; }
  return i18gBuild(hit.t, k, hit.names, hit.auto).map(n => n.textContent).join("");
}
/* the pieces of a Markdown report that are translated, in order: [prefix, text, suffix] for each line or cell */
function i18gMdPieces(md) {
  const out = []; let fence = false;
  for (const line of md.split("\n")) {
    if (/^```/.test(line)) { fence = !fence; out.push({ raw: line }); continue; }
    if (fence || !line.trim()) { out.push({ raw: line }); continue; }
    if (/^\|/.test(line)) {
      if (/^\|[\s|:-]+\|$/.test(line)) { out.push({ raw: line }); continue; }
      out.push({ cells: line.split("|").slice(1, -1).map(c => c.trim()) }); continue;
    }
    const m = /^(#{1,6} |- |> |\* )?(.*?)(\s*)$/.exec(line);
    out.push({ pre: m[1] || "", text: m[2], post: m[3] || "" });
  }
  return out;
}
function i18gMarkdown(md) {
  if (I18N.lang === "en") return md;
  return i18gMdPieces(md).map(p => p.raw != null ? p.raw : p.cells ? "| " + p.cells.map(i18gStr).join(" | ") + " |" : p.pre + i18gStr(p.text) + p.post).join("\n");
}
function i18gMdHarvest(md) {
  const out = [];
  const add = s => { if (!s || !/\p{L}/u.test(s)) return; const k = i18gKey([document.createTextNode(s)]); if (!i18gAuto(k.key)) { const nk = i18gNameKey(k.key); out.push({ key: k.key, nkey: nk && nk.key, text: k.text, route: "report.md", quote: false, auto: !!(nk && i18gAuto(nk.key)) }); } };
  for (const p of i18gMdPieces(md)) { if (p.cells) p.cells.forEach(add); else if (p.text != null) add(p.text); }
  return out;
}
{ const f = showReport; showReport = function () {
  const r = f.apply(this, arguments);
  try {
    if (I18N.lang !== "en") {
      const i = needSel(); if (i == null) return r;
      const md = i18gMarkdown(reportMD(i)), pre = document.querySelector("#sheet-body pre.code");
      if (pre) pre.textContent = md;
      const b = document.getElementById("copy-md"); if (b) b.onclick = e => copyText(md, e.target);
    }
  } catch (e) { console.error(e); }
  return r;
}; }
/* a language switch while the report is open re-opens it in the new language (same place, same numbers) */
document.addEventListener("asterro:lang", () => { try { const sh = document.getElementById("sheet"); if (sh && !sh.hidden && document.getElementById("copy-md")) showReport(); } catch (e) { } });
