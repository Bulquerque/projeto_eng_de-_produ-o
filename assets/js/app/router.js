export const ROUTES = Object.freeze([
  '#/network/overview/summary',
  '#/network/overview/network',
  '#/network/overview/costs',
  '#/network/overview/tax',
  '#/network/scenarios/build',
  '#/network/scenarios/result',
  '#/network/scenarios/compare',
  '#/network/scenarios/risk',
  '#/network/scenarios/risk/advanced',
  '#/network/results/summary',
  '#/network/results/comparison',
  '#/network/results/tradeoffs',
  '#/network/results/risk',
  '#/network/results/risk/advanced',
  '#/network/optimizer/configure',
  '#/network/optimizer/results',
  '#/network/optimizer/tradeoffs',
  '#/network/trust/overview',
  '#/network/trust/evidence',
  '#/network/trust/sources',
  '#/network/trust/validation',
  '#/network/trust/methodology',
  '#/network/dev/console',
]);

const ROUTE_ALIASES = Object.freeze({
  '#/network/scenarios/result': '#/network/results/summary',
  '#/network/scenarios/compare': '#/network/results/comparison',
  '#/network/optimizer/results': '#/network/results/summary',
  '#/network/optimizer/tradeoffs': '#/network/results/tradeoffs',
  '#/network/scenarios/risk': '#/network/results/risk',
  '#/network/scenarios/risk/advanced': '#/network/results/risk/advanced',
  '#/diagnostico-baseline': '#/network/overview/summary',
  '#/simulacao-otimizacao': '#/network/scenarios/build',
  '#/homologacao-relatorio': '#/network/trust/validation',
  '#/fase-1-validacao': '#/network/overview/summary',
  '#fase-1-validacao': '#/network/overview/summary',
  '#/fase-2-baseline': '#/network/trust/overview',
  '#fase-2-baseline': '#/network/trust/overview',
  '#/fase-3-cenarios': '#/network/scenarios/build',
  '#fase-3-cenarios': '#/network/scenarios/build',
  '#/fase-4-score-otimizador': '#/network/optimizer/configure',
  '#fase-4-score-otimizador': '#/network/optimizer/configure',
  '#/fase-5-entrega-final': '#/network/trust/validation',
  '#fase-5-entrega-final': '#/network/trust/validation',
  '#fase-2-validacao': '#/network/trust/overview',
  '#/dados': '#/network/overview/summary',
  '#qualidade': '#/network/trust/overview',
  '#abas': '#/network/trust/sources',
  '#visao-geral': '#/network/overview/summary',
  '#baseline': '#/network/overview/summary',
  '#/baseline': '#/network/overview/summary',
  '#/validacao': '#/network/trust/validation',
  '#/arena': '#/network/scenarios/build',
  '#arena4': '#/network/optimizer/configure',
  '#/simulacao': '#/network/scenarios/build',
  '#/otimizacao': '#/network/optimizer/configure',
  '#/entrega': '#/network/trust/validation',
  '#/debug': '#/network/dev/console',
  '#erros': '#/network/dev/console?tab=errors',
});

export function normalizeRoute(route = '') {
  const raw = route.startsWith('#') ? route : `#${route.startsWith('/') ? route : `/${route}`}`;
  const queryIndex = raw.indexOf('?');
  const path = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : raw.slice(queryIndex);
  const alias = ROUTE_ALIASES[path];
  if (!alias) return raw;
  const [aliasPath, aliasQuery = ''] = alias.split('?');
  const mergedQuery = [aliasQuery, query.slice(1)].filter(Boolean).join('&');
  return `${aliasPath}${mergedQuery ? `?${mergedQuery}` : ''}`;
}

export function parseRoute(route = window.location.hash) {
  const normalized = normalizeRoute(route || '#/network/overview/summary');
  const [path, queryString = ''] = normalized.slice(1).split('?');
  return {
    hash: normalized,
    path: path || '/network/overview/summary',
    query: new URLSearchParams(queryString),
  };
}

export function isKnownRoute(route) {
  const normalized = normalizeRoute(route);
  const [path] = normalized.slice(1).split('?');
  return ROUTES.includes(`#${path}`);
}

export function navigate(route, { replace = false } = {}) {
  const normalized = normalizeRoute(route);
  if (!isKnownRoute(normalized)) throw new Error(`Rota não reconhecida: ${route}.`);
  if (replace) window.history.replaceState({}, '', normalized);
  else window.location.hash = normalized.slice(1);
  return normalized;
}

export function replaceCompanyQuery(companyId) {
  if (!companyId || typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  url.searchParams.set('company', companyId);
  window.history.replaceState({}, '', url);
  return url.toString();
}

export function startRouter({ initialRoute, onRouteChange } = {}) {
  const handle = () => {
    const currentHash = window.location.hash || initialRoute || '#/network/overview/summary';
    const parsed = parseRoute(currentHash);
    if (parsed.hash !== currentHash) window.history.replaceState({}, '', parsed.hash);
    onRouteChange?.(parsed);
  };
  window.addEventListener('hashchange', handle);
  window.addEventListener('popstate', handle);
  if (!window.location.hash && initialRoute) navigate(initialRoute, { replace: true });
  handle();
  return () => {
    window.removeEventListener('hashchange', handle);
    window.removeEventListener('popstate', handle);
  };
}
