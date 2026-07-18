// js/ocr.js

/**
 * Simula a extração de dados via OCR de uma imagem de tabela nutricional.
 * Em um cenário real, integraria com a API do Google Cloud Vision, Tesseract.js ou OpenAI Vision.
 * 
 * @param {File} file - O arquivo de imagem enviado pelo usuário.
 * @param {Function} progressCallback - Callback para atualizar a barra de progresso (recebe text, percent).
 * @returns {Promise<Object>} - Os macronutrientes extraídos ajustados para 100g.
 */
function performOcrAnalysis(file, progressCallback) {
  return new Promise((resolve) => {
    let progress = 0;
    const steps = [
      { text: "INICIALIZANDO SCANNER DE VISÃO COMPUTAÇÃO...", limit: 15 },
      { text: "NORMALIZANDO IMAGEM E REDUZINDO RUÍDO...", limit: 40 },
      { text: "LOCALIZANDO GRADE DE NUTRIENTES (OCR)...", limit: 70 },
      { text: "EXTRAINDO MACRONUTRIENTES E VALOR ENERGÉTICO...", limit: 95 },
      { text: "ANÁLISE E PARSING CONCLUÍDOS COM SUCESSO!", limit: 100 }
    ];

    let currentStepIndex = 0;

    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      
      if (progress >= steps[currentStepIndex].limit) {
        progress = steps[currentStepIndex].limit;
        currentStepIndex++;
      }

      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Simular extração de macros plausível de um produto industrializado (ex: Whey ou Barra de Proteína)
        // Se o nome do arquivo contiver pistas, podemos usar, senão geramos algo realista.
        const fileNameLower = file.name.toLowerCase();
        let mockedResult = {
          name: "PRODUTO INDUSTRIALIZADO (OCR)",
          kcal: 380,
          carb: 12.5,
          prot: 70.0,
          gord: 5.5,
          fibra: 1.0,
          sodio: 280.0
        };

        if (fileNameLower.includes("barrinha") || fileNameLower.includes("barra")) {
          mockedResult = {
            name: "BARRINHA DE PROTEÍNA (OCR)",
            kcal: 395,
            carb: 35.0,
            prot: 30.0,
            gord: 12.0,
            fibra: 6.5,
            sodio: 120.0
          };
        } else if (fileNameLower.includes("iogurte") || fileNameLower.includes("grego")) {
          mockedResult = {
            name: "IOGURTE GREGO DESNATADO (OCR)",
            kcal: 58,
            carb: 4.8,
            prot: 9.6,
            gord: 0.0,
            fibra: 0.0,
            sodio: 45.0
          };
        } else if (fileNameLower.includes("pasta") || fileNameLower.includes("amendoim")) {
          mockedResult = {
            name: "PASTA DE AMENDOIM INTEGRAL (OCR)",
            kcal: 588,
            carb: 18.0,
            prot: 26.0,
            gord: 48.0,
            fibra: 6.0,
            sodio: 0.0
          };
        }

        progressCallback(steps[steps.length - 1].text, 100);
        setTimeout(() => resolve(mockedResult), 300);
      } else {
        progressCallback(steps[Math.min(currentStepIndex, steps.length - 1)].text, progress);
      }
    }, 120);
  });
}

// Exposição global para o protocolo file://
window.performOcrAnalysis = performOcrAnalysis;
