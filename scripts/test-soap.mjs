// Testa a estruturação clínica: envia o transcript de exemplo para /api/process
// e imprime o prontuário SOAP gerado.
//
// Uso: npm run test:soap   (com o dev server rodando)
import { readFile } from "node:fs/promises";

const PORT = process.env.PORT ?? "3001";
const url = `http://localhost:${PORT}/api/process`;

const transcript = await readFile(
  new URL("../samples/consulta-exemplo.txt", import.meta.url),
  "utf8"
);

console.log(`→ POST ${url}\n`);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ transcript }),
});

const data = await res.json();

if (!res.ok) {
  console.error("Erro:", data.error ?? data);
  process.exit(1);
}

console.log("=== SOAP estruturado ===\n");
console.log(JSON.stringify(data.soap, null, 2));
