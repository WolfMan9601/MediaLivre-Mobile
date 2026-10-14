import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  Label,
  Page,
  Progress,
  palette,
  styles,
} from "@/components/media-ui";
import { useDownloads } from "@/hooks/use-downloads";
import { DEFAULT_OPTIONS, type MediaOptions } from "@/lib/media/contracts";
const formats = [
  { value: "original", label: "Original", icon: "document-outline" },
  { value: "mp4", label: "Vídeo MP4", icon: "videocam-outline" },
  { value: "mp3", label: "Áudio MP3", icon: "musical-note-outline" },
] as const;
const qualities = [
  { value: "best", label: "Melhor" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
] as const;
export default function TransferScreen() {
  const [url, setUrl] = useState("");
  const [options, setOptions] = useState<MediaOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState("");
  const { start, cancel, busy, records, processor } = useDownloads();
  const active = records.find(
    (x) => x.status === "processing" || x.status === "downloading",
  );
  const begin = async () => {
    setError("");
    try {
      await start(url, options);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pedido inválido.");
    }
  };
  return (
    <Page title="Transferir" subtitle="A sua media. Onde quiser.">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
      >
        <Card>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Label>LIGAÇÃO DO CONTEÚDO</Label>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                void Clipboard.getStringAsync()
                  .then(setUrl)
                  .catch(() => setError("Não foi possível ler o clipboard."));
              }}
              style={{ padding: 8 }}
            >
              <Text
                style={{ color: palette.blue, fontWeight: "700", fontSize: 13 }}
              >
                Colar
              </Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Ligação HTTPS do vídeo ou áudio"
            value={url}
            onChangeText={setUrl}
            editable={!busy}
            placeholder="https://…"
            placeholderTextColor="#8A97AA"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
            maxLength={2048}
          />
          <Label>O QUE QUER GUARDAR?</Label>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {formats.map((item) => (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: options.format === item.value,
                  disabled: busy,
                }}
                disabled={busy}
                onPress={() =>
                  setOptions((old) => ({
                    ...old,
                    format: item.value,
                    quality: item.value === "mp3" ? "best" : old.quality,
                  }))
                }
                style={{
                  flex: 1,
                  alignItems: "center",
                  gap: 7,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor:
                    options.format === item.value ? palette.navy : "#F1F4F9",
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={21}
                  color={
                    options.format === item.value
                      ? palette.yellow
                      : palette.muted
                  }
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color:
                      options.format === item.value ? "white" : palette.ink,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {options.format !== "mp3" && (
            <>
              <Label>QUALIDADE MÁXIMA</Label>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {qualities.map((item) => (
                  <Pressable
                    key={item.value}
                    disabled={busy}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: options.quality === item.value,
                    }}
                    onPress={() =>
                      setOptions((old) => ({ ...old, quality: item.value }))
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderRadius: 10,
                      borderColor:
                        options.quality === item.value
                          ? palette.blue
                          : palette.border,
                      backgroundColor:
                        options.quality === item.value ? "#EAF0FD" : "white",
                    }}
                  >
                    <Text
                      style={{
                        color: palette.ink,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {options.format === "mp3" && (
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Text style={{ color: palette.ink, fontSize: 13, flex: 1 }}>
                Incorporar capa no MP3
              </Text>
              <Switch
                disabled={busy}
                value={options.cover}
                onValueChange={(cover) =>
                  setOptions((old) => ({ ...old, cover }))
                }
                trackColor={{ true: palette.blue }}
              />
            </View>
          )}
          <View style={[styles.row, { alignItems: "flex-start" }]}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={palette.blue}
            />
            <Text style={[styles.body, { flex: 1 }]}>
              Ficheiros diretos podem ser guardados sem servidor. Páginas e
              conversões usam o processador
              {processor ? " configurado" : " em Ajustes"}. Cole uma ligação
              individual.
            </Text>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button
            label={busy ? "Transferência em curso…" : "Iniciar transferência"}
            icon="download-outline"
            disabled={busy || !url.trim()}
            onPress={() => {
              void begin();
            }}
          />
        </Card>
        {active && (
          <Card>
            <View style={[styles.row, { justifyContent: "space-between" }]}>
              <Label>
                {active.status === "processing"
                  ? "A PROCESSAR NO SERVIDOR"
                  : "A GUARDAR NO DISPOSITIVO"}
              </Label>
              <Text style={{ color: palette.blue, fontWeight: "800" }}>
                {active.progress}%
              </Text>
            </View>
            <Text
              numberOfLines={2}
              style={{ color: palette.ink, fontWeight: "600", lineHeight: 20 }}
            >
              {active.name}
            </Text>
            <Progress value={active.progress} />
            <Button
              label="Cancelar transferência"
              secondary
              icon="close-circle-outline"
              onPress={cancel}
            />
          </Card>
        )}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingHorizontal: 4,
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={palette.muted}
          />
          <Text style={[styles.body, { flex: 1 }]}>
            Transfira apenas conteúdo seu ou autorizado. Não contornamos contas,
            paywalls ou DRM. O suporte depende do serviço de origem.
          </Text>
        </View>
        {records[0] && !busy && (
          <Card style={{ marginTop: 20 }}>
            <Label>ÚLTIMA TRANSFERÊNCIA</Label>
            <Text
              style={{ color: palette.ink, fontWeight: "700" }}
              numberOfLines={2}
            >
              {records[0].name}
            </Text>
            <Text
              style={
                records[0].status === "failed" ? styles.error : styles.body
              }
            >
              {records[0].status === "completed"
                ? "Concluída · veja na Biblioteca"
                : records[0].error || "Cancelada"}
            </Text>
          </Card>
        )}
      </ScrollView>
    </Page>
  );
}
