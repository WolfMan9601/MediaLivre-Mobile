# MediaLivre Mobile

Cliente Android de código aberto em **Expo Router / React Native / TypeScript**, com interface em português e identidade do [MediaLivre desktop](https://github.com/WolfMan9601/MediaLivre). O repositório público é independente do desktop. A primeira versão implementa transferências individuais, não uma reprodução completa de todas as funções Qt.

> Transfira apenas conteúdo seu ou autorizado. O MediaLivre não contorna DRM, paywalls, contas ou outros controlos de acesso. A compatibilidade de páginas depende do yt-dlp e das mudanças de cada origem.

## Transferir no Android

Introduza uma ligação HTTPS, escolha Original / Vídeo MP4 / Áudio MP3 e a qualidade máxima e inicie. Ficheiros de media diretos em modo Original/Melhor são transferidos diretamente com `expo-file-system`, progresso, limite de 250 MB e cancelamento. Páginas e conversões seguem para a API de processamento.

Os ficheiros concluídos ficam na pasta privada de documentos do app. A Biblioteca oferece **Guardar noutra pasta**, com autorização Android Storage Access Framework apenas para a pasta escolhida, e **Abrir / partilhar**, usando o sistema nativo. Não é pedida permissão para ler todos os ficheiros. Desinstalar o app remove os ficheiros privados; exporte os que pretende conservar.

No Preview Web, o ficheiro é enviado para os Downloads do browser, não guardado numa biblioteca nativa. Uma falha CORS numa origem direta pode impedir o Preview Web, sem implicar o mesmo problema no Android.

## Servidor de processamento

A API Express do starter inicia um worker Python `yt-dlp`/FFmpeg por trabalho. O cliente recebe um identificador e token aleatórios, consulta progresso e transfere o resultado com autorização Bearer. O token não é colocado no URL nem no histórico local. Ficheiros e trabalhos expiram em 30 minutos; o cliente pede remoção após a transferência/cancelamento. Não foi selecionado armazenamento de objetos: reiniciar o servidor pode perder os trabalhos temporários.

Em **Ajustes**, configure um endpoint HTTPS de confiança, por exemplo o seu servidor próprio. A API recebe o URL e as opções do conteúdo, não credenciais de serviços. O endpoint temporário do Preview serve apenas desenvolvimento. Um APK pode receber `EXPO_PUBLIC_PROCESSOR_URL` público durante o build; sem essa configuração, ficheiros diretos continuam disponíveis e páginas/conversões pedem um servidor em Ajustes. [Implantação do processador](docs/PROCESSOR.md).

## Executar

Requer Node.js 22, pnpm 9.12.0, Python 3.11+ e FFmpeg/ffprobe.

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/pip install -r processor/requirements.txt
export MEDIALIVRE_PYTHON="$PWD/.venv/bin/python"
pnpm dev
```

Metro/Expo Web usa 8081 e a API usa 3000. O ambiente gerido carrega automaticamente os endereços de Preview. Num clone independente, configure os valores públicos em `.env` a partir de `.env.example` para o dispositivo alcançar a API. Não copie segredos do servidor para `EXPO_PUBLIC_*`. A rota de downloads não usa a base de dados; as rotas OAuth opcionais do starter requerem a sua configuração e tabela de utilizadores. No projeto gerido, o esquema inicial já foi sincronizado.

```bash
pnpm check
pnpm test
pnpm build
```

## APK e distribuição

Configuração Android preparada em `app.config.ts` e `eas.json`: `preview` produz APK instalável; `production` destina-se a AAB. O build nativo deve ser iniciado no Dashboard do projeto gerido com a conta Expo ligada. **Não existe APK distribuível enquanto o build não terminar e o asset real não for publicado.** Consulte [Build Android e release](docs/ANDROID_BUILD.md).

A aplicação consulta apenas APKs realmente presentes em [Releases oficiais](https://github.com/WolfMan9601/MediaLivre-Mobile/releases). Não há instalação automática nem downloads silenciosos. O código público é uma cópia autónoma; o repositório canónico do projeto mobile gerido permanece gerido por Manus para permitir builds nativos.

## Limites da versão 0.1.0

São suportadas ligações individuais e conversões MP3 com capa / MP4 H.264-AAC. Playlists, canais, Stories como coleções, seleção de múltiplos itens e agendamentos desktop não estão implementados nesta versão; use URLs individuais. Não são guardados cookies, passwords ou credenciais de serviços.

Mantenha o app aberto durante o processamento. Não é garantida execução quando o Android mata o processo; trabalhos interrompidos são identificados como falhados na abertura seguinte, sem repetição automática. O histórico local guarda nomes e estado, não URLs de origem nem tokens de trabalho. Não se corta o histórico a 50 entradas nem se eliminam silenciosamente ficheiros locais.

## Estrutura

`app/(tabs)/` contém Transferir, Biblioteca e Ajustes. `components/media-ui.tsx` centraliza a identidade visual. `hooks/use-downloads.tsx` gere progresso e histórico; `lib/media/` contém contratos, cliente e APIs de ficheiros. `server/media/` implementa a API temporária, segurança e limites. `processor/` contém o worker Python. `docs/` descreve implantação e distribuição. As pastas `_core` e `drizzle/` preservam os adaptadores do starter.

## Licença

MIT, com o ícone original e a identidade reutilizados do MediaLivre do mesmo autor. As dependências e ferramentas mantêm as suas próprias licenças, incluindo yt-dlp, FFmpeg e respetivos codecs. O código não oferece garantia de suporte permanente a serviços de terceiros.
