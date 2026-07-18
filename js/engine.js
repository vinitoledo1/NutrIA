// js/engine.js

/**
 * Calcula os macronutrientes de um alimento com base na quantidade em gramas.
 * @param {Object} food - O objeto do alimento do banco de dados.
 * @param {number} amount - A quantidade em gramas.
 * @returns {Object} - Macros calculados.
 */
function calculateFoodMacros(food, amount) {
  const factor = amount / 100;
  return {
    kcal: Math.round(food.kcal * factor * 10) / 10,
    carb: Math.round(food.carb * factor * 10) / 10,
    prot: Math.round(food.prot * factor * 10) / 10,
    gord: Math.round(food.gord * factor * 10) / 10,
    fibra: Math.round(food.fibra * factor * 10) / 10,
    sodio: Math.round(food.sodio * factor * 10) / 10,
  };
}

/**
 * Calcula o total de macros de uma refeição.
 * @param {Array} mealFoods - Lista de alimentos na refeição ({ foodId, amount, actualAmount? })
 * @param {Array} foodsDb - Banco de dados de alimentos.
 * @param {boolean} useActual - Se verdadeiro, usa actualAmount se disponível (para desvios consumidos)
 * @returns {Object} - Macros totais da refeição.
 */
function calculateMealMacros(mealFoods, foodsDb, useActual = false) {
  const totals = { kcal: 0, carb: 0, prot: 0, gord: 0, fibra: 0, sodio: 0 };
  
  for (const item of mealFoods) {
    const food = foodsDb.find(f => f.id === item.foodId);
    if (!food) continue;
    
    const qty = useActual && item.actualAmount !== undefined ? item.actualAmount : item.amount;
    const macros = calculateFoodMacros(food, qty);
    
    totals.kcal += macros.kcal;
    totals.carb += macros.carb;
    totals.prot += macros.prot;
    totals.gord += macros.gord;
    totals.fibra += macros.fibra;
    totals.sodio += macros.sodio;
  }
  
  // Arredonda valores finais
  for (const key in totals) {
    totals[key] = Math.round(totals[key] * 10) / 10;
  }
  
  return totals;
}

/**
 * Calcula a equivalência de substituição de um alimento por outro.
 * Se o alimento for fonte primária de proteína, iguala a proteína. Caso contrário, carboidrato.
 * @param {Object} fromFood - Alimento original.
 * @param {Object} toFood - Alimento substituto.
 * @param {number} amount - Quantidade original em gramas.
 * @returns {Object} - { targetAmount: g, macroType: 'carb'|'prot' }
 */
function calculateEquivalentAmount(fromFood, toFood, amount) {
  // Determina o macro principal do alimento de origem para guiar a substituição
  const macroType = fromFood.prot > fromFood.carb ? 'prot' : 'carb';
  
  const fromMacroPerG = fromFood[macroType] / 100;
  const toMacroPerG = toFood[macroType] / 100;
  
  if (toMacroPerG === 0) {
    return { targetAmount: 0, macroType, error: "Alimento substituto não contém o macronutriente principal." };
  }
  
  const originalMacroContent = amount * fromMacroPerG;
  const targetAmount = Math.round((originalMacroContent / toMacroPerG) * 10) / 10;
  
  return { targetAmount, macroType };
}

/**
 * Motor Matemático Principal: Recalcula e redistribui proporcionalmente as metas das refeições restantes
 * aplicando compensações calóricas cruzadas em caso de estouro.
 * 
 * @param {Object} dietPlan - O plano alimentar com refeições e metas diárias.
 * @param {Object} mealState - Estado das refeições (quais foram logadas e os alimentos efetivos consumidos).
 *                             Estrutura: { [mealId]: { completed: boolean, foods: [{ foodId, actualAmount }] } }
 * @param {Array} foodsDb - Banco de dados de alimentos.
 * @returns {Object} - { targetsPerMeal, dailySummary, alerts }
 */
function redistributeRemainingMacros(dietPlan, mealState, foodsDb) {
  const dailyTargets = { ...dietPlan.targets };
  const alerts = [];
  
  // 1. Calcular o total consumido nas refeições concluídas (logadas)
  const totalConsumed = { kcal: 0, carb: 0, prot: 0, gord: 0, fibra: 0, sodio: 0 };
  const completedMealIds = [];
  
  for (const meal of dietPlan.meals) {
    const state = mealState[meal.id];
    if (state && state.completed) {
      completedMealIds.push(meal.id);
      // Calcula macros efetivamente consumidos nesta refeição
      const mealConsumed = calculateMealMacros(state.foods, foodsDb, true);
      totalConsumed.kcal += mealConsumed.kcal;
      totalConsumed.carb += mealConsumed.carb;
      totalConsumed.prot += mealConsumed.prot;
      totalConsumed.gord += mealConsumed.gord;
      totalConsumed.fibra += mealConsumed.fibra;
      totalConsumed.sodio += mealConsumed.sodio;
    }
  }
  
  // 2. Identificar refeições restantes
  const remainingMeals = dietPlan.meals.filter(m => !completedMealIds.includes(m.id));
  
  // Se não restam refeições, as metas diárias finais são o consumo real total
  if (remainingMeals.length === 0) {
    return {
      targetsPerMeal: {},
      dailySummary: {
        target: dailyTargets,
        consumed: totalConsumed,
        remaining: { kcal: 0, carb: 0, prot: 0, gord: 0, fibra: 0, sodio: 0 }
      },
      alerts: ["[SYSTEM: DIETA CONCLUÍDA PARA O DIA DE HOJE]"]
    };
  }
  
  // 3. Calcular macros restantes necessários para bater as metas diárias
  let remP = dailyTargets.prot - totalConsumed.prot;
  let remC = dailyTargets.carb - totalConsumed.carb;
  let remG = dailyTargets.gord - totalConsumed.gord;
  
  // 4. Lógica de compensação em caso de estouros (macros negativos)
  let calorieOverrun = 0;
  
  // A. Excesso de Proteína (Patinho extra, frango extra, etc.)
  if (remP < 0) {
    const extraProtKcal = Math.abs(remP) * 4;
    alerts.push(`[COMPENSAÇÃO: EXCESSO PROTEICO DE ${Math.abs(remP).toFixed(1)}g CONVERTIDO EM REDUÇÃO DE CARBOIDRATOS]`);
    // Desconta dos carboidratos (1g de carbo = 4kcal, igual a proteína, logo 1g por 1g)
    remC += remP; // remP é negativo, então subtrai
    remP = 0; // Proteína restante zera (já bateu)
  }
  
  // B. Excesso de Gordura
  if (remG < 0) {
    const extraFatKcal = Math.abs(remG) * 9;
    const carbEquivalentG = extraFatKcal / 4;
    alerts.push(`[COMPENSAÇÃO: EXCESSO DE GORDURA DE ${Math.abs(remG).toFixed(1)}g ABATIDO NOS CARBOIDRATOS (-${carbEquivalentG.toFixed(1)}g)]`);
    remC -= carbEquivalentG;
    remG = 0; // Gordura restante zera
  }
  
  // C. Excesso de Carboidrato
  if (remC < 0) {
    const extraCarbKcal = Math.abs(remC) * 4;
    const fatEquivalentG = extraCarbKcal / 9;
    alerts.push(`[COMPENSAÇÃO: EXCESSO DE CARBOIDRATOS DE ${Math.abs(remC).toFixed(1)}g ABATIDO NAS GORDURAS (-${fatEquivalentG.toFixed(1)}g)]`);
    remG -= fatEquivalentG;
    remC = 0; // Carboidrato restante zera
  }
  
  // D. Se mesmo após a compensação cruzada, Carboidrato ou Gordura continuarem negativos,
  // significa que houve um estouro geral de calorias.
  if (remG < 0 || remC < 0) {
    const fatDeficit = remG < 0 ? Math.abs(remG) : 0;
    const carbDeficit = remC < 0 ? Math.abs(remC) : 0;
    calorieOverrun = (fatDeficit * 9) + (carbDeficit * 4);
    
    if (remG < 0) remG = 0;
    if (remC < 0) remC = 0;
    
    alerts.push(`[ALERTA: LIMITE CALÓRICO DIÁRIO EXCEDIDO EM +${Math.round(calorieOverrun)} KCAL. AJUSTANDO PRÓXIMAS PARA O MÍNIMO]`);
  }
  
  // 5. Redistribuição proporcional com base no plano original das refeições restantes
  // Precisamos das metas originais agregadas apenas das refeições restantes para achar a proporção de cada uma.
  const baseRemTotals = { prot: 0, carb: 0, gord: 0, fibra: 0, sodio: 0 };
  for (const meal of remainingMeals) {
    const baseMacros = calculateMealMacros(meal.foods, foodsDb, false);
    baseRemTotals.prot += baseMacros.prot;
    baseRemTotals.carb += baseMacros.carb;
    baseRemTotals.gord += baseMacros.gord;
    baseRemTotals.fibra += baseMacros.fibra;
    baseRemTotals.sodio += baseMacros.sodio;
  }
  
  const targetsPerMeal = {};
  
  for (const meal of remainingMeals) {
    const baseMacros = calculateMealMacros(meal.foods, foodsDb, false);
    
    // Proporções originais
    const propP = baseRemTotals.prot > 0 ? baseMacros.prot / baseRemTotals.prot : 1 / remainingMeals.length;
    const propC = baseRemTotals.carb > 0 ? baseMacros.carb / baseRemTotals.carb : 1 / remainingMeals.length;
    const propG = baseRemTotals.gord > 0 ? baseMacros.gord / baseRemTotals.gord : 1 / remainingMeals.length;
    const propFib = baseRemTotals.fibra > 0 ? baseMacros.fibra / baseRemTotals.fibra : 1 / remainingMeals.length;
    const propSod = baseRemTotals.sodio > 0 ? baseMacros.sodio / baseRemTotals.sodio : 1 / remainingMeals.length;
    
    // Metas cruas recalculadas
    let newP = remP * propP;
    let newC = remC * propC;
    let newG = remG * propG;
    
    // Aplicar limites mínimos fisiológicos por refeição para evitar zerar totalmente proteína ou gordura
    // Proteína mínima: 30.8g (0.4g/kg para 77kg) para maximizar a síntese proteica (Schoenfeld & Aragon, 2018)
    const minP = Math.min(baseMacros.prot, 30.8);
    if (newP < minP) {
      newP = minP;
    }
    
    // Gordura mínima: 3g (para saúde hormonal e absorção se a refeição continha gordura original)
    const minG = baseMacros.gord > 0 ? Math.min(baseMacros.gord, 3) : 0;
    if (newG < minG) {
      newG = minG;
    }
    
    // Carboidrato mínimo por refeição
    const minC = baseMacros.carb > 0 ? Math.min(baseMacros.carb, 10) : 0;
    if (newC < minC) {
      newC = minC;
    }
    
    // Calcula kcal estimada para a refeição
    const newKcal = Math.round((newC * 4 + newP * 4 + newG * 9) * 10) / 10;
    
    targetsPerMeal[meal.id] = {
      name: meal.name,
      prot: Math.round(newP * 10) / 10,
      carb: Math.round(newC * 10) / 10,
      gord: Math.round(newG * 10) / 10,
      kcal: newKcal,
      // Fibras e sódio são apenas distribuídos proporcionalmente sem limites fisiológicos estritos
      fibra: Math.round((dailyTargets.fibra - totalConsumed.fibra) * propFib * 10) / 10,
      sodio: Math.round((dailyTargets.sodio - totalConsumed.sodio) * propSod * 10) / 10
    };
    
    // Trata valores de fibra/sódio negativos
    if (targetsPerMeal[meal.id].fibra < 0) targetsPerMeal[meal.id].fibra = 0;
    if (targetsPerMeal[meal.id].sodio < 0) targetsPerMeal[meal.id].sodio = 0;
  }
  
  // 6. Recalcular o consolidado planejado do dia (consumido + novas metas das restantes)
  const plannedDayTotal = { kcal: 0, carb: 0, prot: 0, gord: 0, fibra: 0, sodio: 0 };
  
  // Adiciona o que já consumiu
  for (const k in plannedDayTotal) {
    plannedDayTotal[k] += totalConsumed[k];
  }
  
  // Adiciona as novas metas das refeições que faltam
  for (const mId in targetsPerMeal) {
    plannedDayTotal.prot += targetsPerMeal[mId].prot;
    plannedDayTotal.carb += targetsPerMeal[mId].carb;
    plannedDayTotal.gord += targetsPerMeal[mId].gord;
    plannedDayTotal.kcal += targetsPerMeal[mId].kcal;
    plannedDayTotal.fibra += targetsPerMeal[mId].fibra;
    plannedDayTotal.sodio += targetsPerMeal[mId].sodio;
  }
  
  // Calcula o restante matemático restante (saldo)
  const remainingTotal = {
    kcal: Math.round((dailyTargets.kcal - plannedDayTotal.kcal) * 10) / 10,
    carb: Math.round((dailyTargets.carb - plannedDayTotal.carb) * 10) / 10,
    prot: Math.round((dailyTargets.prot - plannedDayTotal.prot) * 10) / 10,
    gord: Math.round((dailyTargets.gord - plannedDayTotal.gord) * 10) / 10,
    fibra: Math.round((dailyTargets.fibra - plannedDayTotal.fibra) * 10) / 10,
    sodio: Math.round((dailyTargets.sodio - plannedDayTotal.sodio) * 10) / 10
  };
  
  return {
    targetsPerMeal,
    dailySummary: {
      target: dailyTargets,
      consumed: totalConsumed,
      plannedTotal: {
        kcal: Math.round(plannedDayTotal.kcal * 10) / 10,
        carb: Math.round(plannedDayTotal.carb * 10) / 10,
        prot: Math.round(plannedDayTotal.prot * 10) / 10,
        gord: Math.round(plannedDayTotal.gord * 10) / 10,
        fibra: Math.round(plannedDayTotal.fibra * 10) / 10,
        sodio: Math.round(plannedDayTotal.sodio * 10) / 10
      },
      remaining: remainingTotal
    },
    alerts
  };
}

/**
 * Ajusta as porções dos alimentos de uma refeição para bater as novas metas recalculadas.
 * Se a refeição tiver fontes claras e distintas de Carb, Prot e Gord, ajusta-as isoladamente.
 * Caso contrário, ou se os valores calculados forem bizarros, escala todos proporcionalmente por calorias.
 * 
 * @param {Array} mealFoods - Alimentos originais da refeição [{ foodId, amount }]
 * @param {Object} targetMacros - Metas recalculadas para a refeição { carb, prot, gord, kcal }
 * @param {Array} foodsDb - Banco de dados de alimentos
 * @returns {Array} - Nova lista de alimentos com quantidades ajustadas [{ foodId, amount }]
 */
function adjustMealPortions(mealFoods, targetMacros, foodsDb) {
  if (!mealFoods || mealFoods.length === 0) return [];
  
  // Filtra alimentos fixados manualmente pelo usuário (ou extras adicionados com amount = 0) e alimentos dinâmicos (que serão escalados e têm de ter amount > 0)
  const overriddenFoods = mealFoods.filter(f => f.isOverride === true || f.amount === 0);
  const dynamicFoods = mealFoods.filter(f => f.isOverride !== true && f.amount > 0);
  
  // Vetor de resultados final
  const result = [];
  
  // Deduz macros dos alimentos cujos pesos estão fixados
  let targetC = targetMacros.carb;
  let targetP = targetMacros.prot;
  let targetG = targetMacros.gord;
  let targetK = targetMacros.kcal;
  
  overriddenFoods.forEach(item => {
    const food = foodsDb.find(f => f.id === item.foodId);
    if (food) {
      const macros = calculateFoodMacros(food, item.actualAmount);
      targetC -= macros.carb;
      targetP -= macros.prot;
      targetG -= macros.gord;
      targetK -= macros.kcal;
    }
    // Adiciona o fixado no resultado com o mesmo peso atual
    result.push({ foodId: item.foodId, amount: item.actualAmount });
  });
  
  if (targetC < 0) targetC = 0;
  if (targetP < 0) targetP = 0;
  if (targetG < 0) targetG = 0;
  if (targetK < 0) targetK = 0;
  
  // Se não há alimentos dinâmicos restantes a serem ajustados, encerra e retorna
  if (dynamicFoods.length === 0) {
    const origIds = mealFoods.map(m => m.foodId);
    return result.sort((a, b) => origIds.indexOf(a.foodId) - origIds.indexOf(b.foodId));
  }
  
  // Resto de meta para distribuir nos dinâmicos
  const remainingTargets = { kcal: targetK, carb: targetC, prot: targetP, gord: targetG };
  let adjustedDynamic = [];
  
  // Se há apenas 1 alimento dinâmico restante
  if (dynamicFoods.length === 1) {
    const item = dynamicFoods[0];
    const food = foodsDb.find(f => f.id === item.foodId);
    if (food) {
      const maxMacro = food.carb > food.prot ? (food.carb > food.gord ? 'carb' : 'gord') : (food.prot > food.gord ? 'prot' : 'gord');
      const divisor = food[maxMacro] / 100;
      const newAmount = divisor > 0 ? Math.round((remainingTargets[maxMacro] / divisor)) : item.amount;
      adjustedDynamic = [{ foodId: item.foodId, amount: Math.max(1, newAmount) }];
    } else {
      adjustedDynamic = [item];
    }
  } else {
    // Múltiplos dinâmicos - usa lógica de divisão de prato clássico
    const foodDetails = dynamicFoods.map(item => {
      const food = foodsDb.find(f => f.id === item.foodId);
      return {
        item,
        food,
        carbPerG: food ? food.carb / 100 : 0,
        protPerG: food ? food.prot / 100 : 0,
        gordPerG: food ? food.gord / 100 : 0,
        kcalPerG: food ? food.kcal / 100 : 0
      };
    });
    
    let carbFood = null;
    let protFood = null;
    let fatFood = null;
    
    const sortedCarbs = [...foodDetails].sort((a, b) => b.carbPerG - a.carbPerG);
    if (sortedCarbs[0] && sortedCarbs[0].carbPerG > 0.1 && sortedCarbs[0].food.carb > sortedCarbs[0].food.prot) {
      carbFood = sortedCarbs[0];
    }
    
    const sortedProts = [...foodDetails].sort((a, b) => b.protPerG - a.protPerG);
    if (sortedProts[0] && sortedProts[0].protPerG > 0.1 && sortedProts[0].food.prot > sortedProts[0].food.carb) {
      protFood = sortedProts[0];
    }
    
    const sortedFats = [...foodDetails].sort((a, b) => b.gordPerG - a.gordPerG);
    if (sortedFats[0] && sortedFats[0].gordPerG > 0.1 && sortedFats[0].food.gord > (sortedFats[0].food.carb + sortedFats[0].food.prot)) {
      fatFood = sortedFats[0];
    }
    
    if (carbFood && protFood && carbFood.food.id !== protFood.food.id) {
      const adjustedFoods = [];
      let targetC_dyn = remainingTargets.carb;
      let targetP_dyn = remainingTargets.prot;
      let targetG_dyn = remainingTargets.gord;
      
      const mainIds = [carbFood.food.id, protFood.food.id];
      if (fatFood) mainIds.push(fatFood.food.id);
      
      for (const fd of foodDetails) {
        if (!mainIds.includes(fd.food.id)) {
          const origAmt = fd.item.amount;
          targetC_dyn -= origAmt * fd.carbPerG;
          targetP_dyn -= origAmt * fd.protPerG;
          targetG_dyn -= origAmt * fd.gordPerG;
          adjustedFoods.push({ foodId: fd.item.foodId, amount: fd.item.amount });
        }
      }
      
      if (targetC_dyn < 0) targetC_dyn = 0;
      if (targetP_dyn < 0) targetP_dyn = 0;
      if (targetG_dyn < 0) targetG_dyn = 0;
      
      // Resolve usando Regra de Cramer para atingir Carboidrato e Proteína simultaneamente
      const Cx = carbFood.carbPerG;
      const Px = carbFood.protPerG;
      const Cy = protFood.carbPerG;
      const Py = protFood.protPerG;
      
      const det = Cx * Py - Cy * Px;
      
      let newCarbAmt = 0;
      let newProtAmt = 0;
      
      if (Math.abs(det) > 0.0001) {
        newCarbAmt = (targetC_dyn * Py - targetP_dyn * Cy) / det;
        newProtAmt = (Cx * targetP_dyn - Px * targetC_dyn) / det;
      } else {
        // Fallback sequencial se determinador for muito próximo de zero
        newProtAmt = targetP_dyn / Py;
        newCarbAmt = (targetC_dyn - newProtAmt * Cy) / Cx;
      }
      
      if (newCarbAmt < 0) newCarbAmt = 0;
      if (newProtAmt < 0) newProtAmt = 0;
      
      let newFatAmt = 0;
      if (fatFood) {
        const fatFromCarb = newCarbAmt * carbFood.gordPerG;
        const fatFromProt = newProtAmt * protFood.gordPerG;
        newFatAmt = (targetG_dyn - fatFromCarb - fatFromProt) / fatFood.gordPerG;
        if (newFatAmt < 0) newFatAmt = 0;
      }
      
      const maxCarbOrig = carbFood.item.amount;
      const maxProtOrig = protFood.item.amount;
      
      if (
        newCarbAmt > maxCarbOrig * 3.0 || newCarbAmt < maxCarbOrig * 0.1 ||
        newProtAmt > maxProtOrig * 3.0 || newProtAmt < maxProtOrig * 0.1 ||
        (fatFood && (newFatAmt > fatFood.item.amount * 4.0 || newFatAmt < 0))
      ) {
        // Fallback para uniforme
      } else {
        adjustedFoods.push({ foodId: carbFood.food.id, amount: Math.round(newCarbAmt) });
        adjustedFoods.push({ foodId: protFood.food.id, amount: Math.round(newProtAmt) });
        if (fatFood) {
          adjustedFoods.push({ foodId: fatFood.food.id, amount: Math.round(newFatAmt) });
        }
        adjustedDynamic = adjustedFoods;
      }
    }
    
    // Fallback uniforme por calorias para os dinâmicos
    if (adjustedDynamic.length === 0) {
      let originalKcal = 0;
      for (const fd of foodDetails) {
        originalKcal += fd.item.amount * fd.kcalPerG;
      }
      const scale = originalKcal > 0 ? remainingTargets.kcal / originalKcal : 1;
      
      adjustedDynamic = dynamicFoods.map(item => {
        const food = foodsDb.find(f => f.id === item.foodId);
        if (!food) return { foodId: item.foodId, amount: item.amount };
        const newAmt = Math.round(item.amount * scale);
        return {
          foodId: item.foodId,
          amount: Math.max(1, newAmt)
        };
      });
    }
  }
  
  // Une dinâmicos com fixados
  adjustedDynamic.forEach(item => {
    result.push(item);
  });
  
  // Ordena de volta
  const origIds = mealFoods.map(m => m.foodId);
  return result.sort((a, b) => origIds.indexOf(a.foodId) - origIds.indexOf(b.foodId));
}

// Exposição global para o protocolo file://
window.calculateFoodMacros = calculateFoodMacros;
window.calculateMealMacros = calculateMealMacros;
window.calculateEquivalentAmount = calculateEquivalentAmount;
window.redistributeRemainingMacros = redistributeRemainingMacros;
window.adjustMealPortions = adjustMealPortions;

