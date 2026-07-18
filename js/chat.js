// js/chat.js

// Estado interno do Chat
const chatState = {
  activeState: null, // 'WAITING_OCR_INJECTION'
  tempOcrFood: null  // Guarda alimento extraído do OCR temporariamente
};

/**
 * Normaliza strings
 */
function normalizeText(text) {
  return text.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

/**
 * Mapeia texto para chaves de refeição conhecidas
 */
function parseMeal(text) {
  const norm = normalizeText(text);
  if (norm.includes("cafe") || norm.includes("manha")) return "cafe";
  if (norm.includes("pre") || norm.includes("antes")) return "pre";
  if (norm.includes("pos") || norm.includes("depois")) return "pos";
  if (norm.includes("normal") || norm.includes("janta") || norm.includes("ceia") || norm.includes("noite")) return "normal";
  return null;
}

/**
 * Processa a mensagem do usuário via API do Gemini
 * 
 * @param {string} userMessage - Mensagem do usuário.
 * @param {Object} appState - O estado do aplicativo.
 * @returns {Promise<Object>} - Resposta formatada { text, action, actionLabel, suggestions }
 */
async function processChatMessage(userMessage, appState) {
  // Se não foi digitada nenhuma mensagem, retorna a mensagem de boas-vindas inicial (sem chamar a API)
  if (!userMessage) {
    return {
      text: "Olá, Vinícius! Eu sou o **NutrIA**, seu assistente de dieta por Inteligência Artificial.\n\n" +
            "Você pode conversar de forma livre comigo, ex:\n" +
            "* *\"Vou comer macarrão com patinho moído no pós treino, quanto preciso pesar?\"*\n" +
            "* *\"Trocar arroz por banana no pré-treino\"*\n" +
            "* *\"Preciso bater mais proteína no meu dia, o que eu como no café da manhã?\"*\n\n" +
            "Pressione o ícone da câmera 📷 para fazer upload de tabelas nutricionais via OCR!"
    };
  }

  const apiKey = window.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Aplicativo bloqueado. Insira a senha correta.");
  }

  // Prepara o contexto dos alimentos e refeições atuais para passar para a IA
  const foodsContext = appState.foodsDb.map(f => ({
    id: f.id,
    name: f.name,
    macrosPer100g: { kcal: f.kcal, carb: f.carb, prot: f.prot, gord: f.gord, fibra: f.fibra },
    state: f.state,
    factor: f.conversion_factor
  }));

  const mealsContext = appState.dietPlan.meals.map(m => {
    const mState = appState.mealState[m.id];
    return {
      id: m.id,
      name: m.name,
      completed: mState.completed,
      foods: mState.foods.map(f => {
        const detail = appState.foodsDb.find(dbF => dbF.id === f.foodId);
        return {
          id: f.foodId,
          name: detail ? detail.name : f.foodId,
          originalAmount: f.amount,
          currentAmount: f.actualAmount
        };
      })
    };
  });

  // Calcula o estado atual consolidado do dia
  // Importante para a IA saber o quanto de carb, prot e gord já foi comido ou resta
  const recalc = window.redistributeRemainingMacros(appState.dietPlan, appState.mealState, appState.foodsDb);
  const summary = recalc.dailySummary;

  // Elabora o Prompt do Sistema completo com o contexto esportivo
  const systemPrompt = `Você é o NutrIA, uma Inteligência Artificial Sênior e Especialista em Nutrição Esportiva voltada à Hipertrofia.
Seu cliente e usuário do app é Vinícius Ferraz de Toledo (23 anos, 1.77m, 77kg, treino de musculação de alta intensidade 6x na semana).
A meta diária fixa dele é: 2986 kcal | Carboidrato: 408.6g | Proteína: 200.2g | Gordura: 58g.
Piso proteico recomendado por refeição: 30.8g (0.4g/kg) com base em Schoenfeld & Aragon (2018) para maximizar a síntese proteica.

DADOS DE ALIMENTOS DISPONÍVEIS NA BASE:
${JSON.stringify(foodsContext, null, 2)}

ESTADO ATUAL DAS REFEIÇÕES DO PLANO DO DIA:
${JSON.stringify(mealsContext, null, 2)}

SUMÁRIO DIÁRIO DE CONSUMO:
- Alvo diário: ${summary.target.kcal}kcal | C: ${summary.target.carb}g | P: ${summary.target.prot}g | G: ${summary.target.gord}g
- Já consumido hoje: ${summary.consumed.kcal}kcal | C: ${summary.consumed.carb}g | P: ${summary.consumed.prot}g | G: ${summary.consumed.gord}g
- Faltam bater: ${summary.remaining.kcal}kcal | C: ${summary.remaining.carb}g | P: ${summary.remaining.prot}g | G: ${summary.remaining.gord}g

SUAS INSTRUÇÕES DE RESPOSTA E COMANDO:
1. Responda em português, de forma extremamente curta, objetiva e direta. Vá direto ao ponto descrevendo os pesos e quantidades em apenas 1 ou 2 frases curtas. Não use rodeios nem saudações longas.
2. Quando o usuário pedir para fazer uma substituição de alimento ou refeição (ex: "vou comer macarrão com patinho no pós treino" ou "trocar arroz por banana no pré-treino"), você DEVE calcular matematicamente os pesos exatos necessários dos novos alimentos para bater a meta de macros daquela refeição.
   - IMPORTANTE: Não insira fontes de gordura ou quaisquer alimentos da refeição anterior que o usuário NÃO tenha citado nominalmente. Se ele citou apenas "macarrão com patinho", o novo prato deve ter APENAS macarrão e patinho. O azeite original deve ser removido! Os desvios de gordura resultantes serão redistribuídos pelo sistema.
3. Sempre que o usuário pedir substituição ou perguntar "quanto preciso pesar" de determinados alimentos em uma refeição, você DEVE obrigatoriamente anexar na última linha da sua resposta o comando estruturado no formato:
   [COMMAND: {"type": "substitute_meal", "mealId": "pos", "foods": [{"foodId": "macarrao_trigo_cozido", "actualAmount": 445}, {"foodId": "patinho_cozido", "actualAmount": 130}]}]
   *(Neste COMMAND de exemplo, note que o azeite da refeição original foi removido por não ter sido citado!)*
   Ou, se for uma troca de alimento individual simples:
   [COMMAND: {"type": "substitute_food", "mealId": "pre", "oldFoodId": "arroz_branco_cozido", "newFoodId": "banana_nanica", "newAmount": 408}]
4. Se o usuário apenas fizer perguntas informativas ou gerais, responda normalmente sem incluir o bloco [COMMAND].
5. NUNCA invente IDs de alimentos. Use estritamente os IDs que constam no JSON de alimentos disponíveis na base fornecida acima!`;
  try {
    // Chamada cliente à API do Gemini (usando o modelo de produção gemini-3.5-flash)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nMENSAGEM DO USUÁRIO: ${userMessage}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Código HTTP ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;

    // Parser do bloco de comandos [COMMAND: ...] de forma extremamente robusta
    let action = null;
    let actionLabel = "";
    let cleanText = responseText;

    const startIdx = responseText.indexOf("[COMMAND:");
    if (startIdx !== -1) {
      const endIdx = responseText.lastIndexOf("]");
      if (endIdx > startIdx) {
        const commandStr = responseText.substring(startIdx + 9, endIdx).trim();
        cleanText = (responseText.substring(0, startIdx) + responseText.substring(endIdx + 1)).trim();
        try {
          const commandObj = JSON.parse(commandStr);
          
          if (commandObj.type === "substitute_meal") {
            actionLabel = "Substituir refeição e ajustar o resto da dieta do dia?";
            action = () => {
              appState.mealState[commandObj.mealId].foods = commandObj.foods.map(f => ({
                foodId: f.foodId,
                amount: f.actualAmount, // Define a meta original igual ao valor da substituição inteligente da IA
                actualAmount: f.actualAmount
              }));
              localStorage.setItem('nutria_meal_state', JSON.stringify(appState.mealState));
            };
          } else if (commandObj.type === "substitute_food") {
            actionLabel = "Substituir alimento e ajustar o resto da dieta do dia?";
            action = () => {
              appState.mealState[commandObj.mealId].foods = appState.mealState[commandObj.mealId].foods.map(item => {
                if (item.foodId === commandObj.oldFoodId) {
                  return { foodId: commandObj.newFoodId, amount: commandObj.newAmount, actualAmount: commandObj.newAmount };
                }
                return item;
              });
              localStorage.setItem('nutria_meal_state', JSON.stringify(appState.mealState));
            };
          }
        } catch (e) {
          console.error("Erro ao analisar comando da IA:", e, "Texto extraído:", commandStr);
        }
      }
    }

    // Limpa quaisquer caracteres residuais (como }} ou ] de fechamento) que a IA possa ter alucinado após o comando
    cleanText = cleanText.replace(/[\s\}\]]+$/, "").trim();

    return {
      text: cleanText,
      action,
      actionLabel
    };

  } catch (error) {
    console.error("Erro na API do Gemini:", error);
    throw new Error(`Falha ao conectar com o Gemini API (${error.message}). Verifique sua chave ou internet.`);
  }
}

/**
 * Controla a exibição das mensagens no painel do chat
 */
function addChatMessageUI(sender, text, isAction = false, actionCallback = null, actionLabel = "", suggestions = []) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender === 'user' ? 'msg-user' : 'msg-bot'}`;
  
  const senderLabel = sender === 'user' ? '> VOCÊ' : '🤖 NutrIA';
  
  // Trata quebras de linha para HTML e formatação básica de markdown para negrito
  let formattedText = text.replace(/\n/g, '<br>')
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  msgDiv.innerHTML = `
    <div class="msg-sender">${senderLabel}</div>
    <div class="msg-text">${formattedText}</div>
  `;

  // Se a mensagem contiver uma ação (botão de aplicar)
  if (isAction && actionCallback && actionLabel) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn chat-action-btn btn-block';
    actionBtn.textContent = actionLabel;
    actionBtn.addEventListener('click', () => {
      actionCallback();
      actionBtn.disabled = true;
      actionBtn.textContent = "[ SUGESTÃO DA IA APLICADA COM SUCESSO ]";
      actionBtn.style.color = "var(--w-text-gray)";
      actionBtn.style.backgroundColor = "var(--w-bg-window)";
      actionBtn.style.borderColor = "var(--w-border-shadow)";
      
      // Executa recálculo e renderização da aplicação principal
      if (window.recalculateAndRenderApp) {
        window.recalculateAndRenderApp();
      }
    });
    msgDiv.appendChild(actionBtn);
  }

  // Se houver botões de sugestão rápida
  if (suggestions && suggestions.length > 0) {
    const sugContainer = document.createElement('div');
    sugContainer.className = 'chat-suggestions';
    suggestions.forEach(sug => {
      const btn = document.createElement('button');
      btn.className = 'btn chat-sug-btn';
      btn.textContent = sug.text;
      btn.addEventListener('click', () => {
        const inputField = document.getElementById('chat-input-text');
        if (inputField) {
          inputField.value = sug.input;
          inputField.focus();
        }
      });
      sugContainer.appendChild(btn);
    });
    msgDiv.appendChild(sugContainer);
  }

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Inicia escuta para eventos de upload OCR do chat
function setupChatOcr(file, appState, recalculateAndRenderCallback) {
  addChatMessageUI('bot', `[IMAGEM RECEBIDA: ${file.name.toUpperCase()}]`);
  
  // Mostra indicador visual de progresso no chat
  const chatMessages = document.getElementById('chat-messages');
  const progressDiv = document.createElement('div');
  progressDiv.className = 'chat-msg msg-bot';
  progressDiv.innerHTML = `
    <div class="msg-sender">🤖 NutrIA</div>
    <div class="msg-text">
      <div class="ocr-progress-bar" style="margin-top:4px;">
        <span class="ocr-progress-text" id="chat-ocr-progress-text">ESCANEAR: 0%</span>
        <div class="ocr-progress-fill" id="chat-ocr-progress-fill" style="width: 0%;"></div>
      </div>
    </div>
  `;
  chatMessages.appendChild(progressDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Roda OCR
  window.performOcrAnalysis(file, (statusText, percent) => {
    const textSpan = document.getElementById('chat-ocr-progress-text');
    const fillDiv = document.getElementById('chat-ocr-progress-fill');
    if (textSpan) textSpan.textContent = `${statusText} (${percent}%)`;
    if (fillDiv) fillDiv.style.width = `${percent}%`;
  }).then(extractedMacros => {
    // Remove o bloco de progresso
    progressDiv.remove();

    // Cria ID único temporário
    const tempId = `temp_ocr_${Date.now()}`;
    chatState.tempOcrFood = {
      id: tempId,
      name: extractedMacros.name,
      kcal: extractedMacros.kcal,
      carb: extractedMacros.carb,
      prot: extractedMacros.prot,
      gord: extractedMacros.gord,
      fibra: 0,
      sodio: 0,
      source: "OCR",
      state: "cozido",
      conversion_factor: 1.0
    };

    chatState.activeState = 'WAITING_OCR_INJECTION';

    const responseText = `🤖 **Tabela Nutricional Escaneada via Visão!**\n\n` +
                         `Alimento Extraído: **${extractedMacros.name}**\n` +
                         `* Kcal: **${extractedMacros.kcal}**\n` +
                         `* Carboidratos: **${extractedMacros.carb}g**\n` +
                         `* Proteínas: **${extractedMacros.prot}g**\n` +
                         `* Gorduras: **${extractedMacros.gord}g**\n` +
                         `*(Valores por 100g de alimento)*\n\n` +
                         `Qual porção em gramas você consumiu e em qual refeição quer adicionar?`;

    addChatMessageUI('bot', responseText, false, null, "", [
      { text: "café da manhã (150g)", input: "injetar 150g no café" },
      { text: "pré-treino (150g)", input: "injetar 150g no pré-treino" },
      { text: "pós-treino (150g)", input: "injetar 150g no pós-treino" },
      { text: "refeição normal (150g)", input: "injetar 150g no normal" }
    ]);
  });
}

// Exposição global para o protocolo file://
window.processChatMessage = processChatMessage;
window.addChatMessageUI = addChatMessageUI;
window.setupChatOcr = setupChatOcr;
