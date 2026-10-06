import subprocess
from pathlib import Path

from playwright.sync_api import sync_playwright
from test_network_ui_playwright import read_optional_password, run_server

ROOT = Path(__file__).resolve().parents[2]


def test_chart_data_integrity():
    subprocess.run(
        [
            'node',
            '--input-type=module',
            '-e',
            """
      import assert from 'node:assert/strict';
      import { mapMetrics, renderNetworkSvg } from './assets/js/app/charts/charts.js';
      import { countStatuses, countEvidenceClasses } from './assets/js/app/charts/trust-analytics.js';
      assert.equal(mapMetrics([{volume:100},{origin_uf:'SP'}]).covered,0);
      const topology = renderNetworkSvg(Array.from({length:12},(_,i)=>({origin:`O${i}`,cd:`C${i}`,destination:`D${i}`})));
      assert.equal((topology.match(/data-network-edge=/g)||[]).length,24);
      assert(topology.includes('data-network-edge="c11 d11"'));
      assert(!renderNetworkSvg([{destination:'Somente destino'}]).includes('data-network-edge='));
      assert.deepEqual([...mapMetrics([{origin_uf:'SP',destination_uf:'RJ'},{destination_uf:'RJ'},{uf:'INVALID'}]).metrics],[['RJ',2]]);
      assert.deepEqual(countStatuses([{status:'pass'},{status:'fail'},{status:'pass'},{}]),[['pass',2],['fail',1],['Não informado',1]]);
      assert.deepEqual(countEvidenceClasses([{classification:'proxy'},{classification:'observed'},{classification:'proxy'},{status:'synthetic'},{}]),[['proxy',2],['observed',1],['synthetic',1],['Não informado',1]]);
    """,
        ],
        cwd=ROOT,
        check=True,
    )


def test_renderer_values_interactions_and_cleanup():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1200, 'height': 900})
        page.goto(f'http://127.0.0.1:{port}/', wait_until='networkidle')
        page.evaluate("""async () => {
          const charts = await import('/assets/js/core/chart-renderer.js');
          charts.destroyAllCharts();
          document.body.classList.remove('network-ui-active');
          document.body.innerHTML = '<div style="width:800px"><canvas id="signed" style="width:800px;height:300px"></canvas></div>';
          window.testCharts = charts;
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            const context = originalGetContext.call(this, type, ...args);
            if (type !== '2d' || context.__tickProbe) return context;
            context.__tickProbe = true;
            const originalArc = context.arc.bind(context);
            context.arc = (x,y,...rest) => {
              (window.chartArcs ||= []).push({x,y});
              return originalArc(x,y,...rest);
            };
            const originalFillText = context.fillText.bind(context);
            context.fillText = (text, x, y, ...rest) => {
              (window.chartTickCalls ||= []).push({text:String(text),x,y});
              return originalFillText(text,x,y,...rest);
            };
            return context;
          };
          charts.renderBarChart('signed', {labels:['Ganho','Perda','Ausente'], datasets:[{label:'Delta',data:[125,-80,null]}],indexAxis:'y',xFormat:'money',yFormat:'money'});
        }""")
        ticks = page.evaluate(
            """() => [...new Map(window.chartTickCalls.filter(({text,y}) => text.startsWith('R$') && y > 250).sort((a,b) => a.x-b.x).map(({text,x}) => [x,{text,x}])).values()]"""
        )
        assert len(ticks) == 5, ticks
        amounts = [float(tick['text'].replace('R$', '').replace('.', '').replace(',', '.').strip()) for tick in ticks]
        assert amounts == sorted(amounts), ticks
        assert ticks[0]['x'] < ticks[-1]['x'], ticks
        page.locator('.vg-chart-data summary').click()
        table = page.locator('.vg-chart-data').inner_text()
        assert '125' in table and '-80' in table and 'Sem dado' in table
        page.locator('#signed').focus()
        page.keyboard.press('Home')
        assert 'Ganho' in page.locator('.vg-chart-tooltip').inner_text()
        page.keyboard.press('ArrowRight')
        assert 'Perda' in page.locator('.vg-chart-tooltip').inner_text()
        assert '-80' in page.locator('.vg-chart-tooltip').inner_text()
        assert page.locator('.vg-chart-controls button[aria-pressed]').count() == 0
        page.evaluate("""() => window.testCharts.renderBarChart('signed', {
          labels:['Ganho','Perda','Ausente'], datasets:[
            {label:'Delta',data:[125,-80,null]}, {label:'Comparação',data:[90,-20,null]}],
          indexAxis:'y',xFormat:'money',yFormat:'money'})""")
        page.locator('.vg-chart-controls button[aria-pressed]').first.click()
        assert page.locator('.vg-chart-controls button[aria-pressed]').first.get_attribute('aria-pressed') == 'false'
        page.evaluate('window.testCharts.destroyAllCharts()')
        assert page.locator('.vg-chart-tooltip,.vg-chart-controls,.vg-chart-data').count() == 0
        page.evaluate("""() => window.testCharts.renderScatterChart('signed', {
          datasets:[{label:'Cenários',data:[{id:'a',x:150,y:-12,label:'Cenário A'},{id:'b',x:450,y:18,label:'Cenário B'}]}],
          xLabel:'Custo', yLabel:'Saving',xFormat:'money',yFormat:'percent',
          onActivate: point => { window.activatedScenario = point.id; }})""")
        page.locator('#signed').focus()
        page.keyboard.press('Home')
        text = page.locator('.vg-chart-tooltip').inner_text()
        assert 'Cenário A' in text and 'Custo: R$' in text and 'Saving: -12%' in text
        assert page.evaluate('window.activatedScenario === undefined')
        first_point = page.evaluate('window.chartArcs[0]')
        page.locator('#signed').click(position=first_point)
        assert page.evaluate('window.activatedScenario') == 'a'
        page.locator('#signed').click(position={'x': 5, 'y': 5})
        assert page.evaluate('window.activatedScenario') == 'a'

        page.keyboard.press('End')
        page.keyboard.press('Enter')
        assert page.evaluate('window.activatedScenario') == 'b'
        page.keyboard.press('Home')
        page.keyboard.press('Space')
        assert page.evaluate('window.activatedScenario') == 'a'

        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(100)
        assert page.locator('#signed').evaluate('c => c.width > 0')
        page.evaluate('window.testCharts.destroyAllCharts(); window.activatedScenario = null')
        page.locator('#signed').focus()
        page.keyboard.press('Enter')
        assert page.evaluate('window.activatedScenario') is None

        browser.close()


def test_results_comparison_chart_has_state_backed_data_and_pixels():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(
            f'http://127.0.0.1:{port}/?company=empresa_mock#/network/overview/network',
            wait_until='networkidle',
        )
        page.locator('[data-testid="network-flow-analytics"]').wait_for(state='visible')
        page.evaluate("window.location.hash = '#/network/scenarios/build'")
        page.locator('[data-testid="page-scenarios-build"]').wait_for(state='visible')
        page.locator('[data-testid="scenario-library"] > summary').click()
        page.locator('[data-testid="scenario-load-mock_consolidation"]').click()
        page.locator('[data-testid="scenario-run"]').click()
        page.locator('[data-testid="page-results-summary"]').wait_for(state='visible', timeout=20000)
        page.locator('[data-route="#/network/results/comparison"]').first.click()
        page.locator('[data-testid="page-results-comparison"]').wait_for(state='visible')
        canvas = page.locator('#niComparisonCostChart')
        canvas.wait_for(state='visible')
        data_table = page.locator('#niComparisonCostChart + .vg-chart-controls + .vg-chart-data')
        data_table.wait_for(state='attached')
        data_table.locator('summary').click()
        chart_rows = data_table.locator('tbody tr').evaluate_all(
            'rows => rows.map(row => [...row.cells].map(cell => cell.innerText.trim()))'
        )
        assert len(chart_rows) >= 2, chart_rows
        assert all(len(row) == 2 and row[1] not in ('', '—') for row in chart_rows), chart_rows
        assert chart_rows[0][0] == 'Referência', chart_rows
        assert len(chart_rows) == page.locator('.ni-workspace-matrix-wrap thead th').count() - 1
        matrix_costs = page.locator('.ni-workspace-matrix-wrap tbody tr').evaluate_all(
            "rows => { const row = rows.find(item => item.cells[0]?.innerText.trim() === 'Custo total'); return row ? [...row.cells].slice(1).map(cell => cell.innerText.trim().replace(/\\s+/g, ' ')) : []; }"
        )
        assert [row[1].replace('\xa0', ' ') for row in chart_rows] == matrix_costs, (chart_rows, matrix_costs)
        assert page.evaluate("""() => {
          const canvas = document.querySelector('#niComparisonCostChart');
          if (!canvas || !canvas.width || !canvas.height) return false;
          const ctx = canvas.getContext('2d');
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let colored = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 3] > 0 && (pixels[i] < 245 || pixels[i + 1] < 245 || pixels[i + 2] < 245)) colored++;
          }
          return colored > 100;
        }"""), 'comparison canvas has no visible chart marks or labels'
        page.screenshot(path='/tmp/visagio-comparison-chart-desktop.png', full_page=True)
        assert page.locator('.ni-results-comparison .ni-comparison-cards').is_hidden()
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.locator('.ni-results-comparison .ni-comparison-cards').is_visible()
        assert page.locator('.ni-results-comparison .ni-workspace-matrix-wrap').is_hidden()
        page.screenshot(path='/tmp/visagio-comparison-chart-mobile.png', full_page=True)
        assert not errors, errors
        browser.close()


def test_selected_company_charts_and_geography():
    password = read_optional_password()
    assert password, 'Chave local necessária para verificar gráficos das empresas reais'
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for company in ('empresa_mock', 'empresa1', 'empresa2'):
            page = browser.new_page(viewport={'width': 1440, 'height': 1000})
            errors = []
            page.on('pageerror', lambda error, collected=errors: collected.append(str(error)))
            page.goto(f'http://127.0.0.1:{port}/?company={company}#/network/overview/network', wait_until='networkidle')
            if company != 'empresa_mock':
                page.locator('#cryptoPasswordInput').fill(password)
                page.locator('#cryptoPasswordPrompt button[type="submit"]').click()
                page.locator('#cryptoPasswordPrompt').wait_for(state='detached', timeout=30000)
            page.locator('[data-testid="page-overview-network"]').wait_for(state='visible', timeout=30000)
            page.locator('#networkLoadingOverlay').wait_for(state='hidden', timeout=30000)
            assert page.locator('[data-testid="company-selector"]').input_value() == company
            page.locator('[data-uf="SP"]').focus()
            assert 'fluxo(s)' in page.locator('.ni-map-detail').inner_text()
            page.locator('[data-network-node]').first.focus()
            assert 'registro(s)' in page.locator('.ni-network-detail').inner_text()
            assert page.locator('[data-network-edge].is-highlighted').count() > 0
            assert page.locator('.vg-chart-controls').count() > 0
            if company == 'empresa_mock':
                assert page.locator('[data-chart-summary="niVolumeByCdChart"]').inner_text() == (
                    '10/10 fluxos com peso informado · toneladas'
                )
                assert page.locator('[data-chart-summary="niDistanceHistogramChart"]').inner_text() == (
                    '10/10 fluxos com distância'
                )
            else:
                summaries = page.locator(
                    '[data-chart-summary="niVolumeByCdChart"], [data-chart-summary="niDistanceHistogramChart"]'
                ).all_inner_texts()
                assert all('undefined' not in summary.lower() for summary in summaries)
            page.evaluate("window.location.hash = '#/network/overview/costs'")
            page.locator('[data-testid="page-overview-costs"]').wait_for(state='visible')
            assert page.locator('.vg-chart-controls').count() > 0
            source_matches = page.evaluate(
                """async company => {
              const baseline = company === 'empresa_mock'
                ? await (await fetch('/data-demo/empresa_mock/baseline.json')).json()
                : await (await import('/assets/js/core/data-loader.js')).loadPhase2Bundle(company);
              const costs = baseline.costs.costs;
              const keys = ['transfer_cost','distribution_cost','storage_cost','inventory_cost','tax_impact'];
              const cells = [...document.querySelector('#niOverviewCostCompositionChart').parentElement
                .querySelectorAll('.vg-chart-data tbody td')].map(c => c.textContent);
              const expected = keys.filter(k => costs[k] != null && Number.isFinite(Number(costs[k])))
                .map(k => `R$ ${Number(costs[k]).toLocaleString('pt-BR',{maximumFractionDigits:2})}`);
              return cells.length === expected.length && cells.every((v,i) => v === expected[i]);
            }""",
                company,
            )
            assert source_matches, f'Composição diverge da fonte de {company}'
            assert not errors, errors
            print(f'CHART_TENANT_OK {company}')
            page.close()
        browser.close()


def test_mobile_chart_touch_and_width():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        page.goto(f'http://127.0.0.1:{port}/?company=empresa_mock#/network/overview/costs', wait_until='networkidle')
        chart = page.locator('#niOverviewCostCompositionChart')
        chart.wait_for()
        chart.evaluate("canvas => canvas.scrollIntoView({block:'center'})")
        chart.tap(position={'x': 150, 'y': 110})
        assert page.locator('.vg-chart-tooltip:visible').count() == 1
        assert 'R$' in page.locator('.vg-chart-tooltip:visible').inner_text()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
        browser.close()


def test_mock_monetary_percentiles_are_derived_from_fixture_costs():
    with run_server() as port, sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f'http://127.0.0.1:{port}/', wait_until='networkidle')
        matches = page.evaluate("""async () => {
          const {createMockProvider} = await import('/assets/js/app/providers/mock-provider.js');
          const provider = await createMockProvider();
          await provider.init({company_id:'empresa_mock',runtime_mode:'project'});
          const {baseline} = await provider.loadBaseline();
          const scenarioLibrary = await provider.loadScenarioLibrary();
          const fixtureScenario = scenarioLibrary.scenarios.find(
            scenario => scenario.scenario_id === baseline.model.scenario_id
          );
          if (!fixtureScenario) throw new Error('Cenário baseline ausente na fixture mock.');
          const scenarioRun = await provider.runScenario({scenario:fixtureScenario});
          const risk = await provider.runRiskSuite({
            selectedScenario:scenarioRun.scenario,
            deterministicResult:scenarioRun.result
          });
          const summary = risk.monte_carlo.summary;
          const samples = risk.monte_carlo.samples;
          const baselineTotal = Number(baseline.costs.costs.total_with_tax);
          const quantile = (values, percentile) => {
            const sorted = [...values].sort((a,b) => a-b);
            const position = (sorted.length-1) * percentile / 100;
            const lower = Math.floor(position);
            const upper = Math.ceil(position);
            return sorted[lower] + (sorted[upper]-sorted[lower]) * (position-lower);
          };
          return Number(summary.baseline_total_with_tax) === baselineTotal
            && samples.length === Number(summary.iterations_valid)
            && samples.every(sample => {
              const expectedSaving = (baselineTotal-Number(sample.total_with_tax))/baselineTotal*100;
              return Math.abs(Number(sample.saving_pct)-expectedSaving)<0.001;
            })
            && summary.percentile_curve.every(point => {
              const expected = quantile(samples.map(sample => Number(sample.saving_pct)), point.percentile);
              return Math.abs(Number(point.value)-expected)<0.001;
            })
            && summary.total_percentile_curve.every(point => {
              const expected = quantile(samples.map(sample => Number(sample.total_with_tax)), point.percentile);
              return Math.abs(Number(point.value)-expected)<0.001;
            });
        }""")
        assert matches, 'Percentis monetários não reconciliam com baseline e saving da fixture'
        browser.close()


if __name__ == '__main__':
    test_chart_data_integrity()
    test_renderer_values_interactions_and_cleanup()
    test_selected_company_charts_and_geography()
    test_mobile_chart_touch_and_width()
    test_mock_monetary_percentiles_are_derived_from_fixture_costs()
    print('INTERACTIVE_CHARTS_OK')
