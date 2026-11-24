import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.mark}>
        <Text style={styles.markText}>FC</Text>
      </View>
      <Text style={styles.title}>Friendly Clash</Text>
      <Text style={styles.subtitle}>Good games. Better company.</Text>
      <View style={styles.divider} />
      <Text style={styles.note}>Android app foundation</Text>
      <Text style={styles.detail}>
        The native app now has its own home inside the Friendly Clash repository.
        The Ludo browser prototype remains separate while we build the real app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#101114",
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#D6B36A",
    backgroundColor: "#191A1E",
  },
  markText: {
    color: "#D6B36A",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    color: "#F0E8D8",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: "#D6B36A",
    fontSize: 15,
    marginTop: 9,
  },
  divider: {
    width: 44,
    height: 1,
    backgroundColor: "#3A3428",
    marginVertical: 28,
  },
  note: {
    color: "#F0E8D8",
    fontSize: 14,
    fontWeight: "600",
  },
  detail: {
    color: "#99969A",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 290,
  },
});
