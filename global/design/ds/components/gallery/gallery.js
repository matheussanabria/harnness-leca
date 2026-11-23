// Um componente só: mode="slider" para categorias, marcas e veículos; mode="coverflow" para depoimentos.
// O card é o children (render prop em React, ng-template no Angular), então a galeria não conhece o conteúdo.
// Props: title, align (esquerda, centro, direita), visible (slider 2-5, coverflow 3 ou 5) e mode.
// No slider aparecem N itens inteiros mais 20% do próximo; no coverflow com 5 itens os dois do fundo ficam mais transparentes.
// CategoryCard e BrandCard são um card só: prop mode image ou logo.
