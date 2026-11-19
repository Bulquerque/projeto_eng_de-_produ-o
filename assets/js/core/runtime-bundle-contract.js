/**
 * Contrato único dos dados auxiliares necessários para preparar o bundle de
 * runtime. O navegador e as auditorias devem consumir este mapa, evitando que
 * cada executor tenha uma lista própria de arquivos core.
 */
export const CORE_DATA_PATHS = Object.freeze({
  empresa1: Object.freeze({
    distance_matrix: 'data/empresa1/core/distance_matrix.json',
  }),
  empresa2: Object.freeze({
    lat_long: 'data/empresa2/core/lat_long.json',
    rotas_mapa: 'data/empresa2/core/rotas_mapa.json',
    tax_data: 'data/empresa2/core/dados_tributario.json',
    tabelas_cif_dist: 'data/empresa2/core/tabelas_cif_dist.json',
    aux_custo_transferencia: 'data/empresa2/core/aux_custo_transferencia.json',
    aux_custo_armazenagem: 'data/empresa2/core/aux_custo_armazenagem.json',
  }),
});

export const SHARED_TAX_REFERENCE_PATH =
  'data/complements/shared/tax_reference/icms_interstate_matrix.json';

export function getCoreDataPaths(companyId) {
  return CORE_DATA_PATHS[companyId] || {};
}
