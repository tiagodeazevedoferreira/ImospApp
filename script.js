// script.js - Minhas Finanças PWA (CSV_URL CORRIGIDO)
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSd2zPDrzqTbO8DEMDoPsAzjLn4TioBdACyD4CzxPROfSHH6KVyK_6j2inlLjWCLDf8sKqO2S6WgxNB/pub?gid=2000957643&single=true&output=csv';

let dados = [];
let graficoSaldo, graficoSemanal, graficoComparativo;

function showError(msg) {
  const el = document.getElementById('errorMessage');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 8000);
}

function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(v); }
function parseMoeda(str) { return parseFloat((str||'').replace(/\./g,'').replace(',','.').replace(/R\$/gi,'').trim())||0; }
function parseDataBR(str) { const [d,m,a] = str.split('/'); return new Date(`${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`); }

async function carregarDados() {
  try {
    const res = await fetch(CSV_URL + `&t=${Date.now()}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Erro ${res.status}: Link inválido ou planilha não pública.`);
    const txt = await res.text();
    const linhas = txt.split('\n').map(l=>l.trim()).filter(Boolean);
    const head = linhas[0].split(',');

    dados = linhas.slice(1).map(l => {
      const v = l.split(',');
      const o = {}; head.forEach((c,i)=>{
        o[c.trim()] = c.includes('Valor') ? parseMoeda(v[i]) : (c==='Data' ? parseDataBR(v[i]) : (v[i]||''));
      });
      return o;
    }).filter(d=>d.Data);

    popularFiltros();
    exibirTudo();
  } catch (err) {
    showError(`Falha ao carregar dados: ${err.message}`);
    console.error(err);
  }
}

function popularFiltros() {
  const meses = [...new Set(dados.map(d=>d.Aba))].sort();
  const anos = [...new Set(dados.map(d=>d.Data.getFullYear()))].sort();
  const sm = document.getElementById('mes-semanal'); meses.forEach(m=>{const o=document.createElement('option');o.value=o.text=m;sm.appendChild(o)});
  const sa = document.getElementById('ano-mensal'); anos.forEach(a=>{const o=document.createElement('option');o.value=o.text=a;sa.appendChild(o)});
}

function exibirResumo() {
  const entradas = dados.filter(d=>d.Tipo==='Entrada').reduce((s,d)=>s+d.Valor,0);
  const saidas = dados.filter(d=>d.Tipo==='Saída').reduce((s,d)=>s+d.Valor,0);
  document.getElementById('totalEntradas').textContent = formatarMoeda(entradas);
  document.getElementById('totalSaidas').textContent = formatarMoeda(saidas);
  document.getElementById('saldoFinal').textContent = formatarMoeda(entradas-saidas);

  const ctx = document.getElementById('graficoSaldo').getContext('2d');
  const labels = [...new Set(dados.map(d=>`${d.Data.getDate()}/${d.Data.getMonth()+1}`))].sort((a,b)=>parseDataBR(a)-parseDataBR(b));
  const saldoAcum = labels.map(l => {
    const ate = dados.filter(d=>`${d.Data.getDate()}/${d.Data.getMonth()+1}` <= l);
    return ate.filter(d=>d.Tipo==='Entrada').reduce((s,d)=>s+d.Valor,0) - ate.filter(d=>d.Tipo==='Saída').reduce((s,d)=>s+d.Valor,0);
  });
  if (graficoSaldo) graficoSaldo.destroy();
  graficoSaldo = new Chart(ctx, {type:'line', data:{labels, datasets:[{label:'Saldo Acumulado', data:saldoAcum, borderColor:'#3b82f6', fill:false}]}, options:{responsive:true}});
}

function exibirSemanal() {
  const mesFiltro = document.getElementById('mes-semanal').value;
  const dadosFiltrados = mesFiltro ? dados.filter(d=>d.Aba===mesFiltro) : dados;
  const semanas = {};
  dadosFiltrados.forEach(d => {
    const semana = `Semana ${Math.ceil(d.Data.getDate()/7)}`;
    semanas[semana] = semanas[semana] || {entrada:0, saida:0};
    semanas[semana][d.Tipo.toLowerCase() === 'entrada' ? 'entrada' : 'saida'] += d.Valor;
  });
  const labels = Object.keys(semanas);
  const entradas = labels.map(l => semanas[l].entrada);
  const saidas = labels.map(l => semanas[l].saida);

  const ctx = document.getElementById('graficoSemanal').getContext('2d');
  if (graficoSemanal) graficoSemanal.destroy();
  graficoSemanal = new Chart(ctx, {type:'bar', data:{labels, datasets:[
    {label:'Entradas', data:entradas, backgroundColor:'#10b981'},
    {label:'Saídas', data:saidas, backgroundColor:'#ef4444'}
  ]}, options:{responsive:true}});
}

function exibirMensal() {
  const anoFiltro = document.getElementById('ano-mensal').value;
  const dadosFiltrados = anoFiltro ? dados.filter(d=>d.Data.getFullYear()==anoFiltro) : dados;
  const meses = {};
  dadosFiltrados.forEach(d => {
    const mes = `${d.Data.getMonth()+1}/${d.Data.getFullYear()}`;
    meses[mes] = meses[mes] || {entrada:0, saida:0};
    meses[mes][d.Tipo.toLowerCase() === 'entrada' ? 'entrada' : 'saida'] += d.Valor;
  });
  const head = document.getElementById('tabelaMensalHead');
  const body = document.getElementById('tabelaMensalBody');
  head.innerHTML = `<tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr>`;
  body.innerHTML = '';
  Object.keys(meses).sort().forEach(m => {
    const e = meses[m].entrada, s = meses[m].saida;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m}</td><td>${formatarMoeda(e)}</td><td>${formatarMoeda(s)}</td><td>${formatarMoeda(e-s)}</td>`;
    body.appendChild(tr);
  });
}

function exibirComparativo() {
  const anos = [...new Set(dados.map(d=>d.Data.getFullYear()))].sort();
  const porAno = {};
  anos.forEach(a => { porAno[a] = {entrada:0, saida:0}; });
  dados.forEach(d => {
    const ano = d.Data.getFullYear();
    porAno[ano][d.Tipo.toLowerCase() === 'entrada' ? 'entrada' : 'saida'] += d.Valor;
  });
  const labels = anos;
  const entradas = labels.map(a => porAno[a].entrada);
  const saidas = labels.map(a => porAno[a].saida);

  const ctx = document.getElementById('graficoComparativo').getContext('2d');
  if (graficoComparativo) graficoComparativo.destroy();
  graficoComparativo = new Chart(ctx, {type:'bar', data:{labels, datasets:[
    {label:'Entradas', data:entradas, backgroundColor:'#10b981'},
    {label:'Saídas', data:saidas, backgroundColor:'#ef4444'}
  ]}, options:{responsive:true}});
}

function exibirTudo() { exibirResumo(); exibirSemanal(); exibirMensal(); exibirComparativo(); }

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b=>b.classList.remove('active-tab'));
  document.getElementById(id).classList.add('active');
  document.getElementById(id+'-btn').classList.add('active-tab');
  if(id==='semanal') exibirSemanal();
  if(id==='mensal') exibirMensal();
}

document.addEventListener('DOMContentLoaded', () => {
  carregarDados();
  document.getElementById('mes-semanal').addEventListener('change', exibirSemanal);
  document.getElementById('ano-mensal').addEventListener('change', exibirMensal);
  document.querySelectorAll('.tab-button').forEach(b => b.addEventListener('click', () => showTab(b.id.replace('-btn',''))));
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});