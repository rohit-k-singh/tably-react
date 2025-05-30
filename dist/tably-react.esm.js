import re from "react";
var h = { exports: {} }, _ = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var D;
function te() {
  if (D) return _;
  D = 1;
  var s = Symbol.for("react.transitional.element"), l = Symbol.for("react.fragment");
  function E(m, c, o) {
    var i = null;
    if (o !== void 0 && (i = "" + o), c.key !== void 0 && (i = "" + c.key), "key" in c) {
      o = {};
      for (var v in c)
        v !== "key" && (o[v] = c[v]);
    } else o = c;
    return c = o.ref, {
      $$typeof: s,
      type: m,
      key: i,
      ref: c !== void 0 ? c : null,
      props: o
    };
  }
  return _.Fragment = l, _.jsx = E, _.jsxs = E, _;
}
var p = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var L;
function ae() {
  return L || (L = 1, process.env.NODE_ENV !== "production" && function() {
    function s(e) {
      if (e == null) return null;
      if (typeof e == "function")
        return e.$$typeof === Q ? null : e.displayName || e.name || null;
      if (typeof e == "string") return e;
      switch (e) {
        case x:
          return "Fragment";
        case J:
          return "Profiler";
        case q:
          return "StrictMode";
        case X:
          return "Suspense";
        case B:
          return "SuspenseList";
        case Z:
          return "Activity";
      }
      if (typeof e == "object")
        switch (typeof e.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), e.$$typeof) {
          case U:
            return "Portal";
          case V:
            return (e.displayName || "Context") + ".Provider";
          case z:
            return (e._context.displayName || "Context") + ".Consumer";
          case G:
            var r = e.render;
            return e = e.displayName, e || (e = r.displayName || r.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
          case H:
            return r = e.displayName || null, r !== null ? r : s(e.type) || "Memo";
          case P:
            r = e._payload, e = e._init;
            try {
              return s(e(r));
            } catch {
            }
        }
      return null;
    }
    function l(e) {
      return "" + e;
    }
    function E(e) {
      try {
        l(e);
        var r = !1;
      } catch {
        r = !0;
      }
      if (r) {
        r = console;
        var t = r.error, a = typeof Symbol == "function" && Symbol.toStringTag && e[Symbol.toStringTag] || e.constructor.name || "Object";
        return t.call(
          r,
          "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
          a
        ), l(e);
      }
    }
    function m(e) {
      if (e === x) return "<>";
      if (typeof e == "object" && e !== null && e.$$typeof === P)
        return "<...>";
      try {
        var r = s(e);
        return r ? "<" + r + ">" : "<...>";
      } catch {
        return "<...>";
      }
    }
    function c() {
      var e = j.A;
      return e === null ? null : e.getOwner();
    }
    function o() {
      return Error("react-stack-top-frame");
    }
    function i(e) {
      if (w.call(e, "key")) {
        var r = Object.getOwnPropertyDescriptor(e, "key").get;
        if (r && r.isReactWarning) return !1;
      }
      return e.key !== void 0;
    }
    function v(e, r) {
      function t() {
        Y || (Y = !0, console.error(
          "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
          r
        ));
      }
      t.isReactWarning = !0, Object.defineProperty(e, "key", {
        get: t,
        configurable: !0
      });
    }
    function d() {
      var e = s(this.type);
      return C[e] || (C[e] = !0, console.error(
        "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
      )), e = this.props.ref, e !== void 0 ? e : null;
    }
    function W(e, r, t, a, b, f, y, O) {
      return t = f.ref, e = {
        $$typeof: g,
        type: e,
        key: r,
        props: f,
        _owner: b
      }, (t !== void 0 ? t : null) !== null ? Object.defineProperty(e, "ref", {
        enumerable: !1,
        get: d
      }) : Object.defineProperty(e, "ref", { enumerable: !1, value: null }), e._store = {}, Object.defineProperty(e._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: 0
      }), Object.defineProperty(e, "_debugInfo", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: null
      }), Object.defineProperty(e, "_debugStack", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: y
      }), Object.defineProperty(e, "_debugTask", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: O
      }), Object.freeze && (Object.freeze(e.props), Object.freeze(e)), e;
    }
    function N(e, r, t, a, b, f, y, O) {
      var n = r.children;
      if (n !== void 0)
        if (a)
          if (K(n)) {
            for (a = 0; a < n.length; a++)
              A(n[a]);
            Object.freeze && Object.freeze(n);
          } else
            console.error(
              "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
            );
        else A(n);
      if (w.call(r, "key")) {
        n = s(e);
        var R = Object.keys(r).filter(function(ee) {
          return ee !== "key";
        });
        a = 0 < R.length ? "{key: someKey, " + R.join(": ..., ") + ": ...}" : "{key: someKey}", F[n + a] || (R = 0 < R.length ? "{" + R.join(": ..., ") + ": ...}" : "{}", console.error(
          `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
          a,
          n,
          R,
          n
        ), F[n + a] = !0);
      }
      if (n = null, t !== void 0 && (E(t), n = "" + t), i(r) && (E(r.key), n = "" + r.key), "key" in r) {
        t = {};
        for (var S in r)
          S !== "key" && (t[S] = r[S]);
      } else t = r;
      return n && v(
        t,
        typeof e == "function" ? e.displayName || e.name || "Unknown" : e
      ), W(
        e,
        n,
        f,
        b,
        c(),
        t,
        y,
        O
      );
    }
    function A(e) {
      typeof e == "object" && e !== null && e.$$typeof === g && e._store && (e._store.validated = 1);
    }
    var T = re, g = Symbol.for("react.transitional.element"), U = Symbol.for("react.portal"), x = Symbol.for("react.fragment"), q = Symbol.for("react.strict_mode"), J = Symbol.for("react.profiler"), z = Symbol.for("react.consumer"), V = Symbol.for("react.context"), G = Symbol.for("react.forward_ref"), X = Symbol.for("react.suspense"), B = Symbol.for("react.suspense_list"), H = Symbol.for("react.memo"), P = Symbol.for("react.lazy"), Z = Symbol.for("react.activity"), Q = Symbol.for("react.client.reference"), j = T.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, w = Object.prototype.hasOwnProperty, K = Array.isArray, k = console.createTask ? console.createTask : function() {
      return null;
    };
    T = {
      "react-stack-bottom-frame": function(e) {
        return e();
      }
    };
    var Y, C = {}, $ = T["react-stack-bottom-frame"].bind(
      T,
      o
    )(), I = k(m(o)), F = {};
    p.Fragment = x, p.jsx = function(e, r, t, a, b) {
      var f = 1e4 > j.recentlyCreatedOwnerStacks++;
      return N(
        e,
        r,
        t,
        !1,
        a,
        b,
        f ? Error("react-stack-top-frame") : $,
        f ? k(m(e)) : I
      );
    }, p.jsxs = function(e, r, t, a, b) {
      var f = 1e4 > j.recentlyCreatedOwnerStacks++;
      return N(
        e,
        r,
        t,
        !0,
        a,
        b,
        f ? Error("react-stack-top-frame") : $,
        f ? k(m(e)) : I
      );
    };
  }()), p;
}
var M;
function ne() {
  return M || (M = 1, process.env.NODE_ENV === "production" ? h.exports = te() : h.exports = ae()), h.exports;
}
var u = ne();
const se = ({
  data: s,
  columns: l,
  className: E = "",
  loading: m = !1,
  emptyMessage: c = "No data available",
  onRowClick: o
}) => m ? /* @__PURE__ */ u.jsx("div", { className: "tably-loading", children: /* @__PURE__ */ u.jsx("div", { className: "tably-spinner" }) }) : /* @__PURE__ */ u.jsx("div", { className: `overflow-x-auto ${E}`, children: /* @__PURE__ */ u.jsxs("table", { className: "tably-table", children: [
  /* @__PURE__ */ u.jsx("thead", { className: "tably-thead", children: /* @__PURE__ */ u.jsx("tr", { children: l == null ? void 0 : l.map((i) => /* @__PURE__ */ u.jsx(
    "th",
    {
      className: "tably-th",
      children: i.header
    },
    String(i.key)
  )) }) }),
  /* @__PURE__ */ u.jsx("tbody", { className: "tably-tbody", children: (s == null ? void 0 : s.length) === 0 ? /* @__PURE__ */ u.jsx("tr", { children: /* @__PURE__ */ u.jsx(
    "td",
    {
      colSpan: l == null ? void 0 : l.length,
      className: "tably-empty",
      children: c
    }
  ) }) : s == null ? void 0 : s.map((i, v) => /* @__PURE__ */ u.jsx(
    "tr",
    {
      className: `tably-tr ${o ? "tably-tr-clickable" : ""}`,
      onClick: () => o == null ? void 0 : o(i),
      children: l == null ? void 0 : l.map((d) => /* @__PURE__ */ u.jsx(
        "td",
        {
          className: `tably-td ${d.className || ""}`,
          children: d.render ? d.render(i[d.key], i) : i[d.key]
        },
        String(d.key)
      ))
    },
    v
  )) })
] }) });
export {
  se as Table,
  se as default
};
