import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  Page,
  Progress,
  palette,
  styles,
} from "@/components/media-ui";
import { useDownloads } from "@/hooks/use-downloads";
import { exportFile, shareFile } from "@/lib/media/files";
import type { DownloadRecord } from "@/lib/media/contracts";
const labels = {
  processing: "A processar",
  downloading: "A guardar",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};
export default function LibraryScreen() {
  const { records } = useDownloads();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const action = async (record: DownloadRecord, exporting: boolean) => {
    setWorking(record.id);
    setMessage("");
    try {
      if (exporting) {
        await exportFile(record);
        setMessage("Ficheiro exportado para a pasta escolhida.");
      } else await shareFile(record);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Não foi possível abrir o ficheiro.",
      );
    } finally {
      setWorking("");
    }
  };
  return (
    <Page title="Biblioteca" subtitle="Os seus ficheiros, sempre à mão.">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
      >
        {message ? (
          <Text
            accessibilityRole="alert"
            style={[styles.body, { marginBottom: 16 }]}
          >
            {message}
          </Text>
        ) : null}
        {!records.length && (
          <Card style={{ alignItems: "center", paddingVertical: 38 }}>
            <Ionicons
              name="folder-open-outline"
              size={48}
              color={palette.blue}
            />
            <Text
              style={{ fontSize: 19, fontWeight: "700", color: palette.ink }}
            >
              Ainda sem transferências
            </Text>
            <Text style={[styles.body, { textAlign: "center" }]}>
              Cole uma ligação no separador Transferir. Os ficheiros concluídos
              ficam guardados na pasta privada do app.
            </Text>
          </Card>
        )}
        {records.map((record) => (
          <Card key={record.id}>
            <View style={[styles.row, { alignItems: "flex-start" }]}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: "#EDF2FB",
                }}
              >
                <Ionicons
                  name={
                    record.mime?.startsWith("audio")
                      ? "musical-note-outline"
                      : "videocam-outline"
                  }
                  size={23}
                  color={palette.blue}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={{
                    color: palette.ink,
                    fontSize: 14,
                    fontWeight: "700",
                    lineHeight: 21,
                  }}
                  numberOfLines={3}
                >
                  {record.name}
                </Text>
                <Text style={styles.small}>
                  {labels[record.status]} ·{" "}
                  {new Date(record.createdAt).toLocaleDateString("pt-PT")}
                  {record.size
                    ? ` · ${(record.size / 1024 / 1024).toFixed(1)} MB`
                    : ""}
                </Text>
              </View>
            </View>
            {["processing", "downloading"].includes(record.status) && (
              <Progress value={record.progress} />
            )}
            {record.error && <Text style={styles.error}>{record.error}</Text>}
            {record.status === "completed" && record.uri && (
              <View style={{ gap: 8 }}>
                <Button
                  secondary
                  icon="folder-outline"
                  disabled={!!working}
                  label={
                    working === record.id ? "A abrir…" : "Guardar noutra pasta"
                  }
                  onPress={() => {
                    void action(record, true);
                  }}
                />
                <Button
                  secondary
                  icon="share-social-outline"
                  disabled={!!working}
                  label="Abrir / partilhar"
                  onPress={() => {
                    void action(record, false);
                  }}
                />
              </View>
            )}
            {record.status === "completed" && !record.uri && (
              <Text style={styles.body}>
                Transferido pelo browser. Consulte a pasta Downloads do seu
                computador.
              </Text>
            )}
          </Card>
        ))}
        <Text style={[styles.body, { paddingHorizontal: 4 }]}>
          Sem acesso a todos os seus ficheiros. A permissão de pasta é pedida
          apenas quando decide exportar; desinstalar o app elimina a biblioteca
          privada. Não há garantia de execução quando o Android encerra o app.
        </Text>
      </ScrollView>
    </Page>
  );
}
