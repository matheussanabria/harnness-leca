# EP-20.01: Notas de desenvolvimento

## Implementado

- Em telas de até 768px, a área de código aberta ocupa a viewport inteira em vez de permanecer oculta.
- A barra do editor oferece um retorno explícito ao Studio; ela reutiliza a alternância existente, incluindo o guard de alterações não salvas.
- Os controles de voltar, recarregar e salvar têm alvo de toque mínimo de 44 pixels.
- A área do explorador fica limitada a uma fração da viewport e o editor preserva rolagem horizontal para linhas longas.

## Decisões

- O editor de `textarea` com destaque sobreposto foi mantido para evitar uma dependência nova e preservar o comportamento já testado.
- Nenhum endpoint foi alterado: limite de tamanho, bloqueio de segredos, confinamento de caminhos e fingerprint otimista continuam no serviço existente.
- A apresentação desktop continua sendo a terceira coluna redimensionável.

## Validação pendente

- Conferir visualmente os breakpoints de 320px, 375px e 768px antes de marcar a história como concluída.
