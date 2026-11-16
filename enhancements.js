// Case-Battle-inspired case probabilities and Upgrader-style price-based upgrades.
// Uses public price data and a transparent expected-return target; it does not imitate hidden server code.

function caseOdds(pool, cost) {
  const eligible = pool.map(item => ({ item, price: caseMarketPrice(item) }))
    .filter(row => row.price >= cost * .15);
  if (!eligible.length) return [];

  const pricesByItem = eligible.map(row => row.price);
  const target = Math.max(Math.min(...pricesByItem), Math.min(Math.max(...pricesByItem), cost * .92));
  const expectedValue = lambda => {
    let weightTotal = 0, valueTotal = 0;
    for (const price of pricesByItem) {
      const weight = Math.exp(Math.max(-60, Math.min(60, -lambda * price / cost)));
      weightTotal += weight;
      valueTotal += weight * price;
    }
    return valueTotal / weightTotal;
  };

  let low = -40, high = 40;
  for (let n = 0; n < 56; n++) {
    const middle = (low + high) / 2;
    if (expectedValue(middle) > target) low = middle;
    else high = middle;
  }

  const lambda = (low + high) / 2;
  const weights = pricesByItem.map(price => Math.max(1e-12,
    Math.exp(Math.max(-60, Math.min(60, -lambda * price / cost)))));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return eligible.map((row, index) => ({ item: row.item, chance: weights[index] / total * 100 }));
}

weightedDrop = function (pool, cost) {
  const odds = caseOdds(pool, cost);
  if (!odds.length) return null;
  let roll = Math.random() * 100;
  for (const row of odds) {
    roll -= row.chance;
    if (roll < 0) return withWear(row.item);
  }
  return withWear(odds[odds.length - 1].item);
};

const renderCaseLootBeforeOdds = renderCaseLoot;
renderCaseLoot = function () {
  renderCaseLootBeforeOdds();
  if (!current) return;
  const odds = caseOdds(ensureCaseDrops(current), current.cost);
  const cards = [...document.querySelectorAll('#loot .skin')];
  cards.forEach((card, index) => {
    const chance = odds[index]?.chance;
    if (chance == null) return;
    const label = chance < .01 ? '<0,01%' :
      `${chance < 1 ? chance.toFixed(2) : chance.toFixed(1).replace('.', ',')}%`;
    card.insertAdjacentHTML('afterbegin', `<span class="drop-chance">${label}</span>`);
  });
  const status = document.getElementById('loot-status');
  if (status) status.textContent = 'RTP ориентир 92% · шансы показаны на карточках';
};

const centeredWheelStyle = document.createElement('style');
centeredWheelStyle.textContent = `
  #wheel:before {
    background: conic-gradient(from var(--gray-offset, 180deg), var(--lime) 0 var(--chance), #687382 var(--chance) 100%) !important;
    transform: none !important;
    transition: background .45s ease !important;
  }
  #wheel-note { display: none !important; }
  #wheel.result-success > div b { color: var(--lime); font-size: 24px; }
  #wheel.result-fail > div b { color: #c3cad4; font-size: 24px; }
  #wheel.resetting > i { transition: transform .45s ease !important; }
  .drop-chance {
    position: absolute !important; z-index: 4 !important; top: 7px; right: 7px; padding: 3px 5px;
    border: 1px solid #ffffff20; border-radius: 6px; background: #090d14df;
    color: #d6e0eb; font-size: 9px; font-weight: 850; line-height: 1.1;
  }
  .skin:after {
    content: ""; position: absolute; z-index: 0; inset: 0;
    background: url("/assets/downgrade-logo.png") center 48% / 72% no-repeat;
    filter: grayscale(1); opacity: .2; pointer-events: none;
  }
  .skin > * { position: relative; z-index: 1; }
  .brand span img { content: url("/assets/downgrade-logo.png"); }
`;
document.head.appendChild(centeredWheelStyle);

const setChanceBeforeCenteredWheel = setChance;
setChance = function () {
  setChanceBeforeCenteredWheel();
  const wheel = document.getElementById('wheel');
  const value = Number.parseFloat(document.getElementById('chance').textContent) || 0;
  // A conic gradient starts at the top; this offset centers its grey segment there.
  wheel.style.setProperty('--gray-offset', `${(100 - value) * 1.8}deg`);
};

document.getElementById('upgrade').onclick = () => {
  const source = inventory[fromIndex], target = catalogSkins[toIndex];
  const sourcePrice = source && (prices[marketName(source)]?.price ?? source.price);
  const targetPrice = target && (prices[marketName(target)]?.price ?? target.price);
  const chance = upgradeChance(sourcePrice, targetPrice);
  if (!source || !target || chance <= 0) return;

  const wheel = document.getElementById('wheel');
  const button = document.getElementById('upgrade');
  const missArc = (100 - chance) * 3.6;
  const landing = Math.random() * 360;
  const success = landing >= missArc / 2 && landing <= 360 - missArc / 2;
  button.disabled = true;
  lastWheelAngle = Math.ceil((lastWheelAngle + 2160) / 360) * 360 + landing;
  wheel.style.setProperty('--arrow-angle', `${lastWheelAngle}deg`);
  wheel.classList.remove('result-success', 'result-fail');
  wheel.classList.add('spinning');

  setTimeout(() => {
    wheel.classList.remove('spinning');
    if (success) {
      inventory.splice(fromIndex, 1);
      inventory.push({ ...target, wear: 'Field-Tested', float: .2, price: targetPrice });
      wheel.classList.add('result-success');
    } else {
      inventory.splice(fromIndex, 1);
      wheel.classList.add('result-fail');
    }
    fromIndex = toIndex = null;
    priceFilters.chance = null;
    renderInventory();
    renderUpgrade();

    const result = document.getElementById('chance');
    const label = wheel.querySelector('small');
    result.textContent = success ? 'УСПЕШНО' : 'ПРОВАЛ';
    label.textContent = success ? 'АПГРЕЙД ПРОШЁЛ' : 'АПГРЕЙД НЕ ПРОШЁЛ';
    button.disabled = true;
    // Return the pointer to 12 o'clock after the result has been read.
    setTimeout(() => {
      wheel.classList.add('resetting');
      wheel.style.setProperty('--arrow-angle', '0deg');
      lastWheelAngle = 0;
      setTimeout(() => wheel.classList.remove('resetting'), 500);
      wheel.classList.remove('result-success', 'result-fail');
      label.textContent = 'ШАНС АПГРЕЙДА';
      setChance();
    }, 2600);
  }, 7100);
};

startOpen = function () {
  if (caseOpening || !current || balance < current.cost)
    return toast(caseOpening ? 'Кейс уже открывается' : 'Не хватает виртуальных рублей');
  if (current.type === 'winter') {
    document.getElementById('open-message').textContent = 'Выбери один сугроб — внутри зимний скин';
    return;
  }
  const pool = ensureCaseDrops(current);
  if (caseExpansionPending.has(current.id) || !pool.length) return toast('Подбираю цены и предметы для кейса');
  const winner = weightedDrop(pool, current.cost);
  if (!winner) return toast('Нет предметов с загруженной ценой выше 15% цены кейса');

  caseOpening = true;
  balance -= current.cost;
  document.getElementById('balance').textContent = balance.toLocaleString('ru-RU');
  opened++;
  const strip = document.getElementById('strip'), area = document.getElementById('opening');
  const win = document.getElementById('win'), openButton = document.querySelector('.detail-actions .btn');
  const resultIndex = 34, items = Array.from({ length: 44 }, (_, index) =>
    index === resultIndex ? winner : withWear(pool[Math.floor(Math.random() * pool.length)]));
  strip.innerHTML = items.map(item => {
    const image = itemImg(item);
    return `<div class="strip-card">${image ? `<img src="${image}" alt="${item.name}">` : weaponArt(item.kind)}<b>${item.name}</b></div>`;
  }).join('');
  win.classList.remove('show');
  win.innerHTML = '';
  area.classList.remove('finished', 'spin');
  area.classList.add('show');
  strip.style.transition = 'none';
  strip.style.transform = 'translateX(0)';
  void area.offsetWidth;
  if (openButton) openButton.disabled = true;
  document.getElementById('open-message').textContent = 'Крутится…';
  requestAnimationFrame(() => {
    const card = strip.children[resultIndex];
    const distance = card.offsetLeft + card.offsetWidth / 2 - area.clientWidth / 2;
    strip.style.transition = 'transform 10.4s cubic-bezier(.28,.18,.18,1)';
    strip.style.transform = `translateX(-${distance}px)`;
    area.classList.add('spin');
  });
  setTimeout(() => {
    caseOpening = false;
    lastCaseDrop = winner;
    inventory.push(winner);
    renderCaseResult(winner);
    renderInventory();
    updatePrices([winner]);
    if (openButton) openButton.disabled = false;
    toast('Скин добавлен в инвентарь');
  }, 10650);
};

// Assign the provided 8x5 contact sheet: 5 winter covers, then all 35 custom cases.
const caseAvatarSources = new Map([
  ...winter.map((item, index) => [item.id, `/assets/cases/case-${String(index + 1).padStart(2, '0')}.webp`]),
  ...custom.map((item, index) => [item.id, `/assets/cases/case-${String(index + 6).padStart(2, '0')}.webp`])
]);
const casePicBeforeProvidedAssets = casePic;
casePic = function (item) {
  const source = caseAvatarSources.get(item.id);
  if (source) return `<img src="${source}" alt="${item.name}" loading="lazy">`;
  return casePicBeforeProvidedAssets(item);
};
renderCases();


// Navigation for the visual refresh and its mobile drawer.
const navBeforeVisualRefresh = nav;
nav = function (page) {
  document.getElementById('side-menu')?.classList.remove('open');
  document.getElementById('menu-shade')?.classList.remove('open');
  document.getElementById('menu-toggle')?.setAttribute('aria-expanded', 'false');
  navBeforeVisualRefresh(page);
};
const menuToggle = document.getElementById('menu-toggle');
const menuShade = document.getElementById('menu-shade');
const menuClose = document.getElementById('menu-close');
const toggleMenu = open => {
  document.getElementById('side-menu')?.classList.toggle('open', open);
  menuShade?.classList.toggle('open', open);
  menuToggle?.setAttribute('aria-expanded', String(open));
};
menuToggle?.addEventListener('click', () => toggleMenu(!document.getElementById('side-menu').classList.contains('open')));
menuShade?.addEventListener('click', () => toggleMenu(false));
menuClose?.addEventListener('click', () => toggleMenu(false));
const casePosterFiles = new Map([
  ['w0', 1], ['w1', 23], ['w2', 22], ['w3', 24], ['w4', 25],
  ['c0', 2], ['c1', 3], ['c2', 4], ['c3', 5], ['c4', 6],
  ['c5', 7], ['c6', 8], ['c7', 9], ['c8', 10], ['c9', 11],
  ['c10', 12], ['c11', 13], ['c12', 14], ['c13', 15], ['c14', 16],
  ['c15', 17], ['c16', 18], ['c17', 19], ['c18', 20], ['c19', 21],
  ['c20', 26], ['c21', 27], ['c22', 28], ['c23', 29], ['c24', 30],
  ['c25', 31], ['c26', 32], ['c27', 33], ['c28', 34], ['c29', 35],
  ['c30', 36], ['c31', 37], ['c32', 38], ['c33', 39], ['c34', 40]
]);
const renderCasesWithPosterCards = renderCases;
renderCases = function () {
  const query = document.getElementById('search').value.trim().toLocaleLowerCase('ru-RU');
  const sections = [['Зимние кейсы', 'winter'], ['Оригинальные кейсы CS2', 'official'], ['Кастомные кейсы Downgrade', 'custom']];
  document.getElementById('case-sections').innerHTML = sections.map(([title, type]) => {
    const group = cases.filter(item => item.type === type && item.name.toLocaleLowerCase('ru-RU').includes(query));
    if (!group.length) return '';
    const cards = group.map(item => {
      const poster = casePosterFiles.get(item.id);
      if (!poster) return `<article class="case-card" style="--glow:${item.color}" onclick="openCasePage('${item.id}')"><div class="case-top"><span>CS2</span><span>✦</span></div><div class="case-art">${casePic(item)}</div><div class="case-name">${item.name}</div><div class="case-foot"><span>Открытие кейса</span><span class="cost">${item.cost.toLocaleString('ru-RU')} ₽</span></div></article>`;
      const label = item.type === 'winter' ? 'Зимняя серия' : 'Downgrade';
      const sublabel = item.type === 'winter' ? 'Особый выбор' : 'Открытие кейса';
      return `<article class="case-card poster-card" style="--glow:${item.color}" onclick="openCasePage('${item.id}')"><img class="case-poster" src="/assets/case-cards/poster-${String(poster).padStart(2, '0')}.webp" alt="" loading="lazy"><div class="poster-caption"><strong>${item.name}</strong><div><span>${sublabel}</span><b>${item.cost.toLocaleString('ru-RU')} ₽</b></div></div></article>`;
    }).join('');
    return `<div class="section-title"><h2>${title}</h2><span class="rule"></span><small>${type === 'winter' ? '❄ лимитированная серия' : ''}</small></div><div class="cases">${cards}</div>`;
  }).join('');
};
renderCases();
// Keep the upgrade catalog anchored when selection state re-renders its cards.
const renderUpgradeBeforeScrollRestore = renderUpgrade;
function restoreUpgradeViewport(pageX, pageY) {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.scrollTo(pageX, pageY);
  root.style.scrollBehavior = previousBehavior;
}
renderUpgrade = function (loadPrices = true) {
  const pageY = window.scrollY;
  const pageX = window.scrollX;
  const fromGrid = document.getElementById('from-list');
  const toGrid = document.getElementById('to-list');
  const fromPosition = fromGrid ? [fromGrid.scrollTop, fromGrid.scrollLeft] : null;
  const toPosition = toGrid ? [toGrid.scrollTop, toGrid.scrollLeft] : null;
  renderUpgradeBeforeScrollRestore(loadPrices);
  const restore = (element, position) => {
    if (!element || !position) return;
    element.scrollTop = position[0];
    element.scrollLeft = position[1];
  };
  restore(fromGrid, fromPosition);
  restore(toGrid, toPosition);
  const restoreViewport = () => {
    restoreUpgradeViewport(pageX, pageY);
    restore(document.getElementById('from-list'), fromPosition);
    restore(document.getElementById('to-list'), toPosition);
  };
  restoreViewport();
  requestAnimationFrame(() => {
    restoreViewport();
    requestAnimationFrame(restoreViewport);
  });
};
let upgradePickPointerY = null;
document.addEventListener('pointerdown', event => {
  if (event.target.closest('#page-upgrade .pick')) upgradePickPointerY = window.scrollY;
}, true);
document.addEventListener('click', event => {
  if (!event.target.closest('#page-upgrade .pick')) return;
  const pageY = upgradePickPointerY ?? window.scrollY;
  upgradePickPointerY = null;
  const restoreViewport = () => restoreUpgradeViewport(window.scrollX, pageY);
  requestAnimationFrame(() => {
    restoreViewport();
    requestAnimationFrame(restoreViewport);
  });
}, true);
