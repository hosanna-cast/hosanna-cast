// Deux versions de la Bible côte à côte (comparaison) : cols = [{ label, text }, { label, text }]
// Styles en ligne et <span> seulement : le composant se place dans un <p> et hérite de la taille du texte (ajustée par l'écran).
const S = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: "3%", width: "100%" },
  label: { display: "block", fontSize: "0.6em", color: "#60a5fa", textAlign: "center", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "0.3em" },
  text: { display: "block", whiteSpace: "pre-line" },
};

export default function ColsText({ cols }) {
  return (
    <span style={S.grid}>
      {cols.map((c, i) => (
        <span key={i} style={{ display: "block", minWidth: 0, ...(i ? { borderLeft: "1px solid color-mix(in srgb, currentColor 30%, transparent)", paddingLeft: "3%" } : {}) }}>
          <span style={S.label}>{c.label}</span>
          <span style={S.text}>{c.text}</span>
        </span>
      ))}
    </span>
  );
}
