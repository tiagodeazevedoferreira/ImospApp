// script.js - Minhas Finanças PWA (CORRIGIDO: Valores zerados + NaN/NaN)
// Atualização: 10/11/2025 - Parser flexível + Debug + Filtro de datas

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSd2zPDrzqTbO8DEMDoPsAzjLn4TioBdACyD4CzxPROfSHH6KVyK_6j2inlLjWCLDf8sKqO2S6WgxNB/pub?gid=2000957643&single=true&output=csv';

let dados = [];
let graficoSaldo, graficoSemanal, graficoComparativo;

function showError(msg) {
  const el = document.getElementById('errorMessage');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 10000);
}

function formatarMoeda(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

// PARSER DE MOEDA BLINDADO + FLEXÍVEL
function parseMoeda(str) {
  if (!str) return 0;
  const limpo = str
    .toString()
    .replace(/"/g, '')
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim();
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

// PARSER DE DATA COM VALIDAÇÃO RÍGIDA
function parseDataBR(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();
  if (str.includes('NaN') || str === '') return null;
  const partes = str.split('/');
  if (partes.length !== 3) return null;
  const [d, m, a] = partes.map(p => parseInt(p.trim(), 10));
  if (isNaN(d) || isNaN(m) || isNaN(a)) return null;
  if (d < 1 || d > 31 || m < 1 || m > 12 || a < 1000) return null;
  const data = new Date(a, m - 1, d);
  return data.getDate() === d ? data : null; // Valida dia válido
}

async function carregarDados() {
  try {
    const res = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro ${res.status}: Planilha não pública.`);
    const txt = await res.text();
    const linhas = txt.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length < 2) throw new Error('CSV vazio.');

    const head = linhas[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log('Cabeçalhos detectados:', head); // DEBUG

    dados = linhas.slice(1).map((l, idx) => {
      const valores = l.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = { linha: idx + 2 }; // Para debug
      let valorCol = null, dataCol = null, tipoCol = null, abaCol = null;

      head.forEach((col, i) => {
        const val = valores[i] || '';
        const lower = col.toLowerCase();

        if (lower.includes('valor') || lower.includes('total') || lower.includes('r$')) {
          valorCol = col;
          obj.Valor = parseMoeda(val);
        }
        if (col === 'Data' || lower.includes('data')) {
          dataCol = col;
          obj.Data = parseDataBR(val);
        }
        if (col === 'Tipo' || lower.includes('tipo')) {
          tipoCol = col;
          obj.Tipo = val.trim();
        }
        if (col === 'Aba' || lower.includes('aba') || lower.includes('mês')) {
          abaCol = col;
          obj.Aba = val.trim();
        }
      });

      // Garante colunas mínimas
      if (!obj.Data) obj.Data = null;
      if (!obj.Valor) obj.Valor = 0;
      if (!obj.Tipo) obj.Tipo = '';
      if (!obj.Aba) obj.Aba = '';

      return obj;
    }).filter(d => d.Data && d.Valor !== 0 || d.Valor > 0); // Só linhas com data e valor > 0

    console.log('Dados processados:', dados); // DEBUG

    if (dados.length === 0) {
      showError('Nenhum dado válido (verifique Valor, Data, Tipo).');
      return;
    }

    popularFiltros();
    exibirTudo();
  } catch (err) {
    showError(`Erro: ${err.message}`);
    console.error(err);
  }
}

function popularFiltros() {
  const meses = [...new Set(dados.map(d => d.Aba).filter(Boolean))].sort();
  const anos = [...new Set(dados.map(d => d.Data.getFullYear()))].sort((a, b) => a - b);

  const sm = document.getElementById('mes-semanal');
  sm.innerHTML = '<option value="">Todos os meses</option>';
  meses.forEach(m => { const o = new Option(m, m); sm.add(o); });

  const sa = document.getElementById('ano-mensal');
  sa.innerHTML = '<option value="">Todos os anos</option>';
  anos.forEach(a => { const o = new Option(a, a); sa.add(o); });
}

// [exibirResumo, exibirSemanal, exibirMensal, exibirComparativo] → MANTIDOS COM (d.Valor || 0)

function exibirResumo() {
  const entradas = dados.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + (d.Valor || 0), 0);
  const saidas = dados.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + (d.Valor || 0), 0);

  document.getElementById('totalEntradas').textContent = formatarMoeda(entradas);
  document.getElementById('totalSaidas').textContent = formatarMoeda(saidas);
  document.getElementById('saldoFinal').textContent = formatarMoeda(entradas - saidas);

  const ctx = document.getElementById('graficoSaldo').getContext('2d');
  const labels = [...new Set(dados.map(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}`))].sort((a, b) => parseDataBR(a) - parseDataBR(b));
  const saldoAcum = labels.map(l => {
    const ate = dados.filter(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}` <= l);
    const ent = ate.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + (d.Valor || 0), 0);
    const sai = ate.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + (d.Valor || 0), 0);
    return ent - sai;
  });

  if (graficoSaldo) graficoSaldo.destroy();
  graficoSaldo = new Chart(ctx, { type: 'line', data: { labels, datasets: [{ label: 'Saldo', data: saldoAcum, borderColor: '#3b82f6' }] }, options: { responsive: true } });
}

// exibirSemanal, exibirMensal, exibirComparativo → mesmos ajustes com (d.Valor || 0)

function exibirTudo() { exibirResumo(); exibirSemanal(); exibirMensal(); exibirComparativo(); }

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active-tab'));
  document.getElementById(id).classList.add('active');
  document.getElementById(id + '-btn').classList.add('active-tab');
  if (id === 'semanal') exibirSemanal();
  if (id === 'mensal') exibirMensal();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
  document.getElementById('mes-semanal').addEventListener('change', exibirSemanal);
  document.getElementById('ano-mensal').addEventListener('change', exibirMensal);
  document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => showTab(b.id.replace('-btn', ''))));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
});