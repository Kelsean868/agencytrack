/**
 * dc-mockup-shim.js — a minimal stand-in for the design canvas runtime
 * (`support.js`) the `.dc.html` mockups in docs/design-system/proposals/
 * load. That runtime is not in the repo, so opening a mockup directly shows
 * raw `{{ }}` templates. ledger-lx-design-check.mjs serves THIS file in place
 * of `./support.js` (Playwright route) so the mockup renders the way its
 * designer saw it, for the mockup-vs-build screenshot pairs.
 *
 * Supports exactly what the ledger mockups use: `<helmet>` (moved to <head>),
 * one `<script type="text/x-dc">` defining `class Component extends DCLogic`
 * with `renderVals()`, `{{path}}` in text and attributes, `<sc-for list as>`
 * and `<sc-if value>`. `{{fn}}` in an `onClick` attribute becomes a click
 * listener. Browser-only; no network; renders the component's initial state.
 */
(function dcMockupShim() {
  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }

    setState(patch) {
      Object.assign(this.state, patch);
      if (typeof window.__dcRender === 'function') window.__dcRender();
    }
  }
  window.DCLogic = DCLogic;

  const EXPR = /\{\{\s*([^}]+?)\s*\}\}/g;

  function lookup(scope, path) {
    return path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), scope);
  }

  function interpolate(text, scope) {
    return text.replace(EXPR, (_, p) => {
      const v = lookup(scope, p.trim());
      return v == null ? '' : String(v);
    });
  }

  function singleExpr(text) {
    const m = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(text || '');
    return m ? m[1].trim() : null;
  }

  function processChildren(parent, scope) {
    for (const child of [...parent.childNodes]) processNode(child, scope);
  }

  function processNode(node, scope) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (EXPR.test(node.nodeValue)) node.nodeValue = interpolate(node.nodeValue, scope);
      EXPR.lastIndex = 0;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();

    if (tag === 'sc-for') {
      const list = lookup(scope, singleExpr(node.getAttribute('list')) || '') || [];
      const as = node.getAttribute('as') || 'item';
      const frag = document.createDocumentFragment();
      for (const item of list) {
        for (const c of node.childNodes) {
          const clone = c.cloneNode(true);
          const wrap = document.createElement('div');
          wrap.appendChild(clone);
          processChildren(wrap, { ...scope, [as]: item });
          while (wrap.firstChild) frag.appendChild(wrap.firstChild);
        }
      }
      node.replaceWith(frag);
      return;
    }

    if (tag === 'sc-if') {
      const on = Boolean(lookup(scope, singleExpr(node.getAttribute('value')) || ''));
      if (!on) { node.remove(); return; }
      processChildren(node, scope);
      node.replaceWith(...node.childNodes);
      return;
    }

    for (const attr of [...node.attributes]) {
      if (!attr.value.includes('{{')) continue;
      const path = singleExpr(attr.value);
      const v = path ? lookup(scope, path) : undefined;
      if (typeof v === 'function' && /^on/i.test(attr.name)) {
        node.removeAttribute(attr.name);
        node.addEventListener(attr.name.slice(2).toLowerCase(), v);
      } else {
        node.setAttribute(attr.name, interpolate(attr.value, scope));
      }
      EXPR.lastIndex = 0;
    }
    processChildren(node, scope);
  }

  function boot() {
    const host = document.querySelector('x-dc');
    const scriptEl = document.querySelector('script[type="text/x-dc"]');
    if (!host) return;
    const helmet = host.querySelector('helmet');
    if (helmet) {
      for (const c of [...helmet.childNodes]) document.head.appendChild(c);
      helmet.remove();
    }
    const templateHtml = host.innerHTML;
    let component = null;
    if (scriptEl) {
      // The mockup's own component class, evaluated as the design canvas does.
      const Component = new Function('DCLogic', `${scriptEl.textContent}\nreturn Component;`)(DCLogic);
      let props;
      try { props = JSON.parse(scriptEl.getAttribute('data-props') || '{}'); } catch { props = {}; }
      component = new Component(props);
    }
    window.__dcRender = () => {
      const vals = component && typeof component.renderVals === 'function' ? component.renderVals() : {};
      host.innerHTML = templateHtml;
      processChildren(host, vals || {});
    };
    window.__dcRender();
    document.documentElement.setAttribute('data-dc-rendered', '1');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
