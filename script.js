(() => {
  'use strict';

  // --- State ---
  const state = {
    expression: '',
    lastAnswer: 0,
    memory: 0,
    angleMode: 'DEG', // 'DEG' or 'RAD'
    soundEnabled: true,
    sciOpen: true,
    justEvaluated: false,
    history: JSON.parse(localStorage.getItem('nova_calc_history') || '[]'),
    splitRoundUnit: 1,
  };

  // --- DOM Elements ---
  const el = {
    expressionInput: document.getElementById('expressionInput'),
    prevExpression: document.getElementById('prevExpression'),
    livePreview: document.getElementById('livePreview'),
    koreanUnitPreview: document.getElementById('koreanUnitPreview'),
    angleBadge: document.getElementById('angleBadge'),
    memoryBadge: document.getElementById('memoryBadge'),
    sciToggleBtn: document.getElementById('sciToggleBtn'),
    scientificPad: document.getElementById('scientificPad'),
    copyResultBtn: document.getElementById('copyResultBtn'),
    historyList: document.getElementById('historyList'),
    historyCount: document.getElementById('historyCount'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    themeToggle: document.getElementById('themeToggle'),
    sunIcon: document.getElementById('sunIcon'),
    moonIcon: document.getElementById('moonIcon'),
    soundToggle: document.getElementById('soundToggle'),
    soundOnIcon: document.getElementById('soundOnIcon'),
    soundOffIcon: document.getElementById('soundOffIcon'),
    toast: document.getElementById('toast'),

    // Smart Note
    smartNoteInput: document.getElementById('smartNoteInput'),
    smartNoteResults: document.getElementById('smartNoteResults'),
    noteLineCount: document.getElementById('noteLineCount'),
    noteAverage: document.getElementById('noteAverage'),
    noteTotal: document.getElementById('noteTotal'),
    loadSampleNoteBtn: document.getElementById('loadSampleNoteBtn'),
    clearNoteBtn: document.getElementById('clearNoteBtn'),
    copyNoteTotalBtn: document.getElementById('copyNoteTotalBtn'),

    // Life Tools - Split
    splitTotal: document.getElementById('splitTotal'),
    splitPeople: document.getElementById('splitPeople'),
    splitTip: document.getElementById('splitTip'),
    splitPerPerson: document.getElementById('splitPerPerson'),
    splitFinalTotal: document.getElementById('splitFinalTotal'),
    splitRemainder: document.getElementById('splitRemainder'),
    sendSplitToCalc: document.getElementById('sendSplitToCalc'),

    // Life Tools - Discount
    discOriginal: document.getElementById('discOriginal'),
    discRate: document.getElementById('discRate'),
    discExtra: document.getElementById('discExtra'),
    discFinalPrice: document.getElementById('discFinalPrice'),
    discSavedAmount: document.getElementById('discSavedAmount'),
    discEffectiveRate: document.getElementById('discEffectiveRate'),

    // Life Tools - Unit Converter
    unitCategory: document.getElementById('unitCategory'),
    unitInputVal: document.getElementById('unitInputVal'),
    unitOutputVal: document.getElementById('unitOutputVal'),
    unitFrom: document.getElementById('unitFrom'),
    unitTo: document.getElementById('unitTo'),
    swapUnitsBtn: document.getElementById('swapUnitsBtn'),
    unitFormulaHint: document.getElementById('unitFormulaHint'),

    // Life Tools - BMI
    bmiHeight: document.getElementById('bmiHeight'),
    bmiWeight: document.getElementById('bmiWeight'),
    bmiValue: document.getElementById('bmiValue'),
    bmiStatus: document.getElementById('bmiStatus'),
    bmiIdealRange: document.getElementById('bmiIdealRange'),
  };

  // --- Web Audio Tactile Click Sound ---
  let audioCtx = null;
  function playClickSound(freq = 520, duration = 0.025) {
    if (!state.soundEnabled) return;
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {
      // Ignore audio errors if blocked by browser policy
    }
  }

  // --- Toast Helper ---
  let toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 1800);
  }

  // --- Number Formatting & Korean Unit Helper ---
  function formatNumber(num) {
    if (typeof num !== 'number' || !isFinite(num)) return '오류';
    // Clean floating point noise like 0.30000000000000004
    const cleaned = Number(Math.round(num + 'e12') + 'e-12');
    if (Math.abs(cleaned) >= 1e15 || (Math.abs(cleaned) > 0 && Math.abs(cleaned) < 1e-7)) {
      return cleaned.toExponential(6).replace(/\.?0+e/, 'e');
    }
    const parts = cleaned.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  function toKoreanUnitString(num) {
    if (typeof num !== 'number' || !isFinite(num)) return '';
    const abs = Math.floor(Math.abs(num));
    if (abs < 10000) return '';
    const units = [
      { value: 1e12, label: '조' },
      { value: 1e8, label: '억' },
      { value: 1e4, label: '만' },
    ];
    let rem = abs;
    const chunks = [];
    for (const u of units) {
      if (rem >= u.value) {
        const count = Math.floor(rem / u.value);
        rem %= u.value;
        chunks.push(`${count.toLocaleString('ko-KR')}${u.label}`);
      }
    }
    if (rem > 0) {
      chunks.push(rem.toLocaleString('ko-KR'));
    }
    return (num < 0 ? '-' : '') + chunks.join(' ');
  }

  // --- Math Helper Functions ---
  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n > 170) return Infinity;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  }

  // --- Safe Smart Expression Evaluator ---
  function evaluateMathExpression(rawExpr) {
    if (!rawExpr || typeof rawExpr !== 'string') return null;

    let expr = rawExpr
      .replace(/,/g, '')
      .replace(/\s+/g, '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');

    if (!expr) return null;

    // Strip trailing binary operators for live preview
    expr = expr.replace(/[+\-*/^.(]+$/, '');
    if (!expr) return null;

    // Auto-close unclosed parentheses
    const openCount = (expr.match(/\(/g) || []).length;
    const closeCount = (expr.match(/\)/g) || []).length;
    if (openCount > closeCount) {
      expr += ')'.repeat(openCount - closeCount);
    }

    // Handle Korean style "A의 B%" -> "(A*(B/100))"
    expr = expr.replace(/(\d+(?:\.\d+)?)의(\d+(?:\.\d+)?)%/g, '($1*($2/100))');

    // Handle smart percentage: "A + B%" -> "A + (A * B / 100)" and "A - B%" -> "A - (A * B / 100)"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)%/g, '($1$2($1*$3/100))');

    // Remaining "N%" -> "(N/100)"
    expr = expr.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // Handle factorial: "5!" -> "fact(5)"
    expr = expr.replace(/(\d+|\([^()]+\))!/g, 'fact($1)');

    // Replace constants
    // Implicit multiplication before constants or functions or parens:
    // e.g., 2π -> 2*π, 2(3) -> 2*(3), )2 -> )*2, )( -> )*(, 2sin( -> 2*sin(
    expr = expr
      .replace(/(\d)(π|e|√|sin|cos|tan|log|ln|abs|\()/g, '$1*$2')
      .replace(/(\)|π|e)(\d|\(|π|e|√|sin|cos|tan|log|ln|abs)/g, '$1*$2');

    // Replace √(x) or √number
    expr = expr.replace(/√\(/g, 'sqrt(');
    expr = expr.replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)');

    // Replace power ^ with **
    expr = expr.replace(/\^/g, '**');

    // Replace constants and functions with Math equivalents
    expr = expr
      .replace(/π/g, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/\bsin\(/g, '__sin(')
      .replace(/\bcos\(/g, '__cos(')
      .replace(/\btan\(/g, '__tan(')
      .replace(/\blog\(/g, 'Math.log10(')
      .replace(/\bln\(/g, 'Math.log(')
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\bfact\(/g, '__fact(');

    // Security check: only allow valid math tokens
    const sanitizedCheck = expr.replace(
      /(Math\.(PI|E|log10|log|sqrt|abs)|__(sin|cos|tan|fact)|[0-9+\-*/().\s])/g,
      ''
    );
    if (sanitizedCheck.length > 0) {
      return null;
    }

    const toRad = (deg) => (state.angleMode === 'DEG' ? (deg * Math.PI) / 180 : deg);
    const __sin = (x) => {
      const r = toRad(x);
      // Avoid tiny floating error on sin(180)
      const val = Math.sin(r);
      return Math.abs(val) < 1e-15 ? 0 : val;
    };
    const __cos = (x) => {
      const r = toRad(x);
      const val = Math.cos(r);
      return Math.abs(val) < 1e-15 ? 0 : val;
    };
    const __tan = (x) => {
      if (state.angleMode === 'DEG' && Math.abs(x % 180) === 90) return NaN;
      return Math.tan(toRad(x));
    };
    const __fact = (x) => factorial(x);

    try {
      const fn = new Function('__sin', '__cos', '__tan', '__fact', `return (${expr});`);
      const result = fn(__sin, __cos, __tan, __fact);
      if (typeof result === 'number' && !Number.isNaN(result)) {
        return Number(Math.round(result + 'e12') + 'e-12');
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // --- Update Calculator Display ---
  function updateDisplay() {
    el.expressionInput.value = state.expression;

    if (!state.expression.trim()) {
      el.livePreview.textContent = '';
      el.koreanUnitPreview.textContent = '';
      return;
    }

    const val = evaluateMathExpression(state.expression);
    if (val !== null && isFinite(val)) {
      const formatted = formatNumber(val);
      el.livePreview.textContent = `= ${formatted}`;
      el.koreanUnitPreview.textContent = toKoreanUnitString(val);
    } else {
      el.livePreview.textContent = '';
      el.koreanUnitPreview.textContent = '';
    }
  }

  // --- Insert Token into Expression ---
  function insertToken(token) {
    playClickSound(560);
    const isOperator = ['+', '−', '×', '÷', '^', '^2', '%'].includes(token);

    if (state.justEvaluated) {
      if (isOperator) {
        // Continue calculation with previous result
        state.justEvaluated = false;
      } else {
        // Start fresh expression
        state.expression = '';
        state.justEvaluated = false;
      }
    }

    // Prevent duplicate binary operators in a row
    const binaryOps = ['+', '−', '×', '÷', '^'];
    const lastChar = state.expression.slice(-1);
    if (binaryOps.includes(token) && binaryOps.includes(lastChar)) {
      state.expression = state.expression.slice(0, -1) + token;
      updateDisplay();
      return;
    }

    state.expression += token;
    updateDisplay();
  }

  // --- Smart Parentheses Button ---
  function insertSmartParens() {
    playClickSound(540);
    if (state.justEvaluated) {
      state.expression = '(';
      state.justEvaluated = false;
      updateDisplay();
      return;
    }
    const openCount = (state.expression.match(/\(/g) || []).length;
    const closeCount = (state.expression.match(/\)/g) || []).length;
    const lastChar = state.expression.slice(-1);

    if (
      openCount > closeCount &&
      (/[\dπe)!%]/.test(lastChar))
    ) {
      state.expression += ')';
    } else {
      state.expression += '(';
    }
    updateDisplay();
  }

  // --- Negate (±) ---
  function toggleNegate() {
    playClickSound(500);
    if (!state.expression) {
      state.expression = '−';
      updateDisplay();
      return;
    }
    if (state.expression.startsWith('−')) {
      state.expression = state.expression.slice(1);
    } else if (state.expression.startsWith('-')) {
      state.expression = state.expression.slice(1);
    } else {
      state.expression = '−' + state.expression;
    }
    updateDisplay();
  }

  // --- Execute Evaluation (=) ---
  function executeEvaluate() {
    playClickSound(680, 0.04);
    if (!state.expression.trim()) return;

    const val = evaluateMathExpression(state.expression);
    if (val === null || !isFinite(val)) {
      el.prevExpression.textContent = `${state.expression} =`;
      el.livePreview.textContent = '수식 오류';
      return;
    }

    const formatted = formatNumber(val);
    const exprSnapshot = state.expression;

    el.prevExpression.textContent = `${exprSnapshot} =`;
    state.lastAnswer = val;
    state.expression = String(val);
    state.justEvaluated = true;

    addHistoryItem(exprSnapshot, formatted, val);
    updateDisplay();
  }

  // --- History Management ---
  function saveHistory() {
    localStorage.setItem('nova_calc_history', JSON.stringify(state.history.slice(0, 50)));
  }

  function addHistoryItem(expr, formattedResult, rawValue) {
    // Avoid adding single number identity
    if (expr.replace(/,/g, '') === String(rawValue)) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    state.history.unshift({
      id: Date.now() + Math.random().toString(36).slice(2, 6),
      expr,
      result: formattedResult,
      raw: rawValue,
      time: timeStr,
      pinned: false,
    });

    // Keep pinned items + recent items up to 50
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    el.historyCount.textContent = state.history.length;

    if (state.history.length === 0) {
      el.historyList.innerHTML = `
        <div class="history-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>아직 계산 기록이 없습니다.<br/>계산기를 누르거나 키보드로 입력해 보세요!</p>
        </div>
      `;
      return;
    }

    // Sort pinned items first
    const sorted = [...state.history].sort((a, b) => Number(b.pinned) - Number(a.pinned));

    el.historyList.innerHTML = sorted
      .map(
        (item) => `
        <div class="history-item ${item.pinned ? 'pinned' : ''}" data-id="${item.id}">
          <div class="history-item-top">
            <span>${item.pinned ? '📌 고정됨 · ' : ''}${item.time}</span>
            <div class="history-item-actions">
              <button class="hist-action-btn ${item.pinned ? 'pinned-active' : ''}" data-hist-action="pin" data-id="${item.id}" title="상단 고정">★</button>
              <button class="hist-action-btn" data-hist-action="copy" data-id="${item.id}" title="결과 복사">복사</button>
              <button class="hist-action-btn" data-hist-action="delete" data-id="${item.id}" title="삭제">✕</button>
            </div>
          </div>
          <div class="history-expr" data-hist-action="load-expr" data-id="${item.id}" title="클릭하여 수식 불러오기">${item.expr}</div>
          <div class="history-res" data-hist-action="load-res" data-id="${item.id}" title="클릭하여 결과값 불러오기">= ${item.result}</div>
        </div>
      `
      )
      .join('');
  }

  // --- Memory Actions ---
  function handleMemoryAction(action) {
    playClickSound(600);
    const currentVal = evaluateMathExpression(state.expression) ?? state.lastAnswer ?? 0;

    switch (action) {
      case 'mc':
        state.memory = 0;
        el.memoryBadge.classList.add('hidden');
        showToast('메모리가 초기화되었습니다 (MC)');
        break;
      case 'mr':
        if (state.justEvaluated) {
          state.expression = String(state.memory);
          state.justEvaluated = false;
        } else {
          state.expression += String(state.memory);
        }
        updateDisplay();
        break;
      case 'm-plus':
        state.memory += currentVal;
        el.memoryBadge.classList.remove('hidden');
        el.memoryBadge.textContent = `M: ${formatNumber(state.memory)}`;
        showToast(`메모리에 +${formatNumber(currentVal)} 저장됨`);
        break;
      case 'm-minus':
        state.memory -= currentVal;
        el.memoryBadge.classList.remove('hidden');
        el.memoryBadge.textContent = `M: ${formatNumber(state.memory)}`;
        showToast(`메모리에서 -${formatNumber(currentVal)} 차감됨`);
        break;
      case 'ans':
        insertToken(String(state.lastAnswer));
        break;
    }
  }

  // --- MODE 2: SMART EXPRESSION NOTE ---
  const SAMPLE_NOTE = [
    '팀 점심 파스타 16000 * 4',
    '음료 추가 4500 * 4',
    '멤버십 10% 할인 -82000의 10%',
    '디저트 카페 6800 * 3',
    '주차비 정산 5000',
  ].join('\n');

  function parseAndEvaluateNoteLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      return null;
    }
    // Extract math expression from mixed Korean text line:
    // Keep numbers, operators, parens, %, '.', '의' (when between numbers)
    let mathPart = trimmed.replace(/,/g, '');
    // Replace "150000의 10%" pattern first
    mathPart = mathPart.replace(/(\d+(?:\.\d+)?)\s*의\s*(\d+(?:\.\d+)?)%/g, '($1*($2/100))');
    // Strip Korean/English labels while preserving math tokens
    mathPart = mathPart.replace(/[^0-9+\-*/×÷−^().%πe]/g, ' ').trim();
    // Collapse multiple spaces; if two standalone numbers are separated by space without operator, take the last expression chunk
    const tokens = mathPart.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    const candidate = tokens.join('');
    return evaluateMathExpression(candidate);
  }

  function updateSmartNote() {
    const lines = el.smartNoteInput.value.split('\n');
    let count = 0;
    let total = 0;

    const resultHtml = lines
      .map((line) => {
        const val = parseAndEvaluateNoteLine(line);
        if (val !== null && isFinite(val)) {
          count++;
          total += val;
          return `<div class="note-res-line">= ${formatNumber(val)}</div>`;
        }
        return `<div class="note-res-line empty">·</div>`;
      })
      .join('');

    el.smartNoteResults.innerHTML = resultHtml;
    el.noteLineCount.textContent = `${count}개`;
    el.noteAverage.textContent = count > 0 ? formatNumber(total / count) : '0';
    el.noteTotal.textContent = formatNumber(total);
  }

  // --- MODE 3: LIFE TOOLS ---
  // 1. Split Bill
  function updateSplitCalculator() {
    const total = Math.max(0, Number(el.splitTotal.value) || 0);
    const people = Math.max(1, Math.floor(Number(el.splitPeople.value) || 1));
    const tipRate = Math.max(0, Number(el.splitTip.value) || 0);

    const finalTotal = Math.round(total * (1 + tipRate / 100));
    const rawPerPerson = finalTotal / people;
    const roundUnit = state.splitRoundUnit;

    const roundedPerPerson =
      roundUnit > 1
        ? Math.ceil(rawPerPerson / roundUnit) * roundUnit
        : Math.round(rawPerPerson);

    const collectedTotal = roundedPerPerson * people;
    const diff = collectedTotal - finalTotal;

    el.splitPerPerson.textContent = `${formatNumber(roundedPerPerson)}원`;
    el.splitFinalTotal.textContent = `${formatNumber(finalTotal)}원`;
    if (diff === 0) {
      el.splitRemainder.textContent = '딱 맞음 (0원)';
    } else if (diff > 0) {
      el.splitRemainder.textContent = `+${formatNumber(diff)}원 남음`;
    } else {
      el.splitRemainder.textContent = `${formatNumber(diff)}원 부족`;
    }
  }

  // 2. Discount Calculator
  function updateDiscountCalculator() {
    const original = Math.max(0, Number(el.discOriginal.value) || 0);
    const rate1 = Math.min(100, Math.max(0, Number(el.discRate.value) || 0));
    const rate2 = Math.min(100, Math.max(0, Number(el.discExtra.value) || 0));

    const afterFirst = original * (1 - rate1 / 100);
    const finalPrice = Math.round(afterFirst * (1 - rate2 / 100));
    const saved = original - finalPrice;
    const effectiveRate = original > 0 ? ((saved / original) * 100).toFixed(1) : '0.0';

    el.discFinalPrice.textContent = `${formatNumber(finalPrice)}원`;
    el.discSavedAmount.textContent = `-${formatNumber(saved)}원`;
    el.discEffectiveRate.textContent = `${effectiveRate}%`;
  }

  // 3. Unit Converter
  const UNIT_DEFS = {
    area: {
      hint: '1평 ≈ 3.305785 ㎡ (아파트·부동산 전용면적 변환)',
      units: {
        pyeong: { label: '평 (坪)', toBase: (v) => v * 3.305785, fromBase: (v) => v / 3.305785 },
        sqm: { label: '제곱미터 (㎡)', toBase: (v) => v, fromBase: (v) => v },
        sqft: { label: '제곱피트 (ft²)', toBase: (v) => v * 0.092903, fromBase: (v) => v / 0.092903 },
      },
    },
    length: {
      hint: '1 inch = 2.54 cm · 1 ft = 30.48 cm',
      units: {
        cm: { label: '센티미터 (cm)', toBase: (v) => v / 100, fromBase: (v) => v * 100 },
        m: { label: '미터 (m)', toBase: (v) => v, fromBase: (v) => v },
        km: { label: '킬로미터 (km)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
        inch: { label: '인치 (inch)', toBase: (v) => v * 0.0254, fromBase: (v) => v / 0.0254 },
        ft: { label: '피트 (ft)', toBase: (v) => v * 0.3048, fromBase: (v) => v / 0.3048 },
      },
    },
    weight: {
      hint: '고기 1근 = 600g · 1 lb ≈ 0.4536 kg',
      units: {
        kg: { label: '킬로그램 (kg)', toBase: (v) => v * 1000, fromBase: (v) => v / 1000 },
        g: { label: '그램 (g)', toBase: (v) => v, fromBase: (v) => v },
        geun: { label: '근 (600g)', toBase: (v) => v * 600, fromBase: (v) => v / 600 },
        lb: { label: '파운드 (lb)', toBase: (v) => v * 453.59237, fromBase: (v) => v / 453.59237 },
        oz: { label: '온스 (oz)', toBase: (v) => v * 28.3495, fromBase: (v) => v / 28.3495 },
      },
    },
    temp: {
      hint: '°F = (°C × 1.8) + 32',
      units: {
        c: { label: '섭씨 (°C)', toBase: (v) => v, fromBase: (v) => v },
        f: { label: '화씨 (°F)', toBase: (v) => (v - 32) / 1.8, fromBase: (v) => v * 1.8 + 32 },
        k: { label: '켈빈 (K)', toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
      },
    },
    data: {
      hint: '1 TB = 1,024 GB = 1,048,576 MB',
      units: {
        mb: { label: '메가바이트 (MB)', toBase: (v) => v, fromBase: (v) => v },
        gb: { label: '기가바이트 (GB)', toBase: (v) => v * 1024, fromBase: (v) => v / 1024 },
        tb: { label: '테라바이트 (TB)', toBase: (v) => v * 1048576, fromBase: (v) => v / 1048576 },
      },
    },
  };

  function populateUnitSelects() {
    const cat = el.unitCategory.value;
    const def = UNIT_DEFS[cat];
    const keys = Object.keys(def.units);

    const optionsHtml = keys
      .map((k) => `<option value="${k}">${def.units[k].label}</option>`)
      .join('');

    el.unitFrom.innerHTML = optionsHtml;
    el.unitTo.innerHTML = optionsHtml;
    if (keys.length > 1) {
      el.unitTo.value = keys[1];
    }
    el.unitFormulaHint.textContent = def.hint;
    updateUnitCalculation();
  }

  function updateUnitCalculation() {
    const cat = el.unitCategory.value;
    const def = UNIT_DEFS[cat];
    const fromKey = el.unitFrom.value;
    const toKey = el.unitTo.value;
    const val = parseFloat(el.unitInputVal.value);

    if (Number.isNaN(val)) {
      el.unitOutputVal.value = '';
      return;
    }

    const baseVal = def.units[fromKey].toBase(val);
    const outVal = def.units[toKey].fromBase(baseVal);
    el.unitOutputVal.value = formatNumber(Number(outVal.toFixed(4)));
  }

  // 4. BMI Calculator
  function updateBmiCalculator() {
    const hCm = Math.max(50, Number(el.bmiHeight.value) || 170);
    const wKg = Math.max(10, Number(el.bmiWeight.value) || 65);
    const hM = hCm / 100;
    const bmi = wKg / (hM * hM);

    el.bmiValue.textContent = bmi.toFixed(2);

    let status = '정상';
    if (bmi < 18.5) status = '저체중';
    else if (bmi < 23) status = '정상';
    else if (bmi < 25) status = '과체중 (비만 전단계)';
    else if (bmi < 30) status = '1단계 비만';
    else status = '2단계 이상 비만';

    el.bmiStatus.textContent = status;

    const minIdeal = (18.5 * hM * hM).toFixed(1);
    const maxIdeal = (22.9 * hM * hM).toFixed(1);
    el.bmiIdealRange.textContent = `${minIdeal}kg ~ ${maxIdeal}kg`;
  }

  // --- Event Listeners ---
  function initEvents() {
    // Mode Tabs
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        playClickSound(600);
        const mode = tab.dataset.mode;
        document.querySelectorAll('.mode-tab').forEach((t) => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', String(t === tab));
        });
        document.querySelectorAll('.mode-view').forEach((view) => {
          view.classList.toggle('active', view.id === `mode-${mode}`);
        });
      });
    });

    // Calculator Buttons
    document.querySelectorAll('.calc-btn, .quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const insert = btn.dataset.insert;
        const action = btn.dataset.action;

        if (insert !== undefined) {
          insertToken(insert);
          return;
        }

        switch (action) {
          case 'clear':
            playClickSound(440);
            state.expression = '';
            state.justEvaluated = false;
            el.prevExpression.textContent = '';
            updateDisplay();
            break;
          case 'backspace':
            playClickSound(480);
            if (state.justEvaluated) {
              state.justEvaluated = false;
            }
            state.expression = state.expression.slice(0, -1);
            updateDisplay();
            break;
          case 'parens':
            insertSmartParens();
            break;
          case 'negate':
            toggleNegate();
            break;
          case 'evaluate':
            executeEvaluate();
            break;
        }
      });
    });

    // Memory Buttons
    document.querySelectorAll('.mem-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        handleMemoryAction(btn.dataset.action);
      });
    });

    // Direct input into expressionInput
    el.expressionInput.addEventListener('input', (e) => {
      state.expression = e.target.value;
      state.justEvaluated = false;
      updateDisplay();
    });

    // Angle Mode Toggle (DEG / RAD)
    el.angleBadge.addEventListener('click', () => {
      playClickSound(620);
      state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
      el.angleBadge.textContent = state.angleMode;
      updateDisplay();
      showToast(`각도 단위가 ${state.angleMode}로 변경되었습니다`);
    });

    // Scientific Pad Collapse Toggle
    el.sciToggleBtn.addEventListener('click', () => {
      playClickSound(550);
      state.sciOpen = !state.sciOpen;
      el.scientificPad.classList.toggle('collapsed', !state.sciOpen);
      el.sciToggleBtn.classList.toggle('open', state.sciOpen);
    });

    // Copy Live Result
    el.copyResultBtn.addEventListener('click', () => {
      const val = evaluateMathExpression(state.expression);
      const textToCopy = val !== null ? String(val) : state.expression;
      if (!textToCopy) return;
      navigator.clipboard?.writeText(textToCopy);
      showToast(`결과(${formatNumber(Number(textToCopy))})가 복사되었습니다!`);
    });

    // History Actions
    el.historyList.addEventListener('click', (e) => {
      const target = e.target.closest('[data-hist-action]');
      if (!target) {
        const card = e.target.closest('.history-item');
        if (!card) return;
        const item = state.history.find((h) => h.id === card.dataset.id);
        if (item) {
          state.expression = String(item.raw);
          state.justEvaluated = false;
          updateDisplay();
          showToast('계산 결과를 불러왔습니다');
        }
        return;
      }

      const action = target.dataset.histAction;
      const id = target.dataset.id;
      const item = state.history.find((h) => h.id === id);
      if (!item) return;

      if (action === 'pin') {
        item.pinned = !item.pinned;
        saveHistory();
        renderHistory();
      } else if (action === 'copy') {
        navigator.clipboard?.writeText(String(item.raw));
        showToast(`${item.result} 복사됨!`);
      } else if (action === 'delete') {
        state.history = state.history.filter((h) => h.id !== id);
        saveHistory();
        renderHistory();
      } else if (action === 'load-expr') {
        state.expression = item.expr;
        state.justEvaluated = false;
        updateDisplay();
        showToast('수식을 불러왔습니다');
      } else if (action === 'load-res') {
        state.expression = String(item.raw);
        state.justEvaluated = false;
        updateDisplay();
        showToast('결과값을 불러왔습니다');
      }
    });

    el.clearHistoryBtn.addEventListener('click', () => {
      state.history = state.history.filter((h) => h.pinned);
      saveHistory();
      renderHistory();
      showToast('고정된 항목을 제외한 기록을 비웠습니다');
    });

    // Theme Toggle
    el.themeToggle.addEventListener('click', () => {
      playClickSound(600);
      const html = document.documentElement;
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      el.sunIcon.classList.toggle('hidden', next === 'light');
      el.moonIcon.classList.toggle('hidden', next === 'dark');
    });

    // Sound Toggle
    el.soundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      el.soundOnIcon.classList.toggle('hidden', !state.soundEnabled);
      el.soundOffIcon.classList.toggle('hidden', state.soundEnabled);
      if (state.soundEnabled) playClickSound(640);
      showToast(state.soundEnabled ? '클릭 효과음 켜짐' : '클릭 효과음 꺼짐');
    });

    // Global Keyboard Support for Calculator Mode
    window.addEventListener('keydown', (e) => {
      const calcModeActive = document.getElementById('mode-calculator').classList.contains('active');
      if (!calcModeActive) return;
      if (document.activeElement === el.expressionInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeEvaluate();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          state.expression = '';
          el.prevExpression.textContent = '';
          updateDisplay();
        }
        return;
      }

      const keyMap = {
        '/': '÷',
        '*': '×',
        '-': '−',
        '+': '+',
        '%': '%',
        '.': '.',
      };

      // Highlight matching button visually
      const btnSelector = `[data-key="${CSS.escape(e.key)}"]`;
      const matchingBtn = document.querySelector(btnSelector);
      if (matchingBtn) {
        matchingBtn.classList.add('pressed');
        setTimeout(() => matchingBtn.classList.remove('pressed'), 120);
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        insertToken(e.key);
      } else if (keyMap[e.key]) {
        e.preventDefault();
        insertToken(keyMap[e.key]);
      } else if (e.key === '(' || e.key === ')') {
        e.preventDefault();
        insertToken(e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        executeEvaluate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        playClickSound(480);
        state.expression = state.expression.slice(0, -1);
        updateDisplay();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        playClickSound(440);
        state.expression = '';
        el.prevExpression.textContent = '';
        updateDisplay();
      }
    });

    // Smart Note Events
    el.smartNoteInput.addEventListener('input', updateSmartNote);
    el.loadSampleNoteBtn.addEventListener('click', () => {
      el.smartNoteInput.value = SAMPLE_NOTE;
      updateSmartNote();
    });
    el.clearNoteBtn.addEventListener('click', () => {
      el.smartNoteInput.value = '';
      updateSmartNote();
    });
    el.copyNoteTotalBtn.addEventListener('click', () => {
      const totalText = el.noteTotal.textContent;
      navigator.clipboard?.writeText(totalText.replace(/,/g, ''));
      showToast(`총 합계(${totalText})가 복사되었습니다!`);
    });

    // Life Tools Sub-tabs
    document.querySelectorAll('.subtool-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        playClickSound(560);
        const sub = tab.dataset.subtool;
        document.querySelectorAll('.subtool-tab').forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.subtool-panel').forEach((p) =>
          p.classList.toggle('active', p.id === `subtool-${sub}`)
        );
      });
    });

    // Stepper Buttons (+ / -)
    document.querySelectorAll('.step-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        playClickSound(540);
        const target = document.getElementById(btn.dataset.stepTarget);
        const step = Number(btn.dataset.step) || 1;
        const nextVal = Math.max(Number(target.min) || 1, (Number(target.value) || 0) + step);
        target.value = nextVal;
        updateSplitCalculator();
      });
    });

    // Split Bill Events
    [el.splitTotal, el.splitPeople, el.splitTip].forEach((inp) =>
      inp.addEventListener('input', updateSplitCalculator)
    );
    document.querySelectorAll('#splitRoundGroup .pill-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#splitRoundGroup .pill-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.splitRoundUnit = Number(btn.dataset.round) || 1;
        updateSplitCalculator();
      });
    });
    el.sendSplitToCalc.addEventListener('click', () => {
      const perPersonRaw = el.splitPerPerson.textContent.replace(/[^0-9]/g, '');
      state.expression = perPersonRaw;
      state.justEvaluated = false;
      updateDisplay();
      document.querySelector('.mode-tab[data-mode="calculator"]').click();
      showToast('1인당 정산 금액을 계산기로 보냈습니다');
    });

    // Discount Events
    [el.discOriginal, el.discRate, el.discExtra].forEach((inp) =>
      inp.addEventListener('input', updateDiscountCalculator)
    );
    document.querySelectorAll('.quick-disc').forEach((btn) => {
      btn.addEventListener('click', () => {
        el.discRate.value = btn.dataset.rate;
        updateDiscountCalculator();
      });
    });

    // Unit Converter Events
    el.unitCategory.addEventListener('change', populateUnitSelects);
    [el.unitInputVal, el.unitFrom, el.unitTo].forEach((inp) =>
      inp.addEventListener('input', updateUnitCalculation)
    );
    el.swapUnitsBtn.addEventListener('click', () => {
      const temp = el.unitFrom.value;
      el.unitFrom.value = el.unitTo.value;
      el.unitTo.value = temp;
      updateUnitCalculation();
    });

    // BMI Events
    [el.bmiHeight, el.bmiWeight].forEach((inp) =>
      inp.addEventListener('input', updateBmiCalculator)
    );
  }

  // --- Initialize App ---
  function init() {
    el.smartNoteInput.value = SAMPLE_NOTE;
    updateSmartNote();
    updateSplitCalculator();
    updateDiscountCalculator();
    populateUnitSelects();
    updateBmiCalculator();
    renderHistory();
    initEvents();
  }

  init();
})();

