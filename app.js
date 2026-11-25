/* CHILD-GUARD app. Plain React 18 (UMD) + the CHILD-GUARD design system; no build step. */
(function () {
  "use strict";
  var React = window.React, ReactDOM = window.ReactDOM, CG = window.ChildGuard, h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useMemo = React.useMemo, useRef = React.useRef;
  var LEVELS = ["Low", "Moderate", "High", "Very High"];
  var SCHEMA = "childguard-app/1";
  var DEFAULT_URL = "data/app_data.json";

  // ---------- helpers ----------
  function diseaseName(d) { var s = String(d || "").replace(/_/g, " ").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function seriesId(f) { return "series-" + slug(f.lga) + "--" + slug(f.disease); }
  function num(v, d) { return v == null || isNaN(v) ? "—" : Number(v).toFixed(d == null ? 3 : d); }
  function pct(v) { return v == null || isNaN(v) ? "—" : (Number(v) * 100).toFixed(1) + "%"; }
  function cases(v, d) { var t = num(v, d == null ? 0 : d); return t + (t === "1" ? " case" : " cases"); }
  function isBaseline(name) { return /naive|majority/i.test(name); }

  // ---------- storage (IndexedDB, falls back to memory) ----------
  var store = (function () {
    var dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (res, rej) {
        try {
          var r = indexedDB.open("childguard", 1);
          r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
          r.onsuccess = function () { res(r.result); };
          r.onerror = function () { rej(r.error); };
        } catch (e) { rej(e); }
      });
      return dbp;
    }
    function tx(mode, fn) {
      return open().then(function (db) {
        return new Promise(function (res, rej) {
          var t = db.transaction("kv", mode), q = fn(t.objectStore("kv"));
          t.oncomplete = function () { res(q && q.result); };
          t.onerror = function () { rej(t.error); };
        });
      });
    }
    return {
      get: function (k) { return tx("readonly", function (s) { return s.get(k); }).catch(function () { return null; }); },
      set: function (k, v) { return tx("readwrite", function (s) { s.put(v, k); }).catch(function () {}); },
      del: function (k) { return tx("readwrite", function (s) { s.delete(k); }).catch(function () {}); }
    };
  })();

  // ---------- data validation ----------
  function normalise(raw, source) {
    if (!raw || typeof raw !== "object") throw new Error("The file isn't JSON from the CHILD-GUARD pipeline.");
    if (raw.schema === SCHEMA) {
      if (!Array.isArray(raw.forecasts) || !raw.paper) throw new Error("This results file is incomplete. Re-run the pipeline's app export cell.");
      return Object.assign({ source: source }, raw);
    }
    if (raw.schema) throw new Error("This file uses format " + raw.schema + ", which this version of the app can't read. Update the app.");
    if (raw.forecasting_metrics || raw.study_period) {   // a bare paper_values.json
      return { schema: SCHEMA, source: source, paperOnly: true, forecasts: [], confusion_matrices: {}, test_predictions: [], risk_labels: LEVELS, paper: raw };
    }
    throw new Error("This doesn't look like a CHILD-GUARD results file. Load results/app_data.json from the pipeline.");
  }

  // ---------- routing ----------
  var VIEWS = [
    { id: "forecasts", label: "Forecasts", icon: "M3 17l5-6 4 3 5-7 4 4M3 21h18" },
    { id: "models", label: "Models", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
    { id: "explain", label: "Explain", icon: "M4 6h10M4 12h16M4 18h6" },
    { id: "data", label: "Data", icon: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" }
  ];
  function readHash() { var x = (location.hash || "").replace(/^#/, ""); return x || "forecasts"; }
  function useHash() {
    var s = useState(readHash()), v = s[0], set = s[1];
    useEffect(function () { function on() { set(readHash()); window.scrollTo(0, 0); } window.addEventListener("hashchange", on); return function () { window.removeEventListener("hashchange", on); }; }, []);
    return v;
  }
  function Icon(p) { return h("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, h("path", { d: p.d })); }
  function Mark() {
    return h("svg", { viewBox: "0 0 28 28", "aria-hidden": "true" },
      h("rect", { width: 28, height: 28, rx: 6, fill: "var(--brand)" }),
      [0, 1, 2].map(function (r) { return [0, 1, 2].map(function (c) {
        var hot = r === 1 && c === 2;
        return h("rect", { key: r + "-" + c, x: 5 + c * 6.5, y: 5 + r * 6.5, width: 5, height: 5, rx: 1, fill: hot ? "var(--risk-very-high)" : "var(--on-brand)", opacity: hot ? 1 : 0.85 });
      }); }));
  }

  // ---------- views ----------
  function Forecasts(p) {
    var d = p.data, s1 = useState(null), level = s1[0], setLevel = s1[1];
    var s2 = useState(""), lga = s2[0], setLga = s2[1];
    var s3 = useState(""), disease = s3[0], setDisease = s3[1];
    var all = d.forecasts;
    var lgas = useMemo(function () { return Array.from(new Set(all.map(function (f) { return f.lga; }))).sort(); }, [all]);
    var diseases = useMemo(function () { return Array.from(new Set(all.map(function (f) { return f.disease; }))).sort(); }, [all]);
    var scoped = all.filter(function (f) { return (!lga || f.lga === lga) && (!disease || f.disease === disease); });
    var counts = [0, 0, 0, 0]; scoped.forEach(function (f) { counts[f.level]++; });
    var shown = scoped.filter(function (f) { return level == null || f.level === level; })
      .sort(function (a, b) { return b.level - a.level || b.forecast - a.forecast || a.lga.localeCompare(b.lga); });
    var thr = d.paper.risk_thresholds_cases || {};
    if (d.paperOnly || !all.length) return h(Empty, { onLoad: p.onLoad, text: "This file has the paper's results but no forecasts. Re-run the pipeline, which now also writes results/app_data.json, and load that file." });
    return h(React.Fragment, null,
      h("section", { className: "section" },
        h("div", { className: "section-head" },
          h("h1", { className: "title" }, "Next-week forecast"),
          h("p", { className: "sub caption" }, "Week " + (all[0] && all[0].week) + " · issued " + (all[0] && all[0].issued_week) + " · " + d.forecast_model)),
        h("div", { className: "levels", role: "group", "aria-label": "Filter by risk level" }, LEVELS.map(function (l, i) {
          return h("button", { key: l, type: "button", className: "chip", "aria-pressed": level === i ? "true" : "false", onClick: function () { setLevel(level === i ? null : i); } },
            h(CG.RiskBadge, { level: i, size: "sm" }), h("span", { className: "n" }, counts[i]),
            h("span", { className: "caption sub" }, thr[l] ? thr[l] + " cases" : ""));
        })),
        h("div", { className: "row" },
          h("label", { className: "field" }, h("span", null, "LGA"), h("select", { id: "f-lga", value: lga, onChange: function (e) { setLga(e.target.value); } },
            h("option", { value: "" }, "All LGAs (" + lgas.length + ")"), lgas.map(function (x) { return h("option", { key: x, value: x }, x); }))),
          h("label", { className: "field" }, h("span", null, "Disease"), h("select", { id: "f-disease", value: disease, onChange: function (e) { setDisease(e.target.value); } },
            h("option", { value: "" }, "All diseases (" + diseases.length + ")"), diseases.map(function (x) { return h("option", { key: x, value: x }, diseaseName(x)); }))))),
      h("section", { className: "section", "aria-live": "polite" },
        h("p", { className: "sub caption" }, shown.length + " of " + all.length + " forecasts" + (level != null ? " at " + LEVELS[level] : "") + ", highest risk first"),
        shown.length ? h("div", { className: "tiles" }, shown.map(function (f) {
          return h("a", { key: seriesId(f), href: "#" + seriesId(f), className: "tile-btn", "aria-label": f.lga + ", " + diseaseName(f.disease) + ": " + LEVELS[f.level] + ", " + num(f.forecast, 1) + " cases forecast" },
            h(CG.ForecastTile, { lga: f.lga, disease: diseaseName(f.disease), week: f.week, forecast: f.forecast, level: f.level, history: f.history,
              note: "Last reported: " + cases(f.last_reported) + " (" + f.issued_week + ")" }));
        })) : h("p", { className: "empty" }, "No forecasts match these filters.")));
  }

  function TrackChart(p) {
    var rows = p.rows, narrow = window.innerWidth < 600, w = narrow ? 400 : 720, hh = narrow ? 240 : 260, L = 30, R = 8, T = 16, B = 26;
    if (!rows.length) return h("p", { className: "sub" }, "No test-period predictions for this series.");
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.actual, r.forecast); }).concat([p.threshold || 0, 1]));
    var top = Math.ceil(max / 2) * 2, x = function (i) { return L + (rows.length === 1 ? 0 : i * (w - L - R) / (rows.length - 1)); }, y = function (v) { return T + (1 - v / top) * (hh - T - B); };
    var line = function (k) { return rows.map(function (r, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(r[k]).toFixed(1); }).join(" "); };
    var ticks = [0, top / 2, top];
    var every = Math.max(1, Math.ceil(rows.length / (narrow ? 4 : 7)));
    return h("svg", { className: "chart", viewBox: "0 0 " + w + " " + hh, role: "img", "aria-label": "Reported cases and forecasts for the test period" },
      ticks.map(function (t) { return h("g", { key: t }, h("line", { className: "grid", x1: L, x2: w - R, y1: y(t), y2: y(t) }), h("text", { className: "axis", x: L - 6, y: y(t) + 4, textAnchor: "end" }, t)); }),
      rows.map(function (r, i) { return i % every === 0 ? h("text", { key: r.week, className: "axis", x: x(i), y: hh - 8, textAnchor: i === 0 ? "start" : "middle" }, r.week.slice(2)) : null; }),
      p.threshold != null && p.threshold <= top ? h("g", null, h("line", { className: "thr", x1: L, x2: w - R, y1: y(p.threshold), y2: y(p.threshold) }),
        h("text", { className: "thr-label", x: w - R, y: y(p.threshold) - 4, textAnchor: "end" }, "Very High above " + p.threshold)) : null,
      h("path", { className: "actual", d: line("actual") }), h("path", { className: "pred", d: line("forecast") }));
  }

  function Series(p) {
    var d = p.data, f = d.forecasts.find(function (x) { return seriesId(x) === p.id; });
    if (!f) return h("section", { className: "section" }, h("a", { className: "back", href: "#forecasts" }, "← All forecasts"), h("p", null, "This series isn't in the loaded results."));
    var rows = d.test_predictions.filter(function (r) { return r.lga === f.lga && r.disease === f.disease; });
    var mae = rows.length ? rows.reduce(function (a, r) { return a + Math.abs(r.actual - r.forecast); }, 0) / rows.length : null;
    var vh = String((d.paper.risk_thresholds_cases || {})["Very High"] || "").match(/[\d.]+/);
    return h(React.Fragment, null,
      h("section", { className: "section" },
        h("a", { className: "back", href: "#forecasts" }, "← All forecasts"),
        h("div", { className: "section-head" }, h("div", null, h("p", { className: "label sub" }, f.lga), h("h1", { className: "title" }, diseaseName(f.disease))), h(CG.RiskBadge, { level: f.level })),
        h("dl", { className: "stats" },
          stat("Forecast for " + f.week, num(f.forecast, 1) + " cases"), stat("Last reported (" + f.issued_week + ")", cases(f.last_reported)),
          stat("Test-period MAE, this series", mae == null ? "—" : num(mae) + " cases"), stat("Test weeks", rows.length))),
      h("section", { className: "panel" },
        h("h2", { className: "heading" }, "Track record on the test period"),
        h("div", { className: "legend" }, h("span", null, h("i", { className: "a" }), "Reported"), h("span", null, h("i", { className: "p" }), "Forecast (one week ahead)"), vh ? h("span", null, h("i", { className: "t" }), "Very High cut-off") : null),
        h(TrackChart, { rows: rows, threshold: vh ? Number(vh[0]) : null }),
        h("p", { className: "caption sub" }, "Each forecast was made a week ahead using only data available at the time.")));
  }

  function stat(k, v) { return h("div", { className: "stat", key: k }, h("dt", null, k), h("dd", null, v)); }

  function Models(p) {
    var pv = p.data.paper, fm = pv.forecasting_metrics || {}, cs = pv.classification_summary || {}, cms = p.data.confusion_matrices || {};
    var names = Object.keys(cms), s = useState(names.indexOf("XGBoost classifier (balanced weights)") >= 0 ? "XGBoost classifier (balanced weights)" : names[0]), cm = s[0], setCm = s[1];
    var rows = Object.keys(fm).map(function (m) { return { model: m, kind: isBaseline(m) ? "baseline" : "model", MAE: fm[m].MAE, RMSE: fm[m].RMSE, R2: fm[m].R2 }; })
      .sort(function (a, b) { return (a.kind === "baseline" ? 0 : 1) - (b.kind === "baseline" ? 0 : 1); });
    var crow = Object.keys(cs).map(function (m) { var c = cs[m]; return { model: m, kind: isBaseline(m) ? "baseline" : "model", acc: c.accuracy, bal: c.balanced_accuracy, f1: c.macro_F1, k: c.linear_weighted_kappa, mcc: c.MCC, vh: c.very_high_recall }; });
    var high = function (k, l) { return { key: k, label: l, better: "high" }; };
    return h(React.Fragment, null,
      h("section", { className: "section" }, h("h1", { className: "title" }, "Forecast accuracy"),
        h(CG.MetricTable, { rows: rows, caption: "Test period " + (pv.test_period || "—") + " · next-week cases · " + (pv.n_test || "—") + " LGA-disease-weeks. LSTM rows are scored on one LGA only." })),
      h("section", { className: "section" }, h("h2", { className: "heading" }, "Risk-level classification"),
        h(CG.MetricTable, { rows: crow, caption: "Test period " + (pv.test_period || "—") + ". κ is linear-weighted. Very High recall is the share of Very High weeks caught.",
          columns: [high("acc", "Accuracy"), high("bal", "Balanced acc."), high("f1", "Macro F1"), high("k", "κ"), high("mcc", "MCC"), high("vh", "Very High recall")] })),
      names.length ? h("section", { className: "section" },
        h("div", { className: "section-head" }, h("h2", { className: "heading" }, "Confusion matrix"),
          h("div", { className: "seg", role: "group", "aria-label": "Classifier" }, names.filter(function (n) { return !/majority/i.test(n); }).map(function (n) {
            return h("button", { key: n, type: "button", "aria-pressed": n === cm ? "true" : "false", onClick: function () { setCm(n); } }, n.replace(/^XGBoost classifier /, "").replace(/^Binned tuned-XGBoost forecasts$/, "binned forecasts").replace(/[()]/g, ""));
          }))),
        h(CG.ConfusionMatrix, { matrix: cms[cm], caption: cm + " · rows are actual levels, columns predicted · test period" })) : null);
  }

  function Explain(p) {
    var pv = p.data.paper, shap = pv.mean_abs_shap_top10 || {}, hp = pv.xgboost_tuned_hyperparameters || {};
    var features = Object.keys(shap).map(function (k) { return { name: k, value: shap[k], group: /^(week_number|month)$/.test(k) ? "calendar" : undefined }; });
    return h(React.Fragment, null,
      h("section", { className: "section" }, h("h1", { className: "title" }, "What drives the forecast"),
        features.length ? h(CG.ShapBar, { features: features, caption: "Mean |SHAP| on the test set, tuned XGBoost regressor (top 10). Grey bars are calendar features." }) : h("p", { className: "sub" }, "The loaded results have no SHAP values."),
        pv.calendar_share_of_attribution != null ? h("dl", { className: "stats" }, stat("Calendar share of attribution", pct(pv.calendar_share_of_attribution))) : null,
        h("p", { className: "manuscript sub" }, "A large calendar share means the model leans on seasonal timing more than on case history, weather or vaccination coverage. Read forecasts for unusual weeks with that in mind.")),
      Object.keys(hp).length ? h("section", { className: "section" }, h("h2", { className: "heading" }, "Tuned model settings"),
        h("dl", { className: "stats" }, Object.keys(hp).map(function (k) { return stat(k.replace(/_/g, " "), String(hp[k])); })),
        pv.tuning ? h("p", { className: "caption sub" }, "Chosen by " + pv.tuning + ".") : null) : null);
  }

  function DataView(p) {
    var d = p.data, pv = d.paper, ic = pv.integrity_checks || {}, sec = pv.security || {};
    var pois = (sec.poisoning_experiment || []).map(function (r) { return { model: pct(r.poisoned_share) + " of reports zeroed", kind: r.poisoned_share === 0 ? "baseline" : "model", MAE: r.MAE, bias: r.mean_forecast_bias, vhm: r.MAE_very_high_weeks, vh: r.very_high_weeks_still_forecast_very_high }; });
    return h(React.Fragment, null,
      h("section", { className: "section" }, h("h1", { className: "title" }, "Data and provenance"),
        h("dl", { className: "stats" },
          stat("Data", pv.data_is_synthetic ? "Synthetic demo" : "Surveillance records"), stat("Study period", pv.study_period || "—"),
          stat("Training period", pv.train_period || "—"), stat("Test period", pv.test_period || "—"),
          stat("Records", (pv.n_raw_records || "—") + " raw · " + (pv.n_model_records || "—") + " modelled"),
          stat("LGAs", (pv.lgas || []).length), stat("Diseases", (pv.diseases || []).map(diseaseName).join(", ") || "—"),
          stat("Results generated", d.generated_at ? d.generated_at.replace("T", " ").replace("Z", " UTC") : "—"),
          pv.dataset_sha256 ? stat("Dataset SHA-256", pv.dataset_sha256) : null)),
      h("section", { className: "section" }, h("h2", { className: "heading" }, "Integrity checks"),
        h("dl", { className: "stats" }, Object.keys(ic).map(function (k) { return stat(k.replace(/_/g, " "), ic[k]); }))),
      pois.length ? h("section", { className: "section" }, h("h2", { className: "heading" }, "Robustness to falsified reports"),
        h(CG.MetricTable, { rows: pois, caption: "Tuned XGBoost retrained with a share of training reports set to zero. " + (sec.share_of_rows_suppressed_k5 != null ? pct(sec.share_of_rows_suppressed_k5) + " of rows would be suppressed (<5) before publication." : ""),
          columns: [{ key: "MAE", label: "MAE", better: "low" }, { key: "bias", label: "Bias", better: "high" }, { key: "vhm", label: "MAE, Very High weeks", better: "low" }, { key: "vh", label: "Very High still caught", better: "high" }] })) : null,
      h("section", { className: "panel" }, h("h2", { className: "heading" }, "Results file"),
        h("p", { className: "sub" }, d.source === "upload" ? "Loaded from a file on this device and kept for offline use." : "Loaded from this app's server (" + DEFAULT_URL + ")."),
        h("div", { className: "row" }, h(LoadButton, { onLoad: p.onLoad, primary: true }), d.source === "upload" ? h("button", { type: "button", className: "btn", onClick: p.onReset }, "Use the server's results") : null)));
  }

  function LoadButton(p) {
    var ref = useRef(null);
    return h(React.Fragment, null,
      h("button", { type: "button", className: "btn" + (p.primary ? " btn-primary" : ""), onClick: function () { ref.current.click(); } }, "Load results file"),
      h("input", { ref: ref, id: "file-" + (p.primary ? "p" : "s"), type: "file", accept: ".json,application/json", className: "visually-hidden", tabIndex: -1, "aria-hidden": "true",
        onChange: function (e) { var f = e.target.files[0]; e.target.value = ""; if (f) p.onLoad(f); } }));
  }

  function Empty(p) {
    return h("section", { className: "empty" }, h("h1", { className: "heading" }, "No results loaded"),
      h("p", null, p.text || "Load results/app_data.json, which the CHILD-GUARD pipeline writes at the end of a run."), h(LoadButton, { onLoad: p.onLoad, primary: true }));
  }

  // ---------- app ----------
  function App() {
    var route = useHash();
    var s1 = useState(null), data = s1[0], setData = s1[1];
    var s2 = useState(null), error = s2[0], setError = s2[1];
    var s3 = useState(true), loading = s3[0], setLoading = s3[1];
    var s4 = useState(null), toast = s4[0], setToast = s4[1];

    function flash(t) { setToast(t); setTimeout(function () { setToast(null); }, 2600); }
    function fromServer() {
      return fetch(DEFAULT_URL, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("No results on the server yet."); return r.json(); })
        .then(function (j) { var n = normalise(j, "server"); setData(n); store.set("data", n); return n; });
    }
    useEffect(function () {
      store.get("data").then(function (saved) {
        if (saved && saved.source === "upload") { setData(saved); setLoading(false); return; }
        if (saved) setData(saved);   // show the cached copy at once, then refresh
        return fromServer().catch(function (e) { if (!saved) setError(e.message); }).then(function () { setLoading(false); });
      });
    }, []);

    function onLoad(file) {
      file.text().then(function (t) { var j; try { j = JSON.parse(t); } catch (e) { throw new Error("That file isn't valid JSON. Load results/app_data.json from the pipeline."); } return normalise(j, "upload"); })
        .then(function (n) { setData(n); setError(null); store.set("data", n); flash("Results loaded"); })
        .catch(function (e) { setError(e.message); });
    }
    function onReset() { store.del("data"); fromServer().then(function () { flash("Using the server's results"); }).catch(function (e) { setError(e.message); }); }

    var view = route.indexOf("series-") === 0 ? "forecasts" : (VIEWS.some(function (v) { return v.id === route; }) ? route : "forecasts");
    var body;
    if (!data) body = loading ? h("p", { className: "sub" }, "Loading results…") : h(Empty, { onLoad: onLoad });
    else if (route.indexOf("series-") === 0) body = h(Series, { data: data, id: route });
    else if (view === "models") body = h(Models, { data: data });
    else if (view === "explain") body = h(Explain, { data: data });
    else if (view === "data") body = h(DataView, { data: data, onLoad: onLoad, onReset: onReset });
    else body = h(Forecasts, { data: data, onLoad: onLoad });
    var first = data && data.forecasts && data.forecasts[0];

    return h("div", { className: "shell" },
      h("header", { className: "top" }, h("a", { className: "brandmark", href: "#forecasts", style: { color: "inherit", textDecoration: "none" } }, h(Mark), "CHILD-GUARD"),
        first ? h("span", { className: "week" }, first.week) : null),
      h("nav", { className: "tabs", "aria-label": "Sections" }, VIEWS.map(function (v) {
        return h("a", { key: v.id, className: "tab", href: "#" + v.id, "aria-current": view === v.id ? "page" : undefined }, h(Icon, { d: v.icon }), v.label);
      })),
      h("main", { className: "main", id: "main" },
        error ? h("p", { className: "error", role: "alert" }, error) : null,
        data && data.paper && data.paper.data_is_synthetic ? h(CG.DataNotice, { kind: "synthetic" }, "These results come from the pipeline's generated demo data. Load results from a run on the surveillance CSV before acting on them.") : null,
        body),
      toast ? h("div", { className: "toast", role: "status" }, toast) : null);
  }

  ReactDOM.createRoot(document.getElementById("app")).render(h(App));

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
