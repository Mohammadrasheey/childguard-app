/* CHILD-GUARD design system v1.0.0 — generated from src/tokens.json; do not edit */
/* @ds-bundle: {"format":4,"namespace":"ChildGuard","components":[{"name":"RiskBadge"},{"name":"DataNotice"},{"name":"ForecastTile"},{"name":"MetricTable"},{"name":"ConfusionMatrix"},{"name":"ShapBar"},{"name":"CodeBlock"}]} */
(function () {
  var root = typeof window !== "undefined" ? window : {};
  var React = root.React || require("react"), h = React.createElement;
  var LEVELS = ["low", "moderate", "high", "very-high"];
  var LEVEL_NAMES = { "low": "Low", "moderate": "Moderate", "high": "High", "very-high": "Very High" };
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(" "); }
  function levelKey(l) {
    if (typeof l === "number") return LEVELS[Math.max(0, Math.min(3, l))];
    var k = String(l || "low").toLowerCase().replace(/\s+risk$/, "").replace(/\s+/g, "-");
    return LEVELS.indexOf(k) >= 0 ? k : "low";
  }
  function fmt(v, d) { return v == null || isNaN(v) ? "—" : Number(v).toFixed(d == null ? 3 : d); }

  function RiskBadge(p) {
    var k = levelKey(p.level);
    var steps = h("span", { className: "cg-risk-steps", "aria-hidden": "true" },
      LEVELS.map(function (s, i) { return h("i", { key: s, className: i <= LEVELS.indexOf(k) ? "on" : "" }); }));
    return h("span", { className: cx("cg-risk", "cg-risk-" + k, p.size === "sm" && "cg-risk-sm", p.className) },
      p.size === "sm" ? null : steps, LEVEL_NAMES[k]);
  }

  function DataNotice(p) {
    var kind = p.kind || "synthetic";
    var title = p.title || (kind === "synthetic" ? "Synthetic demo data" : "Data-integrity check");
    return h("div", { className: "cg-notice", role: "status" },
      h("span", { className: "cg-notice-mark", "aria-hidden": "true" }, "!"),
      h("div", null, h("p", { className: "cg-notice-title" }, title), h("p", { className: "cg-notice-body" }, p.children)));
  }

  function Sparkline(p) {
    var d = p.data || [], w = 120, hgt = 32;
    if (d.length < 2) return null;
    var max = Math.max.apply(null, d.concat([1])), step = w / (d.length - 1);
    var pts = d.map(function (v, i) { return [i * step, hgt - 2 - (v / max) * (hgt - 6)]; });
    var line = pts.map(function (q, i) { return (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1); }).join(" ");
    var last = pts[pts.length - 1];
    return h("svg", { className: "cg-spark", viewBox: "0 0 " + (w + 4) + " " + hgt, width: w + 4, height: hgt, "aria-hidden": "true" },
      h("path", { className: "cg-spark-area", d: line + " L" + last[0].toFixed(1) + " " + hgt + " L0 " + hgt + " Z" }),
      h("path", { className: "cg-spark-line", d: line }),
      h("circle", { className: "cg-spark-end", cx: last[0], cy: last[1], r: 2.5 }));
  }

  function ForecastTile(p) {
    return h("article", { className: "cg-tile" },
      h("header", { className: "cg-tile-head" },
        h("div", null, h("p", { className: "cg-tile-place" }, p.lga), h("p", { className: "cg-tile-disease" }, p.disease)),
        h(RiskBadge, { level: p.level })),
      h("div", { className: "cg-tile-body" },
        h("div", null,
          h("p", { className: "cg-tile-label" }, "Forecast for " + (p.week || "next week")),
          h("p", { className: "cg-tile-metric" }, fmt(p.forecast, p.decimals == null ? 1 : p.decimals), h("span", null, p.unit || "cases"))),
        h(Sparkline, { data: p.history })),
      p.note ? h("p", { className: "cg-tile-note" }, p.note) : null);
  }

  function MetricTable(p) {
    var cols = p.columns || [{ key: "MAE", label: "MAE", better: "low" }, { key: "RMSE", label: "RMSE", better: "low" }, { key: "R2", label: "R²", better: "high" }];
    var rows = p.rows || [];
    var best = {};
    cols.forEach(function (c) {
      var vals = rows.filter(function (r) { return r.kind !== "baseline" && r[c.key] != null; }).map(function (r) { return r[c.key]; });
      if (vals.length) best[c.key] = c.better === "high" ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    });
    return h("div", { className: "cg-table-wrap" }, h("table", { className: "cg-table" },
      p.caption ? h("caption", null, p.caption) : null,
      h("thead", null, h("tr", null, h("th", { scope: "col" }, "Model"), cols.map(function (c) { return h("th", { key: c.key, scope: "col", className: "num" }, c.label); }))),
      h("tbody", null, rows.map(function (r) {
        return h("tr", { key: r.model, className: r.kind === "baseline" ? "is-baseline" : "" },
          h("th", { scope: "row" }, r.model, r.kind === "baseline" ? h("span", { className: "cg-tag" }, "baseline") : null),
          cols.map(function (c) { var v = r[c.key]; return h("td", { key: c.key, className: cx("num", r.kind !== "baseline" && v === best[c.key] && "is-best") }, fmt(v, c.decimals)); }));
      }))));
  }

  function ConfusionMatrix(p) {
    var labels = p.labels || ["Low", "Moderate", "High", "Very High"], m = p.matrix || [];
    var max = Math.max.apply(null, [1].concat([].concat.apply([], m)));
    return h("div", { className: "cg-table-wrap" }, h("table", { className: "cg-cm" },
      p.caption ? h("caption", null, p.caption) : null,
      h("thead", null, h("tr", null, h("th", { className: "cg-cm-corner", scope: "col" }, "Actual ↓  Predicted →"),
        labels.map(function (l) { return h("th", { key: l, scope: "col" }, l); }))),
      h("tbody", null, m.map(function (row, i) {
        return h("tr", { key: i }, h("th", { scope: "row" }, labels[i]), row.map(function (v, j) {
          var b = v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999));
          return h("td", { key: j, className: cx("heat-" + b, i === j && "is-diag") }, v);
        }));
      }))));
  }

  function ShapBar(p) {
    var f = (p.features || []).slice().sort(function (a, b) { return Math.abs(b.value) - Math.abs(a.value); });
    var max = p.max || Math.max.apply(null, f.map(function (x) { return Math.abs(x.value); }).concat([0.0001]));
    return h("figure", { className: "cg-shap" },
      h("ol", null, f.map(function (x) {
        var pct = Math.abs(x.value) / max * 100;
        return h("li", { key: x.name },
          h("span", { className: "cg-shap-name" }, x.label || x.name),
          h("span", { className: "cg-shap-track" }, h("span", { className: cx("cg-shap-bar", x.value < 0 && "neg", x.group === "calendar" && "calendar"), style: { width: pct + "%" } })),
          h("span", { className: "cg-shap-val" }, (x.value < 0 ? "−" : "+") + fmt(Math.abs(x.value), 2)));
      })),
      p.caption ? h("figcaption", null, p.caption) : null);
  }

  function CodeBlock(p) {
    return h("figure", { className: "cg-code" },
      p.title ? h("figcaption", null, p.title) : null,
      h("pre", null, h("code", null, p.children)));
  }

  var api = {
    RiskBadge: RiskBadge, DataNotice: DataNotice, ForecastTile: ForecastTile, MetricTable: MetricTable,
    ConfusionMatrix: ConfusionMatrix, ShapBar: ShapBar, CodeBlock: CodeBlock, RISK_LEVELS: LEVELS
  };
  if (typeof module === "object" && module && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ChildGuard = Object.assign(window.ChildGuard || {}, api);
})();
