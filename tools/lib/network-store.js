// @ts-check
// Estado/constantes compartilhados de network.

// Redes privadas RFC 1918 e Tailscale
const PRIVATE_IPV4_REGEX = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;
const TUNNEL_DOMAINS_REGEX = /(\.trycloudflare\.com|\.localtunnel\.me|\.ngrok-free\.app|\.ngrok\.io)$/i;

module.exports = { PRIVATE_IPV4_REGEX, TUNNEL_DOMAINS_REGEX };
