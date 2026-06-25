(function () {
  'use strict';

  const displayEl = document.getElementById('display');
  const historyEl = document.getElementById('history');
  const keys = document.querySelectorAll('.key');

  // ----- State -----
  // currentInput: the number currently being typed/shown (as a string)
  // previousValue: the stored left-hand operand (number) once an operator is chosen
  // operator: the pending operator symbol (+, −, ×, ÷)
  // overwrite: true means the next digit press should replace currentInput,
  //            rather than appending to it (e.g. right after an operator or "=")
  let currentInput = '0';
  let previousValue = null;
  let operator = null;
  let overwrite = true;
  let isError = false;

  const MAX_DIGITS = 14;

  // ----- Rendering -----
  function render() {
    displayEl.textContent = formatForDisplay(currentInput);
    displayEl.classList.toggle('is-error', isError);

    if (operator && previousValue !== null && !isError) {
      historyEl.textContent = `${formatForDisplay(stripTrailing(previousValue))} ${operator}`;
    } else if (!isError) {
      historyEl.textContent = '\u00A0'; // non-breaking space keeps the line height stable
    }
  }

  function formatForDisplay(value) {
    if (isError) return value;
    if (value === '' ) return '0';

    // Split sign, integer, decimal so we can comma-format only the integer part
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const [intPart, decPart] = unsigned.split('.');

    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let result = withCommas;
    if (decPart !== undefined) result += '.' + decPart;
    return (negative ? '-' : '') + result;
  }

  function stripTrailing(num) {
    // Convert a JS number back to a clean string for history display
    return trimFloat(num).toString();
  }

  // ----- Input handlers -----
  function inputDigit(digit) {
    if (isError) reset();

    if (overwrite) {
      currentInput = digit === '0' && false ? '0' : digit;
      overwrite = false;
    } else {
      if (currentInput.replace(/[-.]/g, '').length >= MAX_DIGITS) return;
      // Prevent multiple leading zeros like "007"
      if (currentInput === '0') {
        currentInput = digit;
      } else {
        currentInput += digit;
      }
    }
  }

  function inputDecimal() {
    if (isError) reset();

    if (overwrite) {
      currentInput = '0.';
      overwrite = false;
      return;
    }
    if (!currentInput.includes('.')) {
      currentInput += '.';
    }
  }

  function chooseOperator(nextOperator) {
    if (isError) return;

    const inputValue = parseFloat(currentInput);

    if (operator && !overwrite) {
      // Chain calculation: resolve the pending operation first
      const result = compute(previousValue, inputValue, operator);
      if (result === null) return showError();
      previousValue = result;
      currentInput = trimFloat(result).toString();
    } else {
      previousValue = inputValue;
    }

    operator = nextOperator;
    overwrite = true;
  }

  function calculate() {
    if (isError) return;
    if (operator === null || previousValue === null) return; // nothing pending

    const inputValue = parseFloat(currentInput);
    const result = compute(previousValue, inputValue, operator);

    if (result === null) return showError();

    currentInput = trimFloat(result).toString();
    historyEl.textContent = '\u00A0';
    previousValue = null;
    operator = null;
    overwrite = true;
  }

  function compute(a, b, op) {
    let result;
    switch (op) {
      case '+': result = a + b; break;
      case '−': result = a - b; break;
      case '×': result = a * b; break;
      case '÷':
        if (b === 0) return null; // guarded explicitly, never let JS produce Infinity/NaN
        result = a / b;
        break;
      default: return null;
    }
    if (!Number.isFinite(result)) return null;
    return result;
  }

  function trimFloat(num) {
    // Round to 10 significant decimal places to avoid float artifacts like 0.1 + 0.2
    const rounded = Math.round((num + Number.EPSILON) * 1e10) / 1e10;
    return rounded;
  }

  function percent() {
    if (isError) reset();
    const value = parseFloat(currentInput || '0');
    currentInput = trimFloat(value / 100).toString();
    overwrite = true;
  }

  function backspace() {
    if (isError) return reset();
    if (overwrite) return; // nothing typed yet for this entry

    if (currentInput.length <= 1 || (currentInput.length === 2 && currentInput.startsWith('-'))) {
      currentInput = '0';
      overwrite = true;
    } else {
      currentInput = currentInput.slice(0, -1);
    }
  }

  function reset() {
    currentInput = '0';
    previousValue = null;
    operator = null;
    overwrite = true;
    isError = false;
    historyEl.textContent = '\u00A0';
  }

  function showError() {
    isError = true;
    currentInput = 'Cannot divide by zero';
    previousValue = null;
    operator = null;
    overwrite = true;
    render();
  }

  // ----- Event wiring -----
  keys.forEach((key) => {
    key.addEventListener('click', () => {
      handleKey(key);
      render();
    });
  });

  function handleKey(key) {
    const { digit, action } = key.dataset;

    if (digit !== undefined) {
      inputDigit(digit);
      return;
    }

    switch (action) {
      case 'clear': reset(); break;
      case 'delete': backspace(); break;
      case 'percent': percent(); break;
      case 'decimal': inputDecimal(); break;
      case 'add': chooseOperator('+'); break;
      case 'subtract': chooseOperator('−'); break;
      case 'multiply': chooseOperator('×'); break;
      case 'divide': chooseOperator('÷'); break;
      case 'equals': calculate(); break;
    }
  }

  // ----- Keyboard support -----
  const keyMap = {
    '+': 'add',
    '-': 'subtract',
    '*': 'multiply',
    '/': 'divide',
    'Enter': 'equals',
    '=': 'equals',
    'Escape': 'clear',
    'Backspace': 'delete',
    '%': 'percent',
    '.': 'decimal',
  };

  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
      inputDigit(e.key);
      flashKey(`[data-digit="${e.key}"]`);
      render();
      return;
    }

    const action = keyMap[e.key];
    if (action) {
      e.preventDefault();
      handleKey({ dataset: { action } });
      flashKey(`[data-action="${action}"]`);
      render();
    }
  });

  function flashKey(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('is-pressed');
    setTimeout(() => el.classList.remove('is-pressed'), 100);
  }

  // ----- Initial paint -----
  render();
})();
