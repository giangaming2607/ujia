/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from "../types";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from "docx";
import * as mammoth from "mammoth";

export const SAMPLE_QUESTIONS_JSON = [
  {
    "text": "Siapakah presiden pertama Republik Indonesia?",
    "options": [
      "Ir. Soekarno",
      "Drs. Mohammad Hatta",
      "Soeharto",
      "B.J. Habibie"
    ],
    "correctAnswer": 0
  },
  {
    "text": "Bumi berotasi pada porosnya selama sekitar berapa jam?",
    "options": [
      "12 Jam",
      "24 Jam",
      "36 Jam",
      "48 Jam"
    ],
    "correctAnswer": 1
  },
  {
    "text": "Apa lambang kimia untuk air?",
    "options": [
      "CO2",
      "O2",
      "H2O",
      "NaCl"
    ],
    "correctAnswer": 2
  }
];

export const SAMPLE_QUESTIONS_CSV = `Soal;Opsi A;Opsi B;Opsi C;Opsi D;Kunci Jawban
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;
;;;;;`;

/**
 * Downloads a sample template file as a text file (CSV or JSON) or Word file (.docx).
 */
export async function downloadTemplate(type: "csv" | "json" | "docx") {
  if (type === "docx") {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "TEMPLATE BANK SOAL CBT",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 200,
              },
            }),
            new Paragraph({
              text: "Petunjuk: Silakan isi tabel di bawah ini. Jangan mengubah judul/header kolom di baris pertama. Masukkan isian Kunci Jawban dengan huruf A, B, C, atau D.",
              spacing: {
                after: 300,
              }
            }),
            new Table({
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              rows: [
                // Header Row
                new TableRow({
                  children: [
                    new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Soal" })] }),
                    new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Opsi A" })] }),
                    new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Opsi B" })] }),
                    new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Opsi C" })] }),
                    new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Opsi D" })] }),
                    new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: "Kunci Jawban" })] }),
                  ],
                }),
                // 30 empty template rows exactly matching the CSV template
                ...Array.from({ length: 30 }).map(() =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "" })] }),
                      new TableCell({ children: [new Paragraph({ text: "" })] }),
                      new TableCell({ children: [new Paragraph({ text: "" })] }),
                      new TableCell({ children: [new Paragraph({ text: "" })] }),
                      new TableCell({ children: [new Paragraph({ text: "" })] }),
                      new TableCell({ children: [new Paragraph({ text: "" })] }),
                    ],
                  })
                )
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_soal_cbt.docx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const content = type === "json" 
    ? JSON.stringify(SAMPLE_QUESTIONS_JSON, null, 2)
    : SAMPLE_QUESTIONS_CSV;
    
  const mimeType = type === "json" ? "application/json" : "text/csv";
  const filename = type === "json" ? "template_soal_cbt.json" : "template_soal_cbt.csv";
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse raw file content uploaded by users.
 * Supports standard CSV and structural JSON content.
 */
export function parseQuestionsTemplate(text: string, extension: string): Partial<Question>[] {
  const questionsList: Partial<Question>[] = [];

  if (extension === "json") {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error("File JSON harus berupa Array soal.");
      }
      for (const item of parsed) {
        if (!item.text || !Array.isArray(item.options) || typeof item.correctAnswer !== "number") {
          throw new Error("Format JSON salah. Pastikan memiliki text, array options, dan correctAnswer number.");
        }
        questionsList.push({
          id: Math.random().toString(36).substring(2, 9),
          text: String(item.text),
          options: item.options.map((opt: any) => String(opt)),
          correctAnswer: Number(item.correctAnswer),
        });
      }
    } catch (e: any) {
      throw new Error(`Gagal membaca JSON: ${e.message}`);
    }
  } else {
    // Parse Simple CSV
    try {
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error("CSV terlalu pendek.");
      }
      
      // Determine delimiter (semicolon or comma) based on the first line
      const headerLine = lines[0];
      const delimiter = headerLine.includes(";") ? ";" : ",";
      
      // Header validation
      const header = headerLine.toLowerCase();
      const isValidHeader = 
        header.includes("soal") || 
        header.includes("text") || 
        header.includes("opsi") || 
        header.includes("optiona");
        
      if (!isValidHeader) {
        throw new Error("Format header CSV tidak valid. Gunakan format template kami (harus mengandung 'Soal' atau 'text').");
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse with delimiter splitting respecting quotes
        const parts: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delimiter && !inQuotes) {
            parts.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        parts.push(current.trim());

        // Skip completely empty rows
        const hasContent = parts.some(p => p.trim() !== "");
        if (!hasContent) continue;

        if (parts.length < 6) {
          throw new Error(`Baris ${i + 1} tidak memiliki kolom yang cukup.`);
        }

        const qText = parts[0].replace(/^"|"$/g, "").trim();
        const optA = parts[1].replace(/^"|"$/g, "").trim();
        const optB = parts[2].replace(/^"|"$/g, "").trim();
        const optC = parts[3].replace(/^"|"$/g, "").trim();
        const optD = parts[4].replace(/^"|"$/g, "").trim();
        
        // Skip check if the row is filled with only empty strings
        if (!qText && !optA && !optB && !optC && !optD && !parts[5].trim()) {
          continue;
        }

        // Parse correction letter (A, B, C, D) or index (0, 1, 2, 3)
        const rawAns = parts[5].replace(/^"|"$/g, "").trim().toUpperCase();
        let correctAnswer = -1;
        if (rawAns === "A" || rawAns === "0") {
          correctAnswer = 0;
        } else if (rawAns === "B" || rawAns === "1") {
          correctAnswer = 1;
        } else if (rawAns === "C" || rawAns === "2") {
          correctAnswer = 2;
        } else if (rawAns === "D" || rawAns === "3") {
          correctAnswer = 3;
        }

        if (correctAnswer === -1) {
          throw new Error(`Baris ${i + 1} memiliki indeks/kunci jawaban yang salah (harus A, B, C, D atau 0-3).`);
        }

        questionsList.push({
          id: Math.random().toString(36).substring(2, 9),
          text: qText,
          options: [optA, optB, optC, optD].filter(Boolean),
          correctAnswer: correctAnswer,
        });
      }
    } catch (e: any) {
      throw new Error(`Gagal membaca CSV: ${e.message}`);
    }
  }

  return questionsList;
}

/**
 * Parse Word document (.docx) tables uploaded by users.
 */
export async function parseWordQuestionsTemplate(arrayBuffer: ArrayBuffer): Promise<Partial<Question>[]> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const parser = new DOMParser();
  const docDOM = parser.parseFromString(html, "text/html");
  const table = docDOM.querySelector("table");
  if (!table) {
    throw new Error("Tidak ditemukan tabel di dalam dokumen Word Anda. Pastikan Isian Soal berada di dalam tabel.");
  }

  const rows = table.querySelectorAll("tr");
  if (rows.length < 2) {
    throw new Error("Tabel di dokumen Word Anda kosong atau tidak memiliki baris data.");
  }

  // Validate headers
  const headerCells = rows[0].querySelectorAll("td, th");
  if (headerCells.length < 6) {
    throw new Error("Tabel Word harus memiliki minimal 6 kolom: Soal, Opsi A, Opsi B, Opsi C, Opsi D, Kunci Jawban");
  }

  const questionsList: Partial<Question>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll("td, th");
    if (cells.length < 6) continue;

    const qText = cells[0].textContent?.trim() || "";
    const optA = cells[1].textContent?.trim() || "";
    const optB = cells[2].textContent?.trim() || "";
    const optC = cells[3].textContent?.trim() || "";
    const optD = cells[4].textContent?.trim() || "";
    const rawAns = cells[5].textContent?.trim().toUpperCase() || "";

    // Skip completely empty rows
    if (!qText && !optA && !optB && !optC && !optD && !rawAns) {
      continue;
    }

    // Determine correct answer
    let correctAnswer = -1;
    if (rawAns === "A" || rawAns === "0") {
      correctAnswer = 0;
    } else if (rawAns === "B" || rawAns === "1") {
      correctAnswer = 1;
    } else if (rawAns === "C" || rawAns === "2") {
      correctAnswer = 2;
    } else if (rawAns === "D" || rawAns === "3") {
      correctAnswer = 3;
    }

    if (correctAnswer === -1) {
      throw new Error(`Baris ke-${i + 1} di dalam tabel Word memiliki kunci jawaban yang salah ("${rawAns}"). Harus berupa A, B, C, atau D.`);
    }

    questionsList.push({
      id: Math.random().toString(36).substring(2, 9),
      text: qText,
      options: [optA, optB, optC, optD].filter(Boolean),
      correctAnswer: correctAnswer,
    });
  }

  return questionsList;
}
