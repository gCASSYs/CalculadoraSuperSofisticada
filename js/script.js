(() => {
  const qs = (s, root = document) => root.querySelector(s);
  const qsa = (s, root = document) => Array.from(root.querySelectorAll(s));

  // Elementos principais
  const valueEl = qs('#value');
  const exprEl = qs('#expr');
  const memChips = qs('#memoryChips');
  const historyEl = qs('#history');

  // Estado
  let buffer = '0';
  let expr = '';
  let memory = 0;
  let angleMode = 'DEG';
  let history = [];

  // Utilidades
  const format = (x) => {
    if (typeof x !== 'number' || !isFinite(x)) return 'Erro';
    // arredonda e remove zeros desnecessários
    const fixed = x.toFixed(12);
    const trimmed = fixed.replace(/\.?0+$/, '');
    // usa notação científica quando muito grande/pequeno
    if (Math.abs(x) >= 1e12 || (Math.abs(x) > 0 && Math.abs(x) < 1e-6)) {
      return x.toExponential(8);
    }
    return trimmed;
  };

  const formatUnits = (val, unit = '') => {
    const n = Number(val);
    if (!isFinite(n)) return '—';
    // 6 casas por padrão em unidades
    let out = n.toFixed(6).replace(/\.?0+$/, '');
    return unit ? `${out} ${unit}` : out;
  };

  function updateDisplay() {
    valueEl.textContent = buffer.replace('.', ',');
    exprEl.textContent = expr || '\u00A0';
    renderMemory();
  }

  function pushHistory(lhs, rhs) {
    history.unshift({ lhs, rhs });
    if (history.length > 50) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (!historyEl) return;
    historyEl.innerHTML = '';
    history.forEach((h) => {
      const row = document.createElement('div');
      row.className = 'item';
      row.innerHTML = `<div class="lhs">${h.lhs}</div><div class="rhs mono" draggable="true">${h.rhs}</div>`;
      row.querySelector('.rhs').addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', h.rhs);
      });
      row.addEventListener('click', () => {
        buffer = h.rhs;
        updateDisplay();
      });
      historyEl.appendChild(row);
    });
  }

  function renderMemory() {
    memChips.innerHTML = '';
    if (memory !== 0) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'M: ' + format(memory);
      memChips.appendChild(chip);
    }
  }

  function factorial(n) {
    n = Math.floor(n);
    if (n < 0 || n > 170) return NaN; // evita overflow
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // Avaliador seguro com nossos operadores/funções
  function safeEval(s) {
    if (typeof s !== 'string') return NaN;
    // símbolos → JS
    s = s.replace(/÷/g, '/').replace(/×/g, '*').replace(/,/, '.');

    // constantes e funções
    s = s.replace(/π/g, 'Math.PI');
    s = s.replace(/e(?![a-zA-Z0-9_])/g, 'Math.E');
    s = s.replace(/√\(/g, 'Math.sqrt(');
    s = s.replace(/ln\(/g, 'Math.log(');
    s = s.replace(/log\(/g, 'Math.log10(');

    // potência
    s = s.replace(/\^/g, '**');

    // trigonometria com DEG/RAD
    s = s.replace(/sin\(([^)]+)\)/g, (_, a) => `Math.sin((${a})*${angleMode === 'DEG' ? 'Math.PI/180' : '1'})`);
    s = s.replace(/cos\(([^)]+)\)/g, (_, a) => `Math.cos((${a})*${angleMode === 'DEG' ? 'Math.PI/180' : '1'})`);
    s = s.replace(/tan\(([^)]+)\)/g, (_, a) => `Math.tan((${a})*${angleMode === 'DEG' ? 'Math.PI/180' : '1'})`);

    // fatorial n!
    s = s.replace(/(\d+(?:\.\d+)?)!/g, (_, n) => `factorial(${n})`);

    // porcentagem N% -> (N)/100
    s = s.replace(/(\d+(?:\.\d+)?)%/g, (_, n) => `(${n})/100`);

    try {
      const r = Function('factorial', 'return ' + s)(factorial);
      if (typeof r !== 'number' || !isFinite(r)) return NaN;
      return +r;
    } catch {
      return NaN;
    }
  }

  // Entrada de teclas/botões
  function inputKey(k) {
    if (k === 'C') {
      buffer = '0';
      expr = '';
      updateDisplay();
      return;
    }
    if (k === '⌫') {
      if (buffer.length > 1) buffer = buffer.slice(0, -1);
      else buffer = '0';
      updateDisplay();
      return;
    }
    if (k === '=') {
      const lhs = (expr + ' ' + buffer).trim();
      const r = safeEval(expr + (expr ? ' ' : '') + buffer);
      if (isNaN(r)) buffer = 'Erro';
      else {
        buffer = format(r);
        pushHistory(lhs, buffer);
      }
      expr = '';
      updateDisplay();
      return;
    }

    // operadores
    if (['+', '-', '*', '/'].includes(k)) {
      if (buffer === 'Erro') buffer = '0';
      expr = (expr + ' ' + buffer + ' ' + k).trim();
      buffer = '0';
      updateDisplay();
      return;
    }

    // vírgula decimal
    if (k === ',') {
      if (!buffer.includes(',')) buffer += ',';
      updateDisplay();
      return;
    }

    // botão de porcentagem: transforma valor atual em fração (ex.: 10% -> 0.1)
    if (k === '%') {
      const r = safeEval(buffer + '%');
      buffer = isNaN(r) ? 'Erro' : format(r);
      updateDisplay();
      return;
    }

    // funções diretas
    if (['sin', 'cos', 'tan', 'ln', 'log', '√', '!'].includes(k)) {
      if (k === '!') {
        const r = safeEval(buffer + '!');
        buffer = isNaN(r) ? 'Erro' : format(r);
      } else {
        const wrap = k === '√' ? `√(${buffer})` : `${k}(${buffer})`;
        const r = safeEval(wrap);
        buffer = isNaN(r) ? 'Erro' : format(r);
      }
      updateDisplay();
      return;
    }

    // envia constantes/parênteses/potência para a expressão
    if (k === 'π' || k === 'e' || k === '(' || k === ')' || k === '^') {
      expr = (expr + ' ' + buffer).trim();
      expr += ' ' + k;
      buffer = '0';
      updateDisplay();
      return;
    }

    // números
    if (/^\d$/.test(k)) {
      buffer = buffer === '0' ? k : buffer + k;
      updateDisplay();
      return;
    }
  }

  // Mapeia cliques dos botões do teclado
  qsa('.key').forEach((k) => k.addEventListener('click', () => inputKey(k.dataset.k)));

  // Teclado físico
  document.addEventListener('keydown', (e) => {
    const map = { Enter: '=', Backspace: '⌫', ',': ',', '.': ',' };
    let k = e.key;
    if (map[k]) k = map[k];
    if (/^[0-9+\-*/()]$/.test(k) || k === '=' || k === '⌫' || k === ',' ) inputKey(k);
    if (k === '%') inputKey('%');
  });

  // Memória
  qs('#mc').onclick = () => { memory = 0; renderMemory(); };
  qs('#mr').onclick = () => { buffer = format(memory); updateDisplay(); };
  qs('#mplus').onclick = () => { const r = safeEval(buffer); if (!isNaN(r)) memory += r; renderMemory(); };
  qs('#mminus').onclick = () => { const r = safeEval(buffer); if (!isNaN(r)) memory -= r; renderMemory(); };

  // Copiar
  qs('#copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(buffer);
      qs('#copy').textContent = 'Copiado!';
      setTimeout(() => (qs('#copy').textContent = 'Copiar resultado'), 1200);
    } catch { /* ignore */ }
  };

  // Tabs
  const tabs = qs('#tabs');
  tabs.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    qsa('#tabs button').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    const tab = e.target.dataset.tab;
    qsa('.panel').forEach((p) => p.classList.remove('active'));
    qs('#panel-' + tab).classList.add('active');
  });

  // Tema
  const themeToggle = qs('#themeToggle');
  if (themeToggle) {
    themeToggle.onchange = (e) => {
      document.body.setAttribute('data-theme', e.target.checked ? 'light' : 'dark');
    };
  }

  // Modo ângulo
  qsa('#angleMode button').forEach((b) => (b.onclick = () => {
    qsa('#angleMode button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    angleMode = b.dataset.mode;
  }));

  // ===== Programador =====
  function parseIntAuto(s) {
    s = String(s).trim().toLowerCase();
    if (/^0b[01]+$/.test(s)) return parseInt(s.slice(2), 2);
    if (/^0o[0-7]+$/.test(s)) return parseInt(s.slice(2), 8);
    if (/^0x[0-9a-f]+$/.test(s)) return parseInt(s.slice(2), 16);
    if (/^[0-9]+$/.test(s)) return parseInt(s, 10);
    return NaN;
  }
  function toBin(n) { return (n >>> 0).toString(2); }

  const progParseBtn = qs('#progParse');
  if (progParseBtn) {
    progParseBtn.onclick = () => {
      const v = parseIntAuto(qs('#progInput').value);
      if (isNaN(v)) {
        qs('#decOut').textContent = 'Inválido';
        ['binOut', 'octOut', 'hexOut'].forEach((id) => (qs('#' + id).textContent = '—'));
        return;
      }
      qs('#decOut').textContent = v.toString(10);
      qs('#binOut').textContent = toBin(v);
      qs('#octOut').textContent = v.toString(8);
      qs('#hexOut').textContent = v.toString(16).toUpperCase();
    };
  }

  const bwRunBtn = qs('#bwRun');
  if (bwRunBtn) {
    bwRunBtn.onclick = () => {
      const A = parseIntAuto(qs('#bwA').value);
      const op = qs('#bwOp').value;
      const Braw = qs('#bwB').value;
      const B = Braw ? parseIntAuto(Braw) : 0;
      if (isNaN(A) || (op !== 'NOT' && Braw && isNaN(B))) {
        qs('#bwResult').innerHTML = '<span class="danger">Entrada inválida</span>';
        return;
      }
      let R;
      switch (op) {
        case 'AND': R = (A & B); break;
        case 'OR':  R = (A | B); break;
        case 'XOR': R = (A ^ B); break;
        case 'NOT': R = (~A); break;
        case 'SHL': R = (A << (B || 0)); break;
        case 'SHR': R = (A >> (B || 0)); break;
      }
      qs('#bwResult').innerHTML =
        `DEC <b class="mono">${R}</b> — ` +
        `HEX <b class="mono">${(R >>> 0).toString(16).toUpperCase()}</b> — ` +
        `BIN <b class="mono">${toBin(R)}</b>`;
    };
  }

  // ===== Unidades =====
  const unitDefs = {
    length: { base: 'm', units: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 } },
    mass:   { base: 'kg', units: { kg: 1, g: 0.001, lb: 0.45359237, oz: 0.0283495231 } },
    temp:   { base: 'C', units: {} }
  };
  const catSel = qs('#unitCat');
  const fromSel = qs('#unitFrom');
  const toSel = qs('#unitTo');
  const unitValInput = qs('#unitFromVal');
  const unitOut = qs('#unitOut');

  function populateUnits() {
    if (!catSel || !fromSel || !toSel) return;
    const cat = catSel.value;
    fromSel.innerHTML = '';
    toSel.innerHTML = '';
    if (cat === 'temp') {
      ['C','F','K'].forEach((u) => { fromSel.add(new Option(u, u)); toSel.add(new Option(u, u)); });
    } else {
      Object.keys(unitDefs[cat].units).forEach((u) => { fromSel.add(new Option(u, u)); toSel.add(new Option(u, u)); });
    }
    fromSel.selectedIndex = 0;
    toSel.selectedIndex = 1;
  }

  function convertTemp(v, from, to) {
    let c;
    if (from === 'C') c = v;
    else if (from === 'F') c = (v - 32) * 5 / 9;
    else if (from === 'K') c = v - 273.15;
    if (to === 'C') return c;
    if (to === 'F') return c * 9 / 5 + 32;
    if (to === 'K') return c + 273.15;
  }

  function computeUnit() {
    if (!catSel || !fromSel || !toSel || !unitOut) return;
    const cat = catSel.value;
    const x = parseFloat(unitValInput.value);
    if (isNaN(x)) { unitOut.textContent = '—'; return; }
    let y;
    if (cat === 'temp') {
      y = convertTemp(x, fromSel.value, toSel.value);
      unitOut.textContent = `${formatUnits(x, fromSel.value)} = ${formatUnits(y, toSel.value)}`;
    } else {
      const base = x * unitDefs[cat].units[fromSel.value]; // para base
      y = base / unitDefs[cat].units[toSel.value];
      unitOut.textContent = `${formatUnits(x, fromSel.value)} = ${formatUnits(y, toSel.value)}`;
    }
  }

  if (catSel && fromSel && toSel) {
    populateUnits();
    catSel.onchange = () => { populateUnits(); computeUnit(); };
    if (unitValInput) unitValInput.oninput = computeUnit;
    fromSel.onchange = computeUnit;
    toSel.onchange = computeUnit;
    const swapBtn = qs('#unitSwap');
    if (swapBtn) swapBtn.onclick = () => { const a = fromSel.value; fromSel.value = toSel.value; toSel.value = a; computeUnit(); };
  }

  // ===== Financeira =====
  const fsP = qs('#fsP'), fsI = qs('#fsI'), fsN = qs('#fsN'), fsOut = qs('#fsOut');
  const fcP = qs('#fcP'), fcI = qs('#fcI'), fcN = qs('#fcN'), fcOut = qs('#fcOut');
  const flP = qs('#flP'), flI = qs('#flI'), flN = qs('#flN'), flOut = qs('#flOut');

  function getNum(el) {
    if (!el) return NaN;
    const v = parseFloat(el.value);
    return isNaN(v) ? NaN : v;
    }

  const fsCalc = qs('#fsCalc');
  if (fsCalc && fsOut) {
    fsCalc.onclick = () => {
      const P = getNum(fsP), i = getNum(fsI) / 100, n = getNum(fsN);
      if ([P, i, n].some(v => isNaN(v))) { fsOut.textContent = '—'; return; }
      const A = P * (1 + i * n);
      const J = A - P;
      fsOut.textContent = `Montante A = ${format(A)} — Juros J = ${format(J)}`;
    };
  }

  const fcCalc = qs('#fcCalc');
  if (fcCalc && fcOut) {
    fcCalc.onclick = () => {
      const P = getNum(fcP), i = getNum(fcI) / 100, n = getNum(fcN);
      if ([P, i, n].some(v => isNaN(v))) { fcOut.textContent = '—'; return; }
      const A = P * Math.pow(1 + i, n);
      const J = A - P;
      fcOut.textContent = `Montante A = ${format(A)} — Juros J = ${format(J)}`;
    };
  }

  const flCalc = qs('#flCalc');
  if (flCalc && flOut) {
    flCalc.onclick = () => {
      const PV = getNum(flP), i = getNum(flI) / 100, n = getNum(flN);
      if ([PV, i, n].some(v => isNaN(v)) || i === 0) { flOut.textContent = '—'; return; }
      const PMT = PV * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
      flOut.textContent = `Parcela PMT = ${format(PMT)}`;
    };
  }

  // ===== Histórico: limpar =====
  const clearHistBtn = qs('#clearHist');
  if (clearHistBtn) {
    clearHistBtn.onclick = () => {
      history = [];
      renderHistory();
    };
  }

  // Arraste do histórico para o display
  valueEl.addEventListener('dragover', (e) => e.preventDefault());
  valueEl.addEventListener('drop', (e) => {
    e.preventDefault();
    const t = e.dataTransfer.getData('text/plain');
    if (t) { buffer = t; updateDisplay(); }
  });

  // Inicializa
  updateDisplay();
})();