// script.js - Minhas Finanças PWA (FILTROS GLOBAIS + URL CORRETA)
// Atualização: 11/11/2025 11:50 - URL corrigida

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

function formatarMoeda(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

function parseMoeda(str) {
  if (!str) return 0;
  const limpo = str.toString()
    .replace(/"/g, '')
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .trim();
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

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

function getMesAno(data) {
  if (!data) return '';
  return `${data.getMonth() + 1}/${data.getFullYear()}`;
}

function nomeMesAbrev(mes) {
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return nomes[mes];
}

function getSemanaDoMes(data) {
  if (!data) return 0;
  return Math.ceil(data.getDate() / 7);
}

async function carregarDados() {
  try {
    const res = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro ${res.status}: Verifique a URL do CSV.`);
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
        if (lower.includes('categoria') && !lower.includes('sub')) {
          obj.Categoria = val.trim();
        }
        if (lower.includes('sub-categoria2') || lower.includes('conversão')) {
          obj.SubCategoria = val.trim();
        }
      });

      obj.Valor = obj.Valor ?? 0;
      obj.Data = obj.Data ?? null;
      obj.Tipo = obj.Tipo ?? '';
      obj.Categoria = obj.Categoria ?? '';
      obj.SubCategoria = obj.SubCategoria ?? '';

      return obj;
    }).filter(d => d.Data !== null);

    if (dados.length === 0) {
      showError('Nenhum dado válido (verifique Data, Valor, Tipo).');
      return;
    }

    popularFiltros();
    aplicarFiltros();
  } catch (err) {
    showError(`Erro ao carregar dados: ${err.message}`);
    console.error(err);
  }
}

// === FILTROS GLOBAIS ===
function popularFiltros() {
  const anos = [...new Set(dados.map(d => d.Data.getFullYear()))].sort((a, b) => a - b);
  ['ano-resumo', 'ano-semanal', 'ano-mensal', 'ano-comparativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todos os anos</option>';
      anos.forEach(a => el.add(new Option(a, a)));
    }
  });

  const mesesUnicos = [...new Set(dados.map(d => d.Data.getMonth()))].sort((a, b) => a - b);
  ['mes-resumo', 'mes-semanal', 'mes-mensal', 'mes-comparativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todos os meses</option>';
      mesesUnicos.forEach(m => el.add(new Option(nomeMesAbrev(m), m)));
    }
  });

  const semanas = [1, 2, 3, 4, 5];
  ['semana-resumo', 'semana-semanal', 'semana-mensal', 'semana-comparativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todas as semanas</option>';
      semanas.forEach(s => el.add(new Option(`Semana ${s}`, s)));
    }
  });

  const tipos = [...new Set(dados.map(d => d.Tipo))].filter(Boolean);
  ['tipo-resumo', 'tipo-semanal', 'tipo-mensal', 'tipo-comparativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todas as movimentações</option>';
      tipos.forEach(t => el.add(new Option(t, t)));
    }
  });

  const categorias = [...new Set(dados.map(d => d.Categoria))].filter(Boolean).sort();
  ['cat-resumo', 'cat-semanal', 'cat-mensal', 'cat-comparativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todas as categorias</option>';
      categorias.forEach(c => el.add(new Option(c, c)));
    }
  });

  const subs = [...new Set(dados.map(d => d.SubCategoria))].filter(Boolean).sort();
  ['subcat-resumo', 'subcat-semanal', 'subcat-mensal', 'subcat-comparativo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '<option value="">Todas as sub-categorias</option>';
      subs.forEach(s => el.add(new Option(s, s)));
    }
  });
}

function obterDadosFiltrados() {
  const ano = document.getElementById('ano-resumo')?.value || 
              document.getElementById('ano-semanal')?.value || 
              document.getElementById('ano-mensal')?.value || 
              document.getElementById('ano-comparativo')?.value || '';

  const mes = document.getElementById('mes-resumo')?.value || 
              document.getElementById('mes-semanal')?.value || 
              document.getElementById('mes-mensal')?.value || 
              document.getElementById('mes-comparativo')?.value || '';

  const semana = document.getElementById('semana-resumo')?.value || 
                 document.getElementById('semana-semanal')?.value || 
                 document.getElementById('semana-mensal')?.value || 
                 document.getElementById('semana-comparativo')?.value || '';

  const tipo = document.getElementById('tipo-resumo')?.value || 
               document.getElementById('tipo-semanal')?.value || 
               document.getElementById('tipo-mensal')?.value || 
               document.getElementById('tipo-comparativo')?.value || '';

  const cat = document.getElementById('cat-resumo')?.value || 
              document.getElementById('cat-semanal')?.value || 
              document.getElementById('cat-mensal')?.value || 
              document.getElementById('cat-comparativo')?.value || '';

  const subcat = document.getElementById('subcat-resumo')?.value || 
                 document.getElementById('subcat-semanal')?.value || 
                 document.getElementById('subcat-mensal')?.value || 
                 document.getElementById('subcat-comparativo')?.value || '';

  return dados.filter(d => {
    if (ano && d.Data.getFullYear() != ano) return false;
    if (mes !== '' && d.Data.getMonth() != mes) return false;
    if (semana && getSemanaDoMes(d.Data) != semana) return false;
    if (tipo && d.Tipo !== tipo) return false;
    if (cat && d.Categoria !== cat) return false;
    if (subcat && d.SubCategoria !== subcat) return false;
    return true;
  });
}

function aplicarFiltros() {
  exibirResumo();
  exibirSemanal();
  exibirMensal();
  exibirComparativo();
}

// === FUNÇÕES DE EXIBIÇÃO ===
function exibirResumo() {
  const filtrados = obterDadosFiltrados();
  const entradas = filtrados.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + d.Valor, 0);
  const saidas = filtrados.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + d.Valor, 0);

  const te = document.getElementById('totalEntradas');
  const ts = document.getElementById('totalSaidas');
  const sf = document.getElementById('saldoFinal');
  if (te) te.textContent = formatarMoeda(entradas);
  if (ts) ts.textContent = formatarMoeda(saidas);
  if (sf) sf.textContent = formatarMoeda(entradas - saidas);

  const ctx = document.getElementById('graficoSaldo')?.getContext('2d');
  if (!ctx || filtrados.length === 0) return;

  const labels = [...new Set(filtrados.map(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}`))].sort((a, b) => {
    const [da, ma] = a.split('/').map(Number);
    const [db, mb] = b.split('/').map(Number);
    return new Date(2025, ma - 1, da) - new Date(2025, mb - 1, db);
  });

  const saldoAcum = labels.map(l => {
    const [dia, mes] = l.split('/').map(Number);
    const ate = filtrados.filter(d => d.Data.getMonth() === mes - 1 && d.Data.getDate() <= dia);
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
  const filtrados = obterDadosFiltrados();
  const semanas = {};
  filtrados.forEach(d => {
    const semanaNum = getSemanaDoMes(d.Data);
    const semana = `Semana ${semanaNum}`;
    semanas[semana] = semanas[semana] || { entrada: 0, saida: 0 };
    semanas[semana][d.Tipo === 'Entrada' ? 'entrada' : 'saida'] += d.Valor;
  });

  const labels = Object.keys(semanas).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
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
  const filtrados = obterDadosFiltrados();
  const meses = {};
  filtrados.forEach(d => {
    const ma = getMesAno(d.Data);
    meses[ma] = meses[ma] || { entrada: 0, saida: 0 };
    meses[ma][d.Tipo === 'Entrada' ? 'entrada' : 'saida'] += d.Valor;
  });

  const head = document.getElementById('tabelaMensalHead');
  const body = document.getElementById('tabelaMensalBody');
  if (!head || !body) return;

  head.innerHTML = `<tr class="bg-blue-800 text-white"><th class="p-2">Mês</th><th class="p-2">Entradas</th><th class="p-2">Saídas</th><th class="p-2">Saldo</th></tr>`;
  body.innerHTML = '';

  Object.keys(meses).sort().forEach(ma => {
    const [m, a] = ma.split('/');
    const label = `${nomeMesAbrev(parseInt(m) - 1)}/${a.slice(-2)}`;
    const e = meses[ma].entrada, s = meses[ma].saida;
    const tr = document.createElement('tr');
    tr.className = 'border-b';
    tr.innerHTML = `<td class="p-2">${label}</td><td class="p-2">${formatarMoeda(e)}</td><td class="p-2">${formatarMoeda(s)}</td><td class="p-2 font-bold">${formatarMoeda(e - s)}</td>`;
    body.appendChild(tr);
  });
}

function exibirComparativo() {
  const filtrados = obterDadosFiltrados();
  const anos = [...new Set(filtrados.map(d => d.Data.getFullYear()))].sort((a, b) => a - b);
  const porAno = {};
  anos.forEach(a => porAno[a] = { entrada: 0, saida: 0 });
  filtrados.forEach(d => {
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
  aplicarFiltros();
}

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active-tab'));
  const tab = document.getElementById(id);
  const btn = document.getElementById(id + '-btn');
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active-tab');
  aplicarFiltros();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarDados();

  document.querySelectorAll('select[id^="ano-"], select[id^="mes-"], select[id^="semana-"], select[id^="tipo-"], select[id^="cat-"], select[id^="subcat-"]').forEach(el => {
    el.addEventListener('change', aplicarFiltros);
  });

  document.querySelectorAll('.tab-button').forEach(b => {
    b.addEventListener('click', () => showTab(b.id.replace('-btn', '')));
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});