// @ts-check
// Tela do 57 Multimarcas no monitor (mixin de MonitorScreenRenderer).

export const officeScreen57Methods = {
  render57Multimarcas(ctx, w, h) {
    const startY = 108;

    // Header da 57 Multimarcas (Vermelho marcante)
    const navGrad = ctx.createLinearGradient(0, startY, 0, startY + 90);
    navGrad.addColorStop(0, "#d92027");
    navGrad.addColorStop(1, "#b3141b");
    ctx.fillStyle = navGrad;
    ctx.fillRect(0, startY, w, 90);

    // Logotipo 57 MULTIMARCAS
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 36px 'Impact', sans-serif";
    ctx.fillText("57", 60, startY + 58);
    ctx.font = "bold 24px -apple-system, sans-serif";
    ctx.fillText("MULTIMARCAS", 115, startY + 48);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("VEÍCULOS SELECIONADOS & BLINDADOS", 115, startY + 68);

    // Menu da Loja
    const menuItems = ["ESTOQUE", "BLINDADOS", "VENDER MEU CARRO", "FINANCIAMENTO", "QUEM SOMOS", "CONTATO"];
    ctx.font = "bold 16px sans-serif";
    let mx = 700;
    for (const item of menuItems) {
      ctx.fillStyle = item === "ESTOQUE" ? "#ffffff" : "rgba(255,255,255,0.75)";
      ctx.fillText(item, mx, startY + 55);
      if (item === "ESTOQUE") {
        ctx.fillRect(mx, startY + 64, ctx.measureText(item).width, 3);
      }
      mx += ctx.measureText(item).width + 36;
    }

    // Botão WhatsApp VIP
    ctx.fillStyle = "#25d366";
    ctx.beginPath();
    ctx.roundRect(w - 260, startY + 22, 200, 46, 23);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Fale com um Consultor", w - 245, startY + 51);

    // Barra de Busca e Filtros Rápidos
    const filterY = startY + 110;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(40, filterY, w - 80, 80);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.strokeRect(40, filterY, w - 80, 80);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("Encontre o seu próximo seminovo premium:", 65, filterY + 48);

    const filterChips = ["Todas as Marcas ⌄", "Preço até R$ 250k ⌄", "Ano 2022+ ⌄", "Automático ⌄", "Blindagem III-A ⌄"];
    let cx = 520;
    for (const chip of filterChips) {
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(cx, filterY + 22, 200, 40, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(56,189,248,0.3)";
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "14px sans-serif";
      ctx.fillText(chip, cx + 16, filterY + 47);
      cx += 215;
    }

    // Grid de Veículos em Destaque
    const gridY = filterY + 110;
    const cars = [
      {
        title: "BMW 320i M Sport 2.0 Turbo",
        year: "2024 / 2024",
        km: "8.500 km",
        price: "R$ 339.900",
        tag: "NOVO NO ESTOQUE",
        tagColor: "#10b981",
        colorBg: "#1e293b",
        carColor: "#0284c7"
      },
      {
        title: "Porsche Macan GTS 2.9 V6",
        year: "2023 / 2023",
        km: "14.200 km",
        price: "R$ 589.000",
        tag: "BLINDADO III-A",
        tagColor: "#f59e0b",
        colorBg: "#1e293b",
        carColor: "#dc2626"
      },
      {
        title: "Toyota Hilux SRX 2.8 4x4 Diesel",
        year: "2024 / 2024",
        km: "12.000 km",
        price: "R$ 319.900",
        tag: "ÚNICO DONO",
        tagColor: "#3b82f6",
        colorBg: "#1e293b",
        carColor: "#ffffff"
      },
      {
        title: "Mercedes-Benz C300 AMG Line",
        year: "2023 / 2023",
        km: "19.800 km",
        price: "R$ 398.900",
        tag: "OPORTUNIDADE",
        tagColor: "#a855f7",
        colorBg: "#1e293b",
        carColor: "#475569"
      }
    ];

    const cardW = (w - 160) / 4;
    const cardH = 430;

    cars.forEach((c, i) => {
      const cardX = 40 + i * (cardW + 26);

      // Card Container
      ctx.fillStyle = c.colorBg;
      ctx.beginPath();
      ctx.roundRect(cardX, gridY, cardW, cardH, 14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.stroke();

      // Foto do Veículo (Representação elegante com gradiente)
      const photoH = 210;
      const pGrad = ctx.createLinearGradient(cardX, gridY, cardX, gridY + photoH);
      pGrad.addColorStop(0, "#0f172a");
      pGrad.addColorStop(1, "#1e293b");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.roundRect(cardX, gridY, cardW, photoH, [14, 14, 0, 0]);
      ctx.fill();

      // Silhueta do carro em destaque
      ctx.fillStyle = c.carColor;
      ctx.beginPath();
      ctx.roundRect(cardX + 30, gridY + 85, cardW - 60, 65, 8);
      ctx.fill();
      // Cabine do carro
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.roundRect(cardX + 70, gridY + 60, cardW - 150, 35, 6);
      ctx.fill();
      // Rodas
      ctx.fillStyle = "#000000";
      ctx.beginPath(); ctx.arc(cardX + 75, gridY + 150, 22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cardX + cardW - 75, gridY + 150, 22, 0, Math.PI * 2); ctx.fill();

      // Tag / Badge
      ctx.fillStyle = c.tagColor;
      ctx.beginPath();
      ctx.roundRect(cardX + 16, gridY + 16, 140, 26, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(c.tag, cardX + 26, gridY + 34);

      // Informações do Veículo
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(c.title, cardX + 20, gridY + photoH + 34);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Ano: ${c.year}  ·  Km: ${c.km}`, cardX + 20, gridY + photoH + 62);

      // Preço de Destaque
      ctx.fillStyle = "#38bdf8";
      ctx.font = "900 28px sans-serif";
      ctx.fillText(c.price, cardX + 20, gridY + photoH + 115);

      // Botão Ver Detalhes
      ctx.fillStyle = "#d92027";
      ctx.beginPath();
      ctx.roundRect(cardX + 20, gridY + cardH - 56, cardW - 40, 42, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ver Detalhes do Veículo", cardX + cardW / 2, gridY + cardH - 30);
      ctx.textAlign = "left";
    });

    // Terminal / HUD do Agente no Rodapé da Tela
    this.renderEmbeddedTerminal(ctx, w, h);
  },
};
