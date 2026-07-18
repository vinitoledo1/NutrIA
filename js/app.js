// js/app.js

// Lógicas importadas via escopo global (window) no index.html

// Estado global do Web App
const state = {
  foodsDb: [],
  dietPlan: {},
  mealState: {}
};

// Helpers de criptografia para bloqueio e segurança por senha
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return new Uint8Array(hashBuffer);
}

function hexToBytes(hex) {
  const bytes = [];
  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function decryptApiKey(passwordHashBytes) {
  const ciphertextHex = "125837d7f7663e305a37c7285022396e339498c3212d231fb7a41e93e8de7a09364f50f2dd362539181edf32722122216a8dcfe62a";
  const cipherBytes = hexToBytes(ciphertextHex);
  const decryptedBytes = cipherBytes.map((byte, i) => byte ^ passwordHashBytes[i % passwordHashBytes.length]);
  return new TextDecoder().decode(decryptedBytes);
}

// Gerenciador do Lock Screen de Segurança
async function handleUnlock() {
  const passwordInput = document.getElementById('lock-password');
  const errorMsg = document.getElementById('lock-error');
  const lockScreen = document.getElementById('lock-screen');
  
  if (!passwordInput) return;
  const password = passwordInput.value;
  
  try {
    const hashBytes = await sha256(password);
    const hashHex = bytesToHex(hashBytes);
    const expectedHash = "53091996955e6c7e6c7b8e5839584c1601d8aea07b797c6fe2d175a0ddb23d62";
    
    if (hashHex === expectedHash) {
      // Senha correta: Descriptografa a chave da API
      const decryptedKey = decryptApiKey(hashBytes);
      window.GEMINI_API_KEY = decryptedKey;
      sessionStorage.setItem('nutria_decrypted_key', decryptedKey);
      
      // Esconde o painel de bloqueio e inicializa o aplicativo
      if (lockScreen) lockScreen.style.display = 'none';
      
      initAppState();
      initModals();
      initChatLogic();
      initGlobalActions();
      recalculateAndRender();
    } else {
      if (errorMsg) errorMsg.style.display = 'block';
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (err) {
    console.error("Erro na descriptografia:", err);
    alert("Erro interno de segurança do navegador.");
  }
}

// Log de console retro
function addConsoleLog(message, type = 'info') {
  const consoleContainer = document.getElementById('console-logs');
  if (!consoleContainer) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const logLine = document.createElement('div');
  logLine.className = `log-line ${type}`;
  logLine.textContent = `[${timeStr}] ${message}`;
  
  consoleContainer.appendChild(logLine);
  consoleContainer.scrollTop = consoleContainer.scrollHeight;
}

// Inicializa o estado a partir do LocalStorage ou padrões
function initAppState() {
  // 1. Banco de Alimentos
  const savedFoods = localStorage.getItem('nutria_foods');
  if (savedFoods) {
    state.foodsDb = JSON.parse(savedFoods);
  } else {
    state.foodsDb = [...FOODS_DATABASE];
    localStorage.setItem('nutria_foods', JSON.stringify(state.foodsDb));
  }

  // 2. Plano de Dieta
  const savedPlan = localStorage.getItem('nutria_diet_plan');
  if (savedPlan) {
    state.dietPlan = JSON.parse(savedPlan);
    // Se as metas de macro salvas forem diferentes do padrão correto do PDF, força a atualização das metas
    if (!state.dietPlan.targets || 
        state.dietPlan.targets.carb !== DEFAULT_DIET_PLAN.targets.carb ||
        state.dietPlan.targets.prot !== DEFAULT_DIET_PLAN.targets.prot ||
        state.dietPlan.targets.gord !== DEFAULT_DIET_PLAN.targets.gord) {
      state.dietPlan.targets = { ...DEFAULT_DIET_PLAN.targets };
      localStorage.setItem('nutria_diet_plan', JSON.stringify(state.dietPlan));
    }
  } else {
    state.dietPlan = { ...DEFAULT_DIET_PLAN };
    localStorage.setItem('nutria_diet_plan', JSON.stringify(state.dietPlan));
  }

  // 3. Estado Diário das Refeições
  const savedMealState = localStorage.getItem('nutria_meal_state');
  if (savedMealState) {
    state.mealState = JSON.parse(savedMealState);
  } else {
    resetDailyMealState();
  }

  addConsoleLog("SISTEMA INICIALIZADO. BANCO DE DADOS CARREGADO.", "success");
}

// Reseta o estado diário voltando ao plano inicial
function resetDailyMealState() {
  state.dietPlan = JSON.parse(JSON.stringify(DEFAULT_DIET_PLAN));
  localStorage.setItem('nutria_diet_plan', JSON.stringify(state.dietPlan));

  state.mealState = {};
  for (const meal of state.dietPlan.meals) {
    state.mealState[meal.id] = {
      completed: false,
      foods: meal.foods.map(item => ({
        foodId: item.foodId,
        amount: item.amount,          // Meta original do plano
        actualAmount: item.amount     // Consumo real (inicia igual à meta)
      }))
    };
  }
  saveMealState();
}

function saveMealState() {
  localStorage.setItem('nutria_meal_state', JSON.stringify(state.mealState));
}

function saveFoodsDb() {
  localStorage.setItem('nutria_foods', JSON.stringify(state.foodsDb));
}

// Gera a barra de progresso ASCII estilo [======>......]
function getAsciiProgressBar(current, target) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const barLength = 20;
  const filledLength = Math.round((percent / 100) * barLength);
  
  let bar = '';
  for (let i = 0; i < barLength; i++) {
    if (i < filledLength - 1) {
      bar += '=';
    } else if (i === filledLength - 1) {
      bar += '>';
    } else {
      bar += '.';
    }
  }
  return `[${bar}] ${percent}%`;
}

// Atualiza o painel superior (Dashboard KPI)
function updateDashboardUI(summary) {
  const { target, consumed, plannedTotal, remaining } = summary;
  
  // Calorias
  document.getElementById('consumed-kcal').textContent = Math.round(consumed.kcal);
  document.getElementById('target-kcal').textContent = Math.round(target.kcal);
  document.getElementById('progress-kcal').textContent = getAsciiProgressBar(consumed.kcal, target.kcal);
  const balKcal = document.getElementById('balance-kcal');
  balKcal.textContent = Math.round(remaining.kcal);
  balKcal.className = remaining.kcal < 0 ? 'text-error' : '';

  // Carboidratos
  document.getElementById('consumed-carb').textContent = Math.round(consumed.carb);
  document.getElementById('target-carb').textContent = Math.round(target.carb);
  document.getElementById('progress-carb').textContent = getAsciiProgressBar(consumed.carb, target.carb);
  const balCarb = document.getElementById('balance-carb');
  balCarb.textContent = Math.round(remaining.carb);
  balCarb.className = remaining.carb < 0 ? 'text-error' : '';

  // Proteínas
  document.getElementById('consumed-prot').textContent = Math.round(consumed.prot);
  document.getElementById('target-prot').textContent = Math.round(target.prot);
  document.getElementById('progress-prot').textContent = getAsciiProgressBar(consumed.prot, target.prot);
  const balProt = document.getElementById('balance-prot');
  balProt.textContent = Math.round(remaining.prot);
  balProt.className = remaining.prot < 0 ? 'text-error' : '';

  // Gorduras
  document.getElementById('consumed-gord').textContent = Math.round(consumed.gord);
  document.getElementById('target-gord').textContent = Math.round(target.gord);
  document.getElementById('progress-gord').textContent = getAsciiProgressBar(consumed.gord, target.gord);
  const balGord = document.getElementById('balance-gord');
  balGord.textContent = Math.round(remaining.gord);
  balGord.className = remaining.gord < 0 ? 'text-error' : '';
}

// Renderiza a lista de refeições com seus alimentos e botões de desvio
function renderMealsUI(recalculatedTargets) {
  const container = document.getElementById('meals-container');
  if (!container) return;

  // Salva qual input está focado antes de limpar o container para evitar perda de foco durante a digitação
  const activeEl = document.activeElement;
  let focusedMealId = null;
  let focusedFoodId = null;
  if (activeEl && activeEl.classList.contains('food-qty-input')) {
    focusedMealId = activeEl.dataset.mealId;
    focusedFoodId = activeEl.dataset.foodId;
  }

  container.innerHTML = '';

  state.dietPlan.meals.forEach((meal, mealIndex) => {
    const isCompleted = state.mealState[meal.id].completed;
    const currentMealState = state.mealState[meal.id];
    
    // Obtém a meta da refeição (recalculada ou original)
    let mealTarget;
    let isRecalculated = false;
    
    if (isCompleted) {
      // Se concluída, mostra o total que foi consumido de fato
      mealTarget = calculateMealMacros(currentMealState.foods, state.foodsDb, true);
    } else {
      // Se não concluída, mostra a meta recalculada pelo motor
      mealTarget = recalculatedTargets[meal.id];
      isRecalculated = true;
    }

    // Cria o bloco da refeição
    const mealBlock = document.createElement('div');
    mealBlock.className = 'meal-block';
    
    // Header da refeição
    const headerRow = document.createElement('div');
    headerRow.className = 'meal-header-row';
    headerRow.innerHTML = `
      <span class="meal-title-text">${mealIndex + 1}. ${meal.name.toUpperCase()}</span>
      <span class="meal-status-badge ${isCompleted ? 'completed' : ''}">
        ${isCompleted ? 'CONSUMIDA (FECHADA)' : 'ATIVA (ABERTA)'}
      </span>
    `;
    mealBlock.appendChild(headerRow);

    // Meta macro header
    const targetHeader = document.createElement('div');
    targetHeader.style.padding = '4px 6px';
    targetHeader.style.fontSize = '11px';
    targetHeader.style.borderBottom = '1px dotted var(--border-color)';
    targetHeader.style.color = isRecalculated ? 'var(--text-bright)' : 'var(--text-color)';
    targetHeader.innerHTML = `
      <strong>META ${isRecalculated ? 'RECALCULADA' : 'CONSUMIDA'}:</strong> 
      ${mealTarget.kcal} kcal | <span class="text-carb">Carb: ${mealTarget.carb}g</span> | <span class="text-prot">Prot: ${mealTarget.prot}g</span> | <span class="text-gord">Gord: ${mealTarget.gord}g</span>
    `;
    mealBlock.appendChild(targetHeader);

    // Tabela de alimentos (Sem a coluna Qtd Orig)
    const table = document.createElement('table');
    table.className = 'retro-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Alimento</th>
          <th style="width: 100px;">Qtd Real (g)</th>
          <th style="width: 70px;" class="text-carb">Carb</th>
          <th style="width: 70px;" class="text-prot">Prot</th>
          <th style="width: 70px;" class="text-gord">Gord</th>
          <th style="width: 70px;">Kcal</th>
          ${!isCompleted ? '<th style="width: 60px;">Ação</th>' : ''}
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    // Determinar as quantidades a serem exibidas na tabela
    let foodsToRender = [];
    if (isCompleted) {
      // Mostra exatamente o que foi salvo
      foodsToRender = currentMealState.foods;
    } else {
      // Se aberta, calcula a porção recomendada ajustada para bater a meta recalculada
      const currentFoodsList = currentMealState.foods;
      const adjustedPortions = adjustMealPortions(currentFoodsList, mealTarget, state.foodsDb);
      
      foodsToRender = currentFoodsList.map(cf => {
        const adj = adjustedPortions.find(ap => ap.foodId === cf.foodId);
        return {
          foodId: cf.foodId,
          amount: cf.amount, // Original
          actualAmount: adj ? adj.amount : cf.actualAmount, // Atualizada dinamicamente
          isOverride: cf.isOverride // Preserva a flag de ajuste manual do usuário
        };
      });
      
      // Atualiza o estado em memória para persistir as porções recalculadas sugeridas
      state.mealState[meal.id].foods = foodsToRender.map(f => ({
        foodId: f.foodId,
        amount: f.amount,
        actualAmount: f.actualAmount,
        isOverride: f.isOverride
      }));
    }

    // Preenche as linhas da tabela
    foodsToRender.forEach((item) => {
      const food = state.foodsDb.find(f => f.id === item.foodId);
      if (!food) return;

      const macros = calculateFoodMacros(food, item.actualAmount);
      const isDeviation = item.actualAmount !== item.amount;

      // Classifica o macro dominante para colorir o fundo do alimento suavemente
      let bgClass = '';
      const maxVal = Math.max(food.carb, food.prot, food.gord);
      if (maxVal > 0) {
        if (maxVal === food.carb) bgClass = 'bg-food-carb';
        else if (maxVal === food.prot) bgClass = 'bg-food-prot';
        else if (maxVal === food.gord) bgClass = 'bg-food-gord';
      }

      const tr = document.createElement('tr');
      if (isDeviation) tr.className = 'deviation-row';

      tr.innerHTML = `
        <td class="${bgClass}">${food.name} <span style="font-size:9px;color:var(--w-text-gray)">(${food.source})</span></td>
        <td>
          ${isCompleted 
            ? `<span>${item.actualAmount}g</span>` 
            : `<input type="number" class="food-qty-input" data-meal-id="${meal.id}" data-food-id="${item.foodId}" value="${item.actualAmount}" min="0" style="width: 100%;">`
          }
        </td>
        <td class="text-carb">${macros.carb}g</td>
        <td class="text-prot">${macros.prot}g</td>
        <td class="text-gord">${macros.gord}g</td>
        <td>${Math.round(macros.kcal)}</td>
        ${!isCompleted 
          ? `<td><button class="btn btn-warning btn-delete-food" data-meal-id="${meal.id}" data-food-id="${item.foodId}">[X]</button></td>` 
          : ''
        }
      `;
      tbody.appendChild(tr);
    });

    mealBlock.appendChild(table);

    // Botões de ação da refeição
    const actionsRow = document.createElement('div');
    actionsRow.className = 'meal-actions-row';
    
    if (isCompleted) {
      actionsRow.innerHTML = `
        <button class="btn btn-warning btn-reopen" data-meal-id="${meal.id}">[F7_REABRIR_REFEICAO]</button>
      `;
    } else {
      actionsRow.innerHTML = `
        <button class="btn btn-primary btn-add-food-trigger" data-meal-id="${meal.id}">[+ ADICIONAR ALIMENTO]</button>
        <button class="btn btn-success btn-log-meal" data-meal-id="${meal.id}">[F8_CONFIRMAR_CONSUMO]</button>
      `;
    }
    
    mealBlock.appendChild(actionsRow);
    container.appendChild(mealBlock);
  });

  // Restaura o foco para o input ativo após redesenhar a tabela
  if (focusedMealId && focusedFoodId) {
    const inputToFocus = container.querySelector(`.food-qty-input[data-meal-id="${focusedMealId}"][data-food-id="${focusedFoodId}"]`);
    if (inputToFocus) {
      inputToFocus.focus();
      // Move o cursor para o final (ajuda no fluxo de digitação em dispositivos)
      const val = inputToFocus.value;
      inputToFocus.value = '';
      inputToFocus.value = val;
    }
  }

  // Vincula eventos dos inputs de quantidade após renderizar (em tempo real via evento 'input')
  document.querySelectorAll('.food-qty-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const mealId = e.target.dataset.mealId;
      const foodId = e.target.dataset.foodId;
      const newQty = parseFloat(e.target.value) || 0;
      
      const mealFood = state.mealState[mealId].foods.find(f => f.foodId === foodId);
      if (mealFood) {
        mealFood.actualAmount = newQty;
        mealFood.isOverride = true; // Trava o cálculo de portion scaling neste alimento para permitir digitação livre
        saveMealState();
        recalculateAndRender();
        addConsoleLog(`REFEIÇÃO ${mealId.toUpperCase()}: ALTERADA QTD DE ${foodId} PARA ${newQty}g (Ajuste Manual).`, "info");
      }
    });
  });

  // Vincula botões de deletar alimento
  document.querySelectorAll('.btn-delete-food').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mealId = e.target.dataset.mealId;
      const foodId = e.target.dataset.foodId;
      
      state.mealState[mealId].foods = state.mealState[mealId].foods.filter(f => f.foodId !== foodId);
      saveMealState();
      recalculateAndRender();
      addConsoleLog(`REFEIÇÃO ${mealId.toUpperCase()}: REMOVIDO ${foodId}.`, "warn");
    });
  });

  // Vincula botões de confirmação de consumo
  document.querySelectorAll('.btn-log-meal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mealId = e.target.dataset.mealId;
      state.mealState[mealId].completed = true;
      saveMealState();
      recalculateAndRender();
      addConsoleLog(`REFEIÇÃO ${mealId.toUpperCase()}: CONSUMO FECHADO E CONFIRMADO.`, "success");
    });
  });

  // Vincula botões de reabrir refeição
  document.querySelectorAll('.btn-reopen').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mealId = e.target.dataset.mealId;
      state.mealState[mealId].completed = false;
      saveMealState();
      recalculateAndRender();
      addConsoleLog(`REFEIÇÃO ${mealId.toUpperCase()}: ABERTA PARA EDICÃO/RECÁLCULO.`, "warn");
    });
  });

  // Vincula botões para abrir modal de adicionar comida extra
  document.querySelectorAll('.btn-add-food-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mealId = e.target.dataset.mealId;
      openAddFoodModal(mealId);
    });
  });
}

// Executa o recálculo global e atualiza toda a UI
function recalculateAndRender() {
  const result = redistributeRemainingMacros(state.dietPlan, state.mealState, state.foodsDb);
  
  // Imprime alertas no console se houver
  result.alerts.forEach(alert => {
    addConsoleLog(alert, alert.includes("WARN") || alert.includes("EXCESSO") ? "warn" : "success");
  });

  updateDashboardUI(result.dailySummary);
  renderMealsUI(result.targetsPerMeal);
}

// Lógicas de atalhos e combos manuais removidas (substituídas pelo Chat)

// Modal de Novo Alimento Customizado
function initModals() {
  const btnNewFood = document.getElementById('btn-add-custom-food');
  const customModal = document.getElementById('custom-food-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const customForm = document.getElementById('custom-food-form');

  // Abre modal
  if (btnNewFood && customModal) {
    btnNewFood.addEventListener('click', () => {
      customModal.style.display = 'flex';
    });
  }

  // Fecha modal
  const closeModal = () => {
    if (customModal) customModal.style.display = 'none';
    customForm.reset();
  };

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  // Submete formulário
  if (customForm) {
    customForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const newFood = {
        id: "custom_" + document.getElementById('new-food-name').value.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        name: document.getElementById('new-food-name').value,
        kcal: parseFloat(document.getElementById('new-food-kcal').value) || 0,
        carb: parseFloat(document.getElementById('new-food-carb').value) || 0,
        prot: parseFloat(document.getElementById('new-food-prot').value) || 0,
        gord: parseFloat(document.getElementById('new-food-gord').value) || 0,
        fibra: parseFloat(document.getElementById('new-food-fibra').value) || 0,
        sodio: parseFloat(document.getElementById('new-food-sodio').value) || 0,
        source: "CUSTOM",
        state: document.getElementById('new-food-state').value,
        conversion_factor: parseFloat(document.getElementById('new-food-factor').value) || 1.0
      };

      // Evita duplicatas
      if (state.foodsDb.some(f => f.id === newFood.id)) {
        alert("Erro: Alimento com ID idêntico já cadastrado.");
        return;
      }

      state.foodsDb.push(newFood);
      saveFoodsDb();
      closeModal();
      // Banco atualizado
      addConsoleLog(`ALIMENTO REGISTRADO NO BANCO DE DADOS: ${newFood.name.toUpperCase()}`, "success");
    });
  }

  // Modal para Adicionar Alimento à Refeição
  const addFoodModal = document.getElementById('add-food-modal');
  const btnCloseAddFood = document.getElementById('btn-close-add-food-modal');
  const addFoodForm = document.getElementById('add-food-form');

  if (btnCloseAddFood) {
    btnCloseAddFood.addEventListener('click', () => {
      if (addFoodModal) addFoodModal.style.display = 'none';
    });
  }

  if (addFoodForm) {
    addFoodForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const mealId = document.getElementById('add-food-meal-id').value;
      const foodId = document.getElementById('add-food-select').value;
      const amount = parseFloat(document.getElementById('add-food-amount').value) || 100;

      if (!mealId || !foodId) return;

      // Adiciona o alimento ao estado da refeição (meta original = 0, pois é um extra)
      state.mealState[mealId].foods.push({
        foodId,
        amount: 0, 
        actualAmount: amount
      });

      saveMealState();
      if (addFoodModal) addFoodModal.style.display = 'none';
      recalculateAndRender();
      addConsoleLog(`REFEIÇÃO ${mealId.toUpperCase()}: ADICIONADO EXTRA ${foodId} (${amount}g)`, "info");
    });
  }
}

// Abre modal de adicionar comida
function openAddFoodModal(mealId) {
  const addFoodModal = document.getElementById('add-food-modal');
  const mealNameSpan = document.getElementById('add-food-meal-name');
  const mealIdInput = document.getElementById('add-food-meal-id');
  const foodSelect = document.getElementById('add-food-select');

  if (!addFoodModal) return;

  const meal = state.dietPlan.meals.find(m => m.id === mealId);
  mealNameSpan.textContent = meal ? meal.name.toUpperCase() : mealId;
  mealIdInput.value = mealId;

  // Popula o select com os alimentos
  foodSelect.innerHTML = '';
  state.foodsDb.sort((a,b) => a.name.localeCompare(b.name)).forEach(food => {
    foodSelect.innerHTML += `<option value="${food.id}">${food.name} (${food.state})</option>`;
  });

  addFoodModal.style.display = 'flex';
}

// LÓGICAS DO CHAT CONVERSACIONAL E INTEGRAÇÃO OCR
function initChatLogic() {
  const chatInput = document.getElementById('chat-input-text');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatFileInput = document.getElementById('chat-file-input');
  const keyInput = document.getElementById('gemini-key-input');
  const saveKeyBtn = document.getElementById('btn-save-key');

  if (!chatInput || !chatSendBtn) return;

  // Carrega a mensagem inicial do NutrIA baseada em diretrizes esportivas
  window.processChatMessage("", state).then(welcome => {
    window.addChatMessageUI('bot', welcome.text, false, null, "", welcome.suggestions);
  });

  // Manipulador de envio de mensagem
  const handleSend = async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    // 1. Renderiza mensagem do usuário
    window.addChatMessageUI('user', text);
    chatInput.value = '';
    
    // 2. Adiciona balão temporário de carregamento
    window.addChatMessageUI('bot', "🤖 *NutrIA está pensando...*", false);
    const chatMessages = document.getElementById('chat-messages');
    const loadingBubble = chatMessages.lastChild;

    try {
      // 3. Processa resposta do NutrIA (IA) de forma assíncrona via Gemini
      const reply = await window.processChatMessage(text, state);
      
      // Remove balão de carregamento
      loadingBubble.remove();
      
      // 4. Renderiza mensagem final do NutrIA
      window.addChatMessageUI('bot', reply.text, !!reply.action, reply.action, reply.actionLabel, reply.suggestions);
    } catch (err) {
      loadingBubble.remove();
      window.addChatMessageUI('bot', `Erro ao chamar a IA do Gemini: ${err.message}. Certifique-se de que a API Key é válida.`);
    }

    chatInput.focus();
  };

  chatSendBtn.addEventListener('click', handleSend);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  });

  // Manipulador de arquivo de imagem (OCR) integrado no Chat
  if (chatFileInput) {
    chatFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      window.setupChatOcr(file, state, recalculateAndRender);
      chatFileInput.value = ''; // Limpa o input de arquivo
    });
  }

  // Lógica do painel de chaves API
  if (keyInput && saveKeyBtn) {
    let savedKey = localStorage.getItem('nutria_gemini_key');
    if (!savedKey) {
      savedKey = "AQ.Ab8RN6LIpizux2L6cZT_pUuk35lGkeFIdHhIGteQjKyn7kUaFQ";
      localStorage.setItem('nutria_gemini_key', savedKey);
    }
    keyInput.value = savedKey;

    saveKeyBtn.addEventListener('click', () => {
      const key = keyInput.value.trim();
      if (key) {
        localStorage.setItem('nutria_gemini_key', key);
        alert("API Key do Gemini salva com sucesso!");
        
        // Limpa e reseta a conversa inicial
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        window.processChatMessage("", state).then(welcome => {
          window.addChatMessageUI('bot', welcome.text, false, null, "", welcome.suggestions);
        });
      } else {
        localStorage.removeItem('nutria_gemini_key');
        alert("API Key removida do armazenamento local.");
        
        // Reseta conversa
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        window.processChatMessage("", state).then(welcome => {
          window.addChatMessageUI('bot', welcome.text, false, null, "", welcome.suggestions);
        });
      }
    });
  }
}

// Ponte de chamada global para que ações do chat atualizem a UI principal
window.recalculateAndRenderApp = () => {
  recalculateAndRender();
};

// Botoes globais do painel
function initGlobalActions() {
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm("Deseja realmente resetar o dia e voltar ao plano alimentar original?")) {
        resetDailyMealState();
        recalculateAndRender();
        addConsoleLog("PLANO DIÁRIO RESTAURADO PARA O PADRÃO ORIGINAL.", "warn");
        
        // Limpa e reseta chat
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        window.processChatMessage("", state).then(welcome => {
          window.addChatMessageUI('bot', welcome.text, false, null, "", welcome.suggestions);
        });
      }
    });
  }
}

// INICIALIZADOR PRINCIPAL COM LOCK SCREEN DE SEGURANÇA
document.addEventListener('DOMContentLoaded', () => {
  const lockScreen = document.getElementById('lock-screen');
  const passwordInput = document.getElementById('lock-password');
  const btnUnlock = document.getElementById('btn-unlock');
  
  const savedDecryptedKey = sessionStorage.getItem('nutria_decrypted_key');
  if (savedDecryptedKey) {
    window.GEMINI_API_KEY = savedDecryptedKey;
    if (lockScreen) lockScreen.style.display = 'none';
    
    initAppState();
    initModals();
    initChatLogic();
    initGlobalActions();
    recalculateAndRender();
  } else {
    if (passwordInput) {
      passwordInput.focus();
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleUnlock();
      });
    }
    if (btnUnlock) {
      btnUnlock.addEventListener('click', handleUnlock);
    }
  }
});
