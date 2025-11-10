// script.js - Minhas Finanças PWA
console.log('Script.js carregado');

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSd2zPDrzqTbO8DEMDoPsAzjLn4TioBdACyD4CzxPROfSHH6KVyK_6j2inlLjWCLDf8sKqO2S6WgxNB/pub?gid=2000957643&single=true&output=csv';
const CACHE_NAME = 'financas-cache-v1';
let dados = [];

// Gráficos
let graficoSaldo = null;
let graficoSemanal = null;
let graficoComparativo = null;

// Utilidades
function showError(msg) {
  const el = document.getElementById('errorMessage');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function parseMoeda(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace('R$', '').trim()) || 0;
}

function parseDataBR(str) {
  const [dia, mes, ano] = str.split('/');
  return new Date(`${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`);
}

// Carregar dados do CSV
async function carregarDados() {
  try {
    const response = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Erro ao carregar dados');
    const texto = await response.text();
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l);
    const cabecalho = linhas[0].split(',');

    dados = linhas.slice(1).map(linha => {
      const valores = linha.split(',');
      const obj = {};
      cabecalho.forEach((col, i) => {
        let valor = valores[i] || '';
        if (col.includes('Valor')) valor = parseMoeda(valor);
        else if (col === 'Data') valor = valor ? parseDataBR(valor) : null;
        obj[col.trim()] = valor;
      });
      return obj;
    }).filter(d => d.Data);

    console.log('Dados carregados:', dados.length, 'lançamentos');
    popularFiltros();
    exibirTudo();
  } catch (err) {
    console.error(err);
    showError('Erro ao carregar dados. Verifique o link do CSV.');
  }
}

// Popular filtros
function popularFiltros() {
  const meses = [...new Set(dados.map(d => d.Aba))].sort();
  const anos = [...new Set(dados.map(d => d.Data.getFullYear()))].sort();

  const selectMes = document.getElementById('mes-semanal');
  meses.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    selectMes.appendChild(opt);
  });

  const selectAno = document.getElementById('ano-mensal');
  anos.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    selectAno.appendChild(opt);
  });
}

// Exibir tudo
function exibirTudo() {
  exibirResumo();
  exibirSemanal();
  exibirMensal();
  exibirComparativo();
}

// ========== ABA RESUMO ==========
function exibirResumo() {
  const entradas = dados.filter(d => d.Tipo === 'Entrada').reduce((s, d) => s + d['Valor em R$'], 0);
  const saidas = dados.filter(d => d.Tipo === 'Saída').reduce((s, d) => s + d['Valor em R$'], 0);
  const saldo = entradas - saidas;

  document.getElementById('totalEntradas').textContent = formatarMoeda(entradas);
  document.getElementById('totalSaidas').textContent = formatarMoeda(saidas);
  document.getElementById('saldoFinal').textContent = formatarMoeda(saldo);

  // Gráfico de saldo acumulado
  const porMes = {};
  dados.forEach(d => {
    const mesAno = d.Aba;
    if (!porMes[mesAno]) porMes[mesAno] = { entrada: 0, saida: 0 };
    if (d.Tipo === 'Entrada') porMes[mesAno].entrada += d['Valor em R$'];
    else porMes[mesAno].saida += d['Valor em R$'];
  });

  const labels = Object.keys(porMes).sort();
  const saldos = [];
  let acumulado = 0;
  labels.forEach(m => {
    acumulado += porMes[m].entrada - porMes[m].saida;
    saldos.push(acumulado);
  });

  if (graficoSaldo) graficoSaldo.destroy();
  graficoSaldo = new Chart(document.getElementById('graficoSaldo'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo Acumulado',
        data: saldos,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: false } }
    }
  });
}

// ========== ABA POR SEMANA ==========
function exibirSemanal() {
  const mesSelecionado = document.getElementById('mes-semanal').value;
  const dadosFiltrados = mesSelecionado ? dados.filter(d => d.Aba === mesSelecionado) : : dados;

  const porSemana = {};
  dadosFiltrados.forEach(d => {
    const chave = `${d.Aba} - ${d.Semana}`;
    if (!porSemana[chave]) porSemana[chave] = { entrada: 0, saida: 0 };
    if (d.Tipo === 'Entrada') porSemana[chave].entrada += d['Valor em R$'];
    else porSemana[chave].saida += d['Valor em R$'];
  });

  const labels = Object.keys(porSemana).sort();
  const entradas = labels.map(l => porSemana[l].entrada);
  const saidas = labels.map(l => -porSemana[l].saida);

  if (graficoSemanal) graficoSemanal.destroy();
  graficoSemanal = new Chart(document.getElementById('graficoSemanal'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Entradas',
          data: entradas,
          backgroundColor: 'rgba(34, 197, 94, 0.8)'
        },
        {
          label: 'Saídas',
          data: saidas,
          backgroundColor: 'rgba(239, 68, 68, 0.8)'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => formatarMoeda(Math.abs(v)) } }
      }
    }
  });
}

// ========== ABA POR MÊS ==========
function exibirMensal() {
  const anoSelecionado = document.getElementById('ano-mensal').value;
  const dadosFiltrados = anoSelecionado ? dados.filter(d => d.Data.getFullYear() == anoSelecionado) : dados;

  const porMes = {};
  dadosFiltrados.forEach(d => {
    const mesAno = d.Aba;
    if (!porMes[mesAno]) porMes[mesAno] = { entrada: 0, saida: 0, saldo: 0 };
    if (d.Tipo === 'Entrada') porMes[mesAno].entrada += d['Valor em R$'];
    else porMes[mesAno].saida += d['Valor em R$'];
  });

  Object.keys(porMes).forEach(m => {
    porMes[m].saldo = porMes[m].entrada - porMes[m].saida;
  });

  const meses = Object.keys(porMes).sort();
  const head = document.getElementById('tabelaMensalHead');
  const body = document.getElementById('tabelaMensalBody');
  head.innerHTML = `<tr class="bg-blue-600 text-white">
    <th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th>
  </tr>`;

  body.innerHTML = '';
  meses.forEach(m => {
    const row = document.createElement('tr');
    row.className = porMes[m].saldo >= 0 ? 'bg-green-50' : 'bg-red-50';
    row.innerHTML = `
      <td class="font-semibold">${m}</td>
      <td class="text-green-600">${formatarMoeda(porMes[m].entrada)}</td>
      <td class="text-red-600">${formatarMoeda(porMes[m].saida)}</td>
      <td class="font-bold ${porMes[m].saldo >= 0 ? 'text-green-700' : 'text-red-700'}">
        ${formatarMoeda(porMes[m].saldo)}
      </td>
    `;
    body.appendChild(row);
  });
}

// ========== ABA COMPARATIVO ==========
function exibirComparativo() {
  const porMes = {};
  dados.forEach(d => {
    const mesAno = d.Aba;
    if (!porMes[mesAno]) porMes[mesAno] = { entrada: 0, saida: 0 };
    if (d.Tipo === 'Entrada') porMes[mesAno].entrada += d['Valor em R$'];
    else porMes[mesAno].saida += d['Valor em R$'];
  });

  const labels = Object.keys(porMes).sort();
  const entradas = labels.map(l => porMes[l].entrada);
  const saidas = labels.map(l => porMes[l].saida);

  if (graficoComparativo) graficoComparativo.destroy();
  graficoComparativo = new Chart(document.getElementById('graficoComparativo'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Entradas', data: entradas, backgroundColor: 'rgba(34, 197, 94, 0.7)' },
        { label: 'Saídas', data: saidas, backgroundColor: 'rgba(239, 68, 68, 0.7)' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

// Abas
function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active-tab'));
  document.getElementById(id).classList.add('active');
  document.getElementById(id + '-btn').classList.add('active-tab');

  if (id === 'semanal') exibirSemanal();
  if (id === 'mensal') exibirMensal();
}

// Eventos
document.addEventListener('DOMContentLoaded', () => {
  carregarDados();

  document.getElementById('mes-semanal').addEventListener('change', exibirSemanal);
  document.getElementById('ano-mensal').addEventListener('change', exibirMensal);

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.id.replace('-btn', '')));
  });

  // PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }

  showTab('resumo');
});