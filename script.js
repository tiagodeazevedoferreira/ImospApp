// script.js - Minhas Finanças PWA (CORRIGIDO FINAL: Valores + Erros)
// Atualização: 10/11/2025 - Parser flexível + Funções completas + Debug

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSd2zPDrzqTbO8DEMDoPsAzjLn4TioBdACyD4CzxPROfSHH6KVyK_6j2inlLjWCLDf8sKqO2S6WgxNB/pub?gid=2000957643&single=true&output=csv';

let dados = [];
let graficoSaldo, graficoSemanal, graficoComparativo;

function showError(msg) {
  const el = document.getElementById('errorMessage');
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 10000);
  }
}

function formatarMo earmeda(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

// PARSER DE MOEDA FLEXÍVEL
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

// PARSER DE DATA RÍGIDO
function parseDataBR(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();
  if (str.includes('NaN') || str === '') return null;
  const partes = str.split('/');
  if (partes.length !== 3) return null;
  const [d, m, a] = partes.map(p => parseInt(p.trim(), 10));
  if (isNaN(d) || isNaN(m) || isNaN(a) || d < 1 || d > 31 || m < 1 || m > 12 || a < 1000) return null;
  const data = new Date(a, m - 1, d);
  return data.getDate() === d ? data : null;
}

async function carregarDados() {
  try {
    const res = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const txt = await res.text();
    const linhas = txt.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length < 2) throw new Error('CSV vazio.');

    const head = linhas[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    console.log('Cabeçalhos:', head);

    dados = linhas.slice(1).map((l, idx) => {
      const valores = l.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = { linha: idx + 2 };

      head.forEach((col, i) => {
        const val = valores[i] || '';
        const lower = col.toLowerCase();

        if (lower.includes('valor') || lower.includes('total') || lower.includes('r$')) {
          obj.Valor = parseMoeda(val);
        }
        if (col === 'Data' || lower.includes('data')) {
          obj.Data = parseDataBR(val);
        }
        if (col === 'Tipo' || lower.includes('tipo')) {
          obj.Tipo = val.trim();
        }
        if (col === 'Aba' || lower.includes('aba') || lower.includes('mês')) {
          obj.Aba = val.trim();
        }
      });

      // Valores padrão
      obj.Valor = obj.Valor || 0;
      obj.Data = obj.Data || null;
      obj.Tipo = obj.Tipo || '';
      obj.Aba = obj.Aba || '';

      return obj;
    }).filter(d => d.Data !== null); // Remove datas inválidas

    console.log('Dados processados:', dados);

    if (dados.length === 0) {
      showError('Nenhum dado válido encontrado.');
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
  const anos = [...new Set(dados.filter(d => d.Data).map(d => d.Data.getFullYear()))].sort((a, b) => a - b);

  const sm = document.getElementById('mes-semanal');
  if (sm) {
    sm.innerHTML = '<option value="">Todos os meses</option>';
    meses.forEach(m => sm.add(new Option(m, m)));
  }

  const sa = document.getElementById('ano-mensal');
  if (sa) {
    sa.innerHTML = '<option value="">Todos os anos</option>';
    anos.forEach(a => sa.add(new Option(a, a)));
  }
}

function exibirResumo() {
  const entradas = dados.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + d.Valor, 0);
  const saidas = dados.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + d.Valor, 0);

  const te = document.getElementById('totalEntradas');
  const ts = document.getElementById('totalSaidas');
  const sf = document.getElementById('saldoFinal');
  if (te) te.textContent = formatarMoeda(entradas);
  if (ts) ts.textContent = formatarMoeda(saidas);
  if (sf) sf.textContent = formatarMoeda(entradas - saidas);

  const ctx = document.getElementById('graficoSaldo')?.getContext('2d');
  if (!ctx) return;

  const labels = [...new Set(dados.map(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}`))].sort((a, b) => parseDataBR(a) - parseDataBR(b));
  const saldoAcum = labels.map(l => {
    const ate = dados.filter(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}` <= l);
    const ent = ate.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + d.Valor, 0);
    const sai = ate.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + d.Valor, 0);
    return ent - sai;
  });

  if (graficoSaldo) graficoSaldo.destroy();
  graficoSaldo = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Saldo Acumulado', data: saldoAcum, borderColor: '#3b82f6', fill: false }] },
    options: { responsive: true }
  });
}

function exibirSemanal() {
  const mesFiltro = document.getElementById('mes-semanal')?.value;
  const dadosFiltrados = mesFiltro ? dados.filter(d => d.Aba === mesFiltro) : dados;

  const semanas = {};
  dadosFiltrados.forEach(d => {
    const semana = `Semana ${Math.ceil(d.Data.getDate() / 7)}`;
    semanas[semana] = semanas[semana] || { entrada: 0, saida: 0 };
    semanas[semana][d.Tipo === 'Entrada' ? 'entrada' : 'saida'] += d.Valor;
  });

  const labels = Object.keys(semanas).sort();
  const entradas = labels.map(l => semanas[l].entrada);
  const saidas = labels.map(l => semanas[l].saida);

  const ctx = document.getElementById('graficoSemanal')?.getContext('2d');
  if (!ctx) return;

  if (graficoSemanal) graficoSemanal.destroy();
  graficoSemanal = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Entradas', data: entradas, backgroundColor: '#10b981' },
      { label: 'Saídas', data: saidas, backgroundColor: '#ef4444' }
    ]},
    options: { responsive: true }
  });
}

function exibirMensal() {
  const anoFiltro = document.getElementById('ano-mensal')?.value;
  const dadosFiltrados = anoFiltro ? dados.filter(d => d.Data.getFullYear() == anoFiltro) : dados;

  const meses = {};
  dadosFiltrados.forEach(d => {
    const mes = `${d.Data.getMonth() + 1}/${d.Data.getFullYear()}`;
    meses[mes] = meses[mes] || { entrada: 0, saida: 0 };
    meses[mes][d.Tipo === 'Entrada' ? 'entrada' : 'saida'] += d.Valor;
  });

  const head = document.getElementById('tabelaMensalHead');
  const body = document.getElementById('tabelaMensalBody');
  if (!head || !body) return;

  head.innerHTML = `<tr class="bg-blue-800 text-white"><th class="p-2">Mês</th><th class="p-2">Entradas</th><th class="p-2">Saídas</th><th class="p-2">Saldo</th></tr>`;
  body.innerHTML = '';
  Object.keys(meses).sort().forEach(m => {
    const e = meses[m].entrada, s = meses[m].saida;
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `<td class="p-2">${m}</td><td class="p-2">${formatarMoeda(e)}</td><td class="p-2">${formatarMoeda(s)}</td><td class="p-2 font-bold">${formatarMoeda(e - s)}</td>`;
    body.appendChild(tr);
  });
}

function exibirComparativo() {
  const anos = [...new Set(dados.filter(d => d.Data).map(d => d.Data.getFullYear()))].sort((a, b) => a - b);
  const porAno = {};
  anos.forEach(a => porAno[a] = { entrada: 0, saida: 0 });
  dados.forEach(d => {
    const ano = d.Data.getFullYear();
    porAno[ano][d.Tipo === 'Entrada' ? 'entrada' : 'saida'] += d.Valor;
  });

  const labels = anos;
  const entradas = labels.map(a => porAno[a].entrada);
  const saidas = labels.map(a => porAno[a].saida);

  const ctx = document.getElementById('graficoComparativo')?.getContext('2d');
  if (!ctx) return;

  if (graficoComparativo) graficoComparativo.destroy();
  graficoComparativo = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Entradas', data: entradas, backgroundColor: '#10b981' },
      { label: 'Saídas', data: saidas, backgroundColor: '#ef4444' }
    ]},
    options: { responsive: true }
  });
}

function exibirTudo() {
  exibirResumo();
  exibirSemanal();
  exibirMensal();
  exibirComparativo();
}

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active-tab'));
  const tab = document.getElementById(id);
  const btn = document.getElementById(id + '-btn');
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active-tab');
  if (id === 'semanal') exibirSemanal();
  if (id === 'mensal') exibirMensal();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
  const mesSel = document.getElementById('mes-semanal');
  const anoSel = document.getElementById('ano-mensal');
  if (mesSel) mesSel.addEventListener('change', exibirSemanal);
  if (anoSel) anoSel.addEventListener('change', exibirMensal);
  document.querySelectorAll('.tab-button').forEach(b => {
    b.addEventListener('click', () => showTab(b.id.replace('-btn', '')));
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});