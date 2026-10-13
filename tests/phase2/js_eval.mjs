// Evaluate AsterroLab functions for the Python parity tests: node js_eval.mjs '<json list of [fn, args]>'
import { LAB } from "./_load.mjs";
const calls = JSON.parse(process.argv[2]);
const out = calls.map(([fn, args]) => {
  if (fn === "mulberry32") { const r = LAB.mulberry32(args[0]); return Array.from({ length: args[1] }, () => r()); }
  if (fn === "canonical") return LAB.canonical(args[0]);
  const v = LAB[fn](...args);
  return v && ArrayBuffer.isView(v) ? Array.from(v) : v;
});
process.stdout.write(JSON.stringify(out));
