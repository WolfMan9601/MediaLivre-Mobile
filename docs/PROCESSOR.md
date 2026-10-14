# Processador MediaLivre

A API de desenvolvimento está na porta 3000. Para produção, utilize um endpoint HTTPS estável num servidor que tenha Python, yt-dlp, mutagen, FFmpeg e ffprobe. O APK não deve apontar para um hostname temporário do Sandbox. `Dockerfile.processor` prepara uma imagem Linux do servidor; esta imagem não foi implantada automaticamente num host permanente.

## Contrato

`GET /api/media/health` retorna disponibilidade, versão, formatos, limite de bytes e expiração. `POST /api/media/jobs` recebe JSON `{ "url": "https://…", "options": { "format": "original", "quality": "best", "cover": true } }`. Formatos são `original`, `mp4`, `mp3`; qualidades são `best`, `1080`, `720`, `480`. A resposta 202 inclui `id`, `token`, estado e progresso.

`GET /api/media/jobs/{id}` consulta estado. `GET /api/media/jobs/{id}/file` transmite o ficheiro quando pronto. `DELETE /api/media/jobs/{id}` cancela/remove. As três rotas exigem `Authorization: Bearer {token}`; token errado é tratado como trabalho inexistente. Estados: `queued`, `processing`, `ready`, `failed`, `cancelled`. Erros retornam JSON com `error`.

## Privacidade e operação

Os ficheiros são temporários no diretório do sistema, com expiração de 30 minutos. O app solicita remoção após concluir ou cancelar. Não se conservam URLs/tokens na base de dados; não foi escolhido armazenamento de objetos. O mapa de trabalhos é em memória: reiniciar o servidor invalida o estado. Não use múltiplas réplicas sem afinidade de sessão ou uma futura fila partilhada.

Existem limites de 250 MB por ficheiro, 10 minutos por trabalho, duas execuções simultâneas, 30 trabalhos registados e 10 pedidos por endereço de ligação/15 minutos. A origem por detrás de um proxy pode representar vários clientes; não confie em cabeçalhos `X-Forwarded-For` enviados livremente. O gateway deve limitar pedidos e armazenamento, e permitir streaming de ficheiros grandes. Não se promete processamento em segundo plano no telemóvel.

URLs iniciais exigem HTTPS na porta 443, sem credenciais. DNS e endereços privados/reservados são rejeitados. O worker volta a validar pedidos e sockets para impedir acesso privado após redirects/rebinding e recusa protocolos de streaming não nativos. Conversões FFmpeg usam ficheiros locais, sem HTTP como protocolo de entrada. Para defesa adicional, restrinja a saída de rede do container a destinos públicos. Esta API aceita criação anónima de trabalhos; tokens protegem apenas acesso/cancelamento ao trabalho e não substituem controlo de abuso no gateway.

## Container

```bash
docker build -f Dockerfile.processor -t medialivre-processor .
docker run --rm -p 3000:3000 medialivre-processor
```

Termine TLS num reverse proxy e configure o URL HTTPS final nos Ajustes ou em `EXPO_PUBLIC_PROCESSOR_URL` durante o build. `GET /api/media/health` deve responder 200 antes de anunciar o servidor. Não publique credenciais de serviço ou a DSN da base em ficheiros públicos. Atualize regularmente o yt-dlp e confirme as licenças da build FFmpeg distribuída.
