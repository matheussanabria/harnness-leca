# Domínio 06: Acesso Remoto e Segurança Local
## Harness Leca — Especificação de Requisitos de Software

---

## 1. Visão do Domínio
O **Domínio de Acesso Remoto e Segurança Local** possibilita que o desenvolvedor opere a suíte do Harness a partir de dispositivos móveis (smartphones ou tablets) conectados à rede local (Wi-Fi), garantindo controle de acesso seguro e proteção contra comandos maliciosos.

---

## 2. Requisitos Funcionais (RF)

- **RF-06.1 (Modo Remoto CLI):** O comando `npm run remote` deve iniciar o servidor ouvindo em todas as interfaces de rede locais (`0.0.0.0`) e detectar automaticamente o IP local da máquina na rede Wi-Fi.
- **RF-06.2 (Geração de PIN Temporário):** A cada inicialização no modo remoto, o sistema deve gerar um PIN numérico aleatório de 6 dígitos.
- **RF-06.3 (Geração de QR Code no Terminal):** O terminal deve renderizar um QR Code ASCII contendo a URL de conexão direta já parametrizada com o PIN de segurança (`http://<IP-LOCAL>:4321/?pin=<PIN>`).
- **RF-06.4 (Autenticação e Sessão no Dispositivo Móvel):** Requisições externas à máquina local devem obrigatoriamente fornecer o PIN válido via query string ou cabeçalho HTTP; após autenticado, um token de sessão de curta duração é mantido no cliente.
- **RF-06.5 (Barreira de Proteção de Comandos Arriscados):** O sistema deve bloquear ou exigir confirmação explícita de dois fatores locais para comandos que alterem arquivos do sistema operacional fora do escopo do projeto.

---

## 3. Regras de Negócio (RN)

- **RN-06.1 (Bloqueio sem PIN em Redes Públicas):** Nenhuma requisição originada de endereço IP diferente de `127.0.0.1` ou `localhost` pode acessar dados de projetos sem apresentação do PIN ativo.
- **RN-06.2 (Renovação de PIN):** O PIN expira e é invalidado quando o processo do servidor é encerrado ou reiniciado.
- **RN-06.3 (Rate Limiting de Tentativas de PIN):** Mais de 5 tentativas consecutivas de PIN incorreto a partir de um mesmo IP devem bloquear temporariamente novas tentativas por 15 minutos.
- **RN-06.4 (Sandboxing de Caminhos de Arquivo):** O servidor deve validar que qualquer leitura ou escrita de arquivo esteja contida na raiz do repositório, impedindo ataques de Path Traversal (`../`).

---

## 4. Requisitos Não Funcionais (RNF)

- **RNF-06.1 (Facilidade de Pareamento):** O escaneamento da câmera do smartphone sobre o QR Code no terminal deve levar o usuário à interface conectada em menos de 3 segundos.
- **RNF-06.2 (Criptografia e Isolamento):** O tráfego na rede local não deve enviar credenciais externas ou chaves mestras.

---

## 5. Casos de Uso Principais

### UC-07: Acesso Mobile via Terminal QR Code
1. O desenvolvedor no computador executa `npm run remote`.
2. O terminal exibe a URL `http://192.168.1.9:4321/?pin=613450` e o QR Code.
3. O desenvolvedor aponta a câmera do celular para o QR Code.
4. O navegador do celular abre a interface com o PIN injetado e autenticação bem-sucedida.
5. O desenvolvedor pode acompanhar os testes e chats dos agentes da sala ou cama via celular.
