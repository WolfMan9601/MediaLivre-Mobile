# Validação da versão 0.1.0

Verificações efetuadas em 14 de outubro de 2026. Esta evidência diz respeito ao código e aos fluxos do servidor; **não existe ainda APK nem execução verificada num dispositivo Android**.

| Superfície | Evidência |
| --- | --- |
| TypeScript | `pnpm check` passou, com diagnósticos de projeto registados e erros corrigidos. |
| Vitest | `pnpm test`: 44 testes passaram; 1 teste OAuth opcional ficou skipped. Inclui contratos HTTP, destinos privados, histórico, MIME e mocks das APIs de ficheiros Android. |
| Python | 5 regressões passaram em `python3 -m unittest discover -s tests -p 'test_worker_*.py'`: HTTPS, DNS privado, redirects de downgrade e sockets/portas. |
| Backend | `pnpm build` gerou a API Express com esbuild. |
| Android JavaScript | `expo export --platform android` passou, com bundle Hermes e assets. Isto não é um APK nem um build Java/Kotlin. |
| Integração real | Um vídeo sintético próprio com imagem azul e tom de teste foi servido por HTTPS público temporário e processado pela API real. Original: 40975 bytes, MPEG-4/AAC; MP4 convertido: 47825 bytes, H.264/AAC; MP3: 74121 bytes, codec MP3. Foram confirmados tamanho, ficheiro, autorização, rejeição de token inválido e remoção final. |
| Runtime | Metro 8081 e API 3000 responderam; Preview e health da API foram verificados por HTTPS público. São origens temporárias de desenvolvimento, não um servidor de produção. |
| Revisão independente | Agente apenas de leitura identificou e foi corrigida a reserva concorrente, HTTPS/redirects, MIME real Android, cancelamento durante criação e serialização de endpoint temporário. Foram reexecutados os checks afetados. |
| Config e privacidade | `extra.apiBaseUrl` utiliza apenas `EXPO_PUBLIC_PROCESSOR_URL`, inicialmente vazio; os perfis APK/AAB limpam `EXPO_PUBLIC_API_BASE_URL`. A cópia pública e o export foram verificados contra valores protegidos disponíveis, sem correspondências. O histórico não retém URL de origem nem token de job. |

## Gaps mantidos explícitos

Os testes nativos usam mocks conformes aos contratos instalados do Expo, não um dispositivo. SAF, partilha, políticas Android de segundo plano, assinatura e instalação devem ser confirmados no APK real. O container do processador está preparado no código mas não foi implantado num servidor permanente. O apoio de cada serviço de origem depende do yt-dlp e pode exigir atualizações ou capacidades que esta versão não fornece; a integração utilizou media sintética própria, não prova todos os sites.

O build APK deve ser iniciado no Dashboard do projeto gerido com Expo ligado. A landing page não foi localizada no repositório desktop; foi solicitada a referência. Não foi criado um botão com URL de APK hipotético nem uma release sem binário.
