// script.js - Minhas Finanças PWA
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

// Carregar dados
async function carregarDados() {
  try {
    const response = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Erro ao carregar CSV');
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

    popularFiltros();
    exibirTudo();
  } catch (err) {
    showError('Erro ao carregar dados. Verifique o CSV.');
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

// [Funções exibirResumo, exibirSemanal, exibirMensal, exibirComparativo – mantidas como antes]

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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
  showTab('resumo');
});