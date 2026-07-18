// js/database.js

// Banco de dados base de alimentos (Valores por 100g)
window.FOODS_DATABASE = [
  {
    id: "arroz_branco_cozido",
    name: "Arroz Branco Cozido",
    kcal: 128.3,
    carb: 28.0,
    prot: 2.57,
    gord: 0.0,
    fibra: 1.14,
    sodio: 1.14,
    source: "TACO",
    state: "cozido",
    raw_equivalent_id: "arroz_branco_cru",
    conversion_factor: 2.5 // 100g cru -> 250g cozido (multiplicador)
  },
  {
    id: "arroz_branco_cru",
    name: "Arroz Branco Cru",
    kcal: 350.0,
    carb: 78.0,
    prot: 7.0,
    gord: 0.3,
    fibra: 1.6,
    sodio: 0.0,
    source: "TACO",
    state: "cru",
    conversion_factor: 0.4 // 100g cozido -> 40g cru
  },
  {
    id: "peito_frango_cozido",
    name: "Peito de Frango Cozido/Grelhado",
    kcal: 108.0,
    carb: 0.0,
    prot: 23.3,
    gord: 2.0,
    fibra: 0.0,
    sodio: 480.7,
    source: "PDF/Dieta",
    state: "cozido",
    raw_equivalent_id: "peito_frango_cru",
    conversion_factor: 0.7 // 100g cru -> 70g cozido
  },
  {
    id: "peito_frango_cru",
    name: "Peito de Frango Cru",
    kcal: 119.0,
    carb: 0.0,
    prot: 21.5,
    gord: 3.0,
    fibra: 0.0,
    sodio: 50.0,
    source: "TACO",
    state: "cru",
    conversion_factor: 1.43 // 100g cozido -> 143g cru
  },
  {
    id: "patinho_cozido",
    name: "Carne Moída (Patinho) Cozido",
    kcal: 219.0,
    carb: 0.0,
    prot: 35.9,
    gord: 7.3,
    fibra: 0.0,
    sodio: 60.0,
    source: "TBCA",
    state: "cozido",
    raw_equivalent_id: "patinho_cru",
    conversion_factor: 0.75
  },
  {
    id: "patinho_cru",
    name: "Carne (Patinho) Cru",
    kcal: 133.0,
    carb: 0.0,
    prot: 21.7,
    gord: 4.6,
    fibra: 0.0,
    sodio: 55.0,
    source: "TBCA",
    state: "cru",
    conversion_factor: 1.33
  },
  {
    id: "feijao_carioca_cozido",
    name: "Feijão Carioca Cozido",
    kcal: 76.0,
    carb: 14.0,
    prot: 4.8,
    gord: 0.5,
    fibra: 8.5,
    sodio: 2.0,
    source: "TACO",
    state: "cozido",
    raw_equivalent_id: "feijao_carioca_cru",
    conversion_factor: 2.5
  },
  {
    id: "feijao_carioca_cru",
    name: "Feijão Carioca Cru",
    kcal: 329.0,
    carb: 61.2,
    prot: 20.0,
    gord: 1.3,
    fibra: 15.2,
    sodio: 4.0,
    source: "TACO",
    state: "cru",
    conversion_factor: 0.4
  },
  {
    id: "ovo_inteiro_cozido",
    name: "Ovo de Galinha Inteiro Cozido",
    kcal: 155.0,
    carb: 0.6,
    prot: 13.0,
    gord: 10.6,
    fibra: 0.0,
    sodio: 124.0,
    source: "TACO",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "whey_max_titanium",
    name: "100% Whey Max Titanium Baunilha",
    kcal: 402.2,
    carb: 15.6,
    prot: 68.9,
    gord: 6.7,
    fibra: 0.0,
    sodio: 293.3,
    source: "PDF/Dieta",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "banana_nanica",
    name: "Banana Nanica",
    kcal: 92.0,
    carb: 24.0,
    prot: 1.5,
    gord: 0.0,
    fibra: 2.0,
    sodio: 0.0,
    source: "PDF/Dieta",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "tapioca_terrinha",
    name: "Tapioca da Terrinha",
    kcal: 242.0,
    carb: 60.0,
    prot: 0.0,
    gord: 0.0,
    fibra: 0.0,
    sodio: 0.0,
    source: "PDF/Dieta",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "requeijao_light_vigor",
    name: "Requeijão Cremoso Light VIGOR",
    kcal: 180.0,
    carb: 3.3,
    prot: 10.0,
    gord: 13.3,
    fibra: 0.0,
    sodio: 530.0,
    source: "PDF/Dieta",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "leite_desnatado",
    name: "Leite Desnatado",
    kcal: 30.5,
    carb: 4.5,
    prot: 3.0,
    gord: 0.0,
    fibra: 0.0,
    sodio: 65.0,
    source: "PDF/Dieta",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "azeite_oliva_extra_virgem",
    name: "Azeite de Oliva Extra Virgem",
    kcal: 885.0,
    carb: 0.0,
    prot: 0.0,
    gord: 100.0,
    fibra: 0.0,
    sodio: 0.0,
    source: "TACO",
    state: "cozido",
    conversion_factor: 1.0
  },
  {
    id: "macarrao_trigo_cozido",
    name: "Macarrão de Trigo Cozido",
    kcal: 141.0,
    carb: 28.3,
    prot: 5.8,
    gord: 0.4,
    fibra: 1.8,
    sodio: 1.0,
    source: "TACO",
    state: "cozido",
    raw_equivalent_id: "macarrao_trigo_cru",
    conversion_factor: 2.5
  },
  {
    id: "macarrao_trigo_cru",
    name: "Macarrão de Trigo Cru",
    kcal: 371.0,
    carb: 74.9,
    prot: 12.5,
    gord: 1.3,
    fibra: 2.9,
    sodio: 0.0,
    source: "TACO",
    state: "cru",
    conversion_factor: 0.4
  }
].filter(f => f.state !== "cru");

// Mapeamento de atalhos rápidos para substituições equivalentes
// Agrupados por Carboidratos e Proteínas
window.SUBSTITUTES_SHORTCUTS = {
  carbs: [
    { fromId: "arroz_branco_cozido", toId: "macarrao_trigo_cozido", name: "Arroz Cozido ➔ Macarrão Cozido" },
    { fromId: "arroz_branco_cozido", toId: "tapioca_terrinha", name: "Arroz Cozido ➔ Tapioca" },
    { fromId: "arroz_branco_cozido", toId: "banana_nanica", name: "Arroz Cozido ➔ Banana Nanica" },
    { fromId: "macarrao_trigo_cozido", toId: "arroz_branco_cozido", name: "Macarrão Cozido ➔ Arroz Cozido" }
  ],
  proteins: [
    { fromId: "peito_frango_cozido", toId: "patinho_cozido", name: "Peito Frango ➔ Patinho Moído" },
    { fromId: "peito_frango_cozido", toId: "ovo_inteiro_cozido", name: "Peito Frango ➔ Ovo Inteiro" },
    { fromId: "patinho_cozido", toId: "peito_frango_cozido", name: "Patinho Moído ➔ Peito Frango" }
  ]
};

// Plano alimentar padrão inicial de Vinícius Ferraz de Toledo
window.DEFAULT_DIET_PLAN = {
  profile: {
    name: "Vinícius Ferraz de Toledo",
    age: 23,
    height: 1.77,
    weight: 77.0,
    focus: "Hipertrofia (Musculação 6x/semana)",
    date: "01/06/2025"
  },
  targets: {
    kcal: 2986,
    carb: 408.6,
    prot: 200.2,
    gord: 58,
    fibra: 15,
    sodio: 3080
  },
  meals: [
    {
      id: "cafe",
      name: "Café da Manhã",
      foods: [
        { foodId: "whey_max_titanium", amount: 45 },
        { foodId: "banana_nanica", amount: 200 },
        { foodId: "tapioca_terrinha", amount: 50 },
        { foodId: "requeijao_light_vigor", amount: 30 },
        { foodId: "leite_desnatado", amount: 200 }
      ]
    },
    {
      id: "pre",
      name: "Pré-Treino",
      foods: [
        { foodId: "arroz_branco_cozido", amount: 350 },
        { foodId: "peito_frango_cozido", amount: 150 }
      ]
    },
    {
      id: "pos",
      name: "Pós-Treino",
      foods: [
        { foodId: "arroz_branco_cozido", amount: 450 },
        { foodId: "peito_frango_cozido", amount: 200 },
        { foodId: "azeite_oliva_extra_virgem", amount: 20 }
      ]
    },
    {
      id: "normal",
      name: "Refeição Normal (Janta/Ceia)",
      foods: [
        { foodId: "arroz_branco_cozido", amount: 320 },
        { foodId: "peito_frango_cozido", amount: 200 },
        { foodId: "azeite_oliva_extra_virgem", amount: 20 }
      ]
    }
  ]
};
