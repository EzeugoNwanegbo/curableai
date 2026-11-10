export interface ClinicRecord {
  source: "sample" | "emr";
  institution: string;
  externalRecordId: string;
  importedAt: string;
  allergies: string[];
  conditions: string[];
  medicines: { name: string; instructions: string }[];
  visits: { date: string; reason: string }[];
  results: { date: string; name: string; value: string }[];
}
export const sampleClinicRecord: ClinicRecord = {
  source: "sample",
  institution: "Veritas University · partnership concept",
  externalRecordId: "FICTIONAL-VERITAS-001",
  importedAt: "2026-11-10",
  allergies: ["Penicillin"],
  conditions: ["Mild asthma"],
  medicines: [
    {
      name: "Salbutamol inhaler",
      instructions:
        "As needed according to the fictional recorded prescription; not a new prescription.",
    },
  ],
  visits: [{ date: "2026-10-12", reason: "Routine asthma review" }],
  results: [{ date: "2026-10-12", name: "Haemoglobin", value: "13.2 g/dL" }],
};
export function formatClinicRecord(record: ClinicRecord) {
  return [
    record.source === "sample"
      ? "FICTIONAL INVESTOR DEMO DATA. This is not the student’s real medical history. Never treat these as verified clinical facts."
      : "Imported clinic record; verify currency with the patient.",
    `Source: ${record.institution}. Record: ${record.externalRecordId}.`,
    `Sample allergies: ${record.allergies.join(", ")}. Sample conditions: ${record.conditions.join(", ")}.`,
    ...record.medicines.map((m) => `Sample medicine: ${m.name}. ${m.instructions}`),
    ...record.visits.map((v) => `Sample visit: ${v.date} — ${v.reason}`),
    ...record.results.map((r) => `Sample result: ${r.name}, ${r.value}, ${r.date}`),
  ].join("\n");
}
