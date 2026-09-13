const routes = {
  '#/diagnostico-baseline': 'sec-diagnostico-baseline',
  '#/simulacao-otimizacao': 'sec-simulacao-otimizacao',
  '#/homologacao-relatorio': 'sec-homologacao-relatorio',
};

// Historical aliases for backward compatibility with tests and old bookmarks
const routeAliases = {
  '#fase-1-validacao': '#/diagnostico-baseline',
  '#fase-2-validacao': '#/diagnostico-baseline',
  '#dados': '#/diagnostico-baseline',
  '#qualidade': '#/diagnostico-baseline',
  '#abas': '#/diagnostico-baseline',
  '#visao-geral': '#/diagnostico-baseline',
  '#baseline': '#/diagnostico-baseline',
  '#/validacao': '#/diagnostico-baseline',
  '#/baseline': '#/diagnostico-baseline',

  '#arena': '#/simulacao-otimizacao',
  '#arena4': '#/simulacao-otimizacao',
  '#/simulacao': '#/simulacao-otimizacao',
  '#/otimizacao': '#/simulacao-otimizacao',

  '#/entrega': '#/homologacao-relatorio',
  '#/debug': '#/homologacao-relatorio',
  '#erros': '#/homologacao-relatorio',
};

function handleRoute() {
  let hash = window.location.hash || '#/diagnostico-baseline';

  if (routeAliases[hash]) {
    hash = routeAliases[hash];
  }

  const activeSectionId = routes[hash] || 'sec-diagnostico-baseline';

  document.querySelectorAll('.spa-pillar').forEach((sec) => {
    if (sec.id === activeSectionId) {
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  });

  document.querySelectorAll('#spaTopbar a').forEach((link) => {
    const linkHash = link.getAttribute('href');
    const isActive =
      linkHash === hash || (routeAliases[linkHash] && routeAliases[linkHash] === hash);
    link.classList.toggle('active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => {
  if (!window.__VISAGIO_NETWORK_UI__) handleRoute();
});
window.addEventListener('DOMContentLoaded', () => {
  if (!window.__VISAGIO_NETWORK_UI__) handleRoute();
});

if (
  !window.__VISAGIO_NETWORK_UI__ &&
  (document.readyState === 'interactive' || document.readyState === 'complete')
) {
  handleRoute();
}
