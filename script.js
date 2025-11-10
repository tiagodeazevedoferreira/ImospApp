// script.js - Minhas Finanças PWA (Atualizado em 10/11/2025)
// CSV_URL correto + Parser de moeda blindado + Filtros robustos + Tratamento de erros

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSd2zPDrzqTbO8DEMDoPsAzjLn4TioBdACyD4CzxPROfSHH6KVyK_6j2inlLjWCLDf8sKqO2S6WgxNB/pub?gid=2000957643&single=true&output=csv';

let dados = [];
let graficoSaldo, graficoSemanal, graficoComparativo;

function showError(msg) {
  const el = document.getElementById('errorMessage');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 8000);
}

function formatarMoeda(v) { 
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); 
}

// PARSER DE MOEDA BLINDADO (suporta R$, aspas, espaços, pontos, vírgulas, vazio)
function parseMoeda(str) {
  if (!str) return 0;
  const limpo = str
    .toString()
    .replace(/"/g, '')           // Remove aspas
    .replace(/R\$/gi, '')        // Remove R$
    .replace(/\s/g, '')          // Remove espaços
    .replace(/\./g, '')          // Remove pontos (milhar)
    .replace(/,/g, '.')          // Vírgula → ponto
    .trim();
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function parseDataBR(str) {
  if (!str || str.includes('NaN') || str.trim() === '') return null;
  const partes = str.split('/');
  if (partes.length !== 3) return null;
  const [d, m, a] = partes.map(p => p.trim());
  if (!d || !m || !a) return null;
  return new Date(`${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
}

async function carregarDados() {
  try {
    const res = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro ${res.status}: Planilha não acessível.`);
    const txt = await res.text();
    const linhas = txt.split('\n').map(l => l.trim()).filter(Boolean);
    if (linhas.length < 2) throw new Error('CSV vazio ou mal formatado.');

    const head = linhas[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    dados = linhas.slice(1).map(l => {
      const valores = l.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      head.forEach((col, i) => {
        const val = valores[i] || '';
        if (col.toLowerCase().includes('valor')) {
          obj[col] = parseMoeda(val);
        } else if (col === 'Data') {
          obj[col] = parseDataBR(val);
        } else {
          obj[col] = val;
        }
      });
      return obj;
    }).filter(d => d.Data && !isNaN(d.Valor || 0));

    if (dados.length === 0) {
      showError('Nenhum dado válido encontrado. Verifique o CSV.');
      return;
    }

    popularFiltros();
    exibirTudo();
  } catch (err) {
    showError(`Falha ao carregar: ${err.message}`);
    console.error('Erro:', err);
  }
}

function popularFiltros() {
  const meses = [...new Set(dados.map(d => d.Aba).filter(Boolean))].sort();
  const anos = [...new Set(dados.map(d => d.Data?.getFullYear()).filter(Boolean))].sort((a, b) => a - b);

  const selectMes = document.getElementById('mes-semanal');
  selectMes.innerHTML = '<option value="">Todos os meses</option>';
  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = m;
    selectMes.appendChild(opt);
  });

  const selectAno = document.getElementById('ano-mensal');
  selectAno.innerHTML = '<option value="">Todos os anos</option>';
  anos.forEach(a => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = a;
    selectAno.appendChild(opt);
  });
}

function exibirResumo() {
  const entradas = dados.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + (d.Valor || 0), 0);
  const saidas = dados.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + (d.Valor || 0), 0);

  document.getElementById('totalEntradas').textContent = formatarMoeda(entradas);
  document.getElementById('totalSaidas').textContent = formatarMoeda(saidas);
  document.getElementById('saldoFinal').textContent = formatarMoeda(entradas - saidas);

  const ctx = document.getElementById('graficoSaldo').getContext('2d');
  const labels = [...new Set(dados.map(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}`))]
    .sort((a, b) => parseDataBR(a) - parseDataBR(b));

  const saldoAcum = labels.map(l => {
    const ate = dados.filter(d => `${d.Data.getDate()}/${d.Data.getMonth() + 1}` <= l);
    const ent = ate.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + (d.Valor || 0), 0);
    const sai = ate.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + (d.Valor || 0), 0);
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
  const mesFiltro = document.getElementById('mes-semanal').value;
  const dadosFiltrados = mesFiltro ? dados.filter(d => d.Aba === mesFiltro) : dados;
  const semanas = {};
  dadosFiltrados.forEach(d => {
    const semana = `Semana ${Math.ceil(d.Data.getDate() / 7)}`;
    semanas[semana] = semanas[semana] || { entrada: 0, saida: 0 };
    semanas[semana][d.Tipo.toLowerCase() === 'entrada' ? 'entrada' : 'saida'] += (d.Valor || 0);
  });

  const labels = Object.keys(semanas).sort();
  const entradas = labels.map(l => semanas[l].entrada);
  const saidas = labels.map(l => semanas[l].saida);

  const ctx = document.getElementById('graficoSemanal').getContext('2d');
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
  const anoFiltro = document.getElementById('ano-mensal').value;
  const dadosFiltrados = anoFiltro ? dados.filter(d => d.Data.getFullYear() == anoFiltro) : dados;
  const meses = {};
  dadosFiltrados.forEach(d => {
    const mes = `${d.Data.getMonth() + 1}/${d.Data.getFullYear()}`;
    meses[mes] = meses[mes] || { entrada: 0, saida: 0 };
    meses[mes][d.Tipo.toLowerCase() === 'entrada' ? 'entrada' : 'saida'] += (d.Valor || 0);
  });

  const head = document.getElementById('tabelaMensalHead');
  const body = document.getElementById('tabelaMensalBody');
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
  const anos = [...new Set(dados.map(d => d.Data.getFullYear()).filter(Boolean))].sort((a, b) => a - b);
  const porAno = {};
  anos.forEach(a => { porAno[a] = { entrada: 0, saida: 0 }; });
  dados.forEach(d => {
    const ano = d.Data.getFullYear();
    porAno[ano][d.Tipo.toLowerCase() === 'entrada' ? 'entrada' : 'saida'] += (d.Valor || 0);
  });

  const labels = anos;
  const entradas = labels.map(a => porAno[a].entrada);
  const saidas = labels.map(a => porAno[a].saida);

  const ctx = document.getElementById('graficoComparativo').getContext('2d');
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
  document.getElementById(id).classList.add('active');
  document.getElementById(id + '-btn').classList.add('active-tab');
  if (id === 'semanal') exibirSemanal();
  if (id === 'mensal') exibirMensal();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
  document.getElementById('mes-semanal').addEventListener('change', exibirSemanal);
  document.getElementById('ano-mensal').addEventListener('change', exibirMensal);
  document.querySelectorAll('.tab-button').forEach(b => {
    b.addEventListener('click', () => showTab(b.id.replace('-btn', '')));
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
});