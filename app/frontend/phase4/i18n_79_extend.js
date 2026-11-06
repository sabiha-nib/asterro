/* ===== Interface languages: extension catalogues =====
 * i18nExtend(lang, dict) adds keys to a language registered by i18n_10–50 (it never overwrites one: a clash is
 * recorded in I18N.clash and fails the tests). The extension's own strings live in i18n_80_ext_en.js (source) and
 * i18n_81–84_ext_<lang>.js, so the original catalogues stay as they were. */
I18N.clash = [];
function i18nExtend(lang, dict) {
  const d = I18N.dict[lang]; if (!d) return;
  for (const [k, v] of Object.entries(dict)) { if (k in d && d[k] !== v) I18N.clash.push(lang + ":" + k); else d[k] = v; }
}
