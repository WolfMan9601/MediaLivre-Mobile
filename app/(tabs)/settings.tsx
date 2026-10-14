import { useEffect, useState } from "react";
import { Linking, ScrollView, Text, TextInput } from "react-native";
import { Button, Card, Label, Page, styles } from "@/components/media-ui";
import { useDownloads } from "@/hooks/use-downloads";
import { normalizeProcessor, requestJson } from "@/lib/media/api";
export default function SettingsScreen() {
  const { processor, setProcessor, busy } = useDownloads();
  const [value, setValue] = useState(processor);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  useEffect(() => setValue(processor), [processor]);
  const run = async (test: boolean) => {
    setChecking(true);
    setMessage("");
    try {
      const base = normalizeProcessor(value);
      if (test) {
        if (!base) throw new Error("Introduza o endereço HTTPS do servidor.");
        const health = await requestJson<{ ok: boolean; version: string }>(
          `${base}/api/media/health`,
        );
        if (!health.ok) throw new Error("O processador não está pronto.");
        setMessage(`Servidor disponível · versão ${health.version}.`);
      } else {
        await setProcessor(base);
        setMessage(
          base
            ? "Servidor guardado neste dispositivo."
            : "Servidor personalizado removido. Ficheiros diretos continuam disponíveis.",
        );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Falha na ligação.");
    } finally {
      setChecking(false);
    }
  };
  const updates = async () => {
    setChecking(true);
    try {
      const response = await fetch(
        "https://api.github.com/repos/WolfMan9601/MediaLivre-Mobile/releases/latest",
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!response.ok)
        throw new Error(
          "Ainda não existe um APK publicado nas Releases oficiais.",
        );
      const release = await response.json();
      const asset = release.assets?.find((x: { name: string }) =>
        x.name.endsWith(".apk"),
      );
      if (!asset?.browser_download_url)
        throw new Error("A última versão ainda não contém um APK.");
      await Linking.openURL(asset.browser_download_url);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Não foi possível consultar atualizações.",
      );
    } finally {
      setChecking(false);
    }
  };
  return (
    <Page title="Ajustes" subtitle="Uma configuração simples e transparente.">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
      >
        <Card>
          <Label>SERVIDOR DE PROCESSAMENTO</Label>
          <Text style={styles.body}>
            Necessário para páginas de serviços e conversões MP3/MP4. O endereço
            pertence ao seu operador de confiança; o conteúdo será processado
            nesse servidor e apagado até 30 minutos depois.
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            accessibilityLabel="Endereço HTTPS do processador"
            placeholder="https://api.exemplo.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy && !checking}
          />
          <Button
            label="Guardar servidor"
            icon="checkmark-outline"
            disabled={busy || checking}
            onPress={() => {
              void run(false);
            }}
          />
          <Button
            secondary
            label="Testar ligação"
            icon="pulse-outline"
            disabled={checking}
            onPress={() => {
              void run(true);
            }}
          />
          {__DEV__ && (
            <Text style={styles.small}>
              Preview: o endpoint de desenvolvimento é temporário e não é um
              endereço de produção.
            </Text>
          )}
        </Card>
        {message ? (
          <Text
            accessibilityRole="alert"
            style={[styles.body, { marginBottom: 16 }]}
          >
            {message}
          </Text>
        ) : null}
        <Card>
          <Label>MEDIALIVRE MOBILE · 0.1.0</Label>
          <Text style={styles.body}>
            Código aberto. Sem contas, cookies de serviços ou telemetria
            própria. Ligações diretas e histórico são tratados no dispositivo; o
            processador recebe apenas o URL e as opções escolhidas.
          </Text>
          <Button
            secondary
            label="Consultar APK oficial"
            icon="download-outline"
            disabled={checking}
            onPress={() => {
              void updates();
            }}
          />
          <Button
            secondary
            label="Código e instruções"
            icon="logo-github"
            onPress={() => {
              void Linking.openURL(
                "https://github.com/WolfMan9601/MediaLivre-Mobile",
              );
            }}
          />
        </Card>
        <Card>
          <Label>LIMITES DESTA VERSÃO</Label>
          <Text style={styles.body}>
            Transferências individuais, até 250 MB por ficheiro. MP3 com capa e
            vídeo MP4 através do servidor. Playlists, canais, agendamentos e
            conteúdos que exigem autenticação não são expandidos nesta versão. O
            app deve permanecer aberto durante o fluxo de processamento; nenhum
            download é iniciado silenciosamente.
          </Text>
        </Card>
      </ScrollView>
    </Page>
  );
}
