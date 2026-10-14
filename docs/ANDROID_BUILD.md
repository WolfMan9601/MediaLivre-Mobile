# Android: build e distribuição

O projeto utiliza o starter Expo gerido. Preserve o slug, esquema e identificador Android gerados em `app.config.ts`; são a identidade deste app. A versão inicial é 0.1.0, com Android mínimo 7.0/API 24 e arquiteturas ARM configuradas no starter.

## Build gerido

Guarde um checkpoint aceite do projeto e ligue a sua conta Expo no **Dashboard → Connect Expo**. A entrada do token pertence ao formulário protegido do Dashboard, não a chat nem a ficheiros de código. Inicie **Build Android → APK** a partir do checkpoint. A presença de Preview Web ou QR não prova que existe um APK ou que funções nativas foram validadas.

O perfil `preview` de `eas.json` utiliza distribuição interna e `buildType: apk`. `production` prepara AAB. Configure um endpoint HTTPS estável do processador antes do build se deseja uma configuração inicial pronta; caso contrário, a pessoa pode configurá-lo em Ajustes. Não inclua o hostname temporário do Preview no APK.

## Verificação no Android

Antes de uma release pública, instale o APK real num dispositivo Android e confirme download HTTPS, cancelamento, armazenamento local, partilha e exportação SAF com permissão concedida/recusada. Confirme retoma do app após encerramento e o aviso de transferência interrompida. Os testes TypeScript e do servidor não substituem essa verificação nativa. Confirme a assinatura e o SHA-256 do APK; mantenha a mesma chave para permitir atualizações futuras.

## Asset e landing page

Depois de obter o APK real e verificar a assinatura, publique-o como `MediaLivre-Mobile-0.1.0.apk` com um ficheiro `.sha256` na GitHub Release do repositório `WolfMan9601/MediaLivre-Mobile`. A criação de uma release sem APK não disponibiliza um download Android. Não carregue keystores, tokens Expo ou ficheiros `.env` no repositório.

A landing page deve usar o `browser_download_url` desse asset confirmado e manter o botão desktop ao lado. Não se deve usar uma ligação hipotética `releases/latest/download/...` que ainda responda 404. A referência da landing page existente foi solicitada porque o repositório desktop não contém website nem GitHub Pages.

Um clone independente pode utilizar os perfis EAS com a sua própria configuração/conta Expo, mas o projeto gerido mantém o repositório canónico gerido por Manus; o GitHub público é uma cópia separada.
