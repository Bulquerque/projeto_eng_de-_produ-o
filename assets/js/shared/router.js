// SPA Router for Visagio Static Simulator

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

  // Resolve alias if present
  if (routeAliases[hash]) {
    hash = routeAliases[hash];
  }

  const activeSectionId = routes[hash] || 'sec-diagnostico-baseline';

  // Toggle visible sections
  document.querySelectorAll('.spa-pillar').forEach((sec) => {
    if (sec.id === activeSectionId) {
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  });

  // Update topbar link states
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

  // Ensure body scroll is reset
  window.scrollTo(0, 0);
}

// Listen to hash changes and initial page load
window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', handleRoute);

// Execute immediately if script is loaded after DOMContentLoaded
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  handleRoute();
}
