// Testa o pipeline de 5 passos: envia o transcript de exemplo para
// /api/prontuario e imprime o ProntuarioModel + o markdown derivado.
//
// Uso: npm run test:prontuario   (com o dev server rodando)
import { readFile } from "node:fs/promises";

const PORT = process.env.PORT ?? "3001";
const url = `http://localhost:${PORT}/api/prontuario`;

const transcript = await readFile(
  new URL("../samples/consulta-exemplo.txt", import.meta.url),
  "utf8"
);

console.log(`→ POST ${url}\n`);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transcript,
    paciente: {
      nome_paciente: "Paciente Exemplo",
      convenio: "SUS",
      dentista: "Dra. Exemplo",
      cro: "SP-00000",
    },
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error("Erro:", data.error ?? data);
  process.exit(1);
}

console.log("=== Falhas parciais ===");
console.log(data.falhasParciais?.length ? data.falhasParciais : "(nenhuma)");
console.log("\n=== ProntuarioModel ===\n");
console.log(JSON.stringify(data.prontuario, null, 2));
