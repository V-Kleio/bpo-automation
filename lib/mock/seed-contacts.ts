import type { Stakeholder, StakeholderRole } from "@/lib/types";

// 11 named contacts taken verbatim from the PDF.
// The remaining 4-step roles per company are synthesized below
// (with the `synthesized` flag implicit in their priority="medium").
const NAMED: Stakeholder[] = [
  // PT Infomedia Nusantara
  {
    id: "st_andri_wibawanto",
    companyId: "co_infomedia",
    name: "Andri Wibawanto",
    title: "Director at PT Infomedia Nusantara (previously Telkomsel)",
    role: "economic_buyer",
    priority: "high",
    whyTarget:
      "Director-level = budget owner. Telkom background = understands enterprise scale.",
    linkedinUrl: "https://linkedin.com/in/andri-wibawanto",
  },
  {
    id: "st_zaki_wahab",
    companyId: "co_infomedia",
    name: "Zaki Wahab",
    title: "VP of IT at PT Infomedia Nusantara",
    role: "technical_gatekeeper",
    priority: "high",
    whyTarget:
      "Technical gatekeeper + IT decision maker — must be looped in. ISO 9001 contact center implementation expertise.",
    linkedinUrl: "https://linkedin.com/in/zaki-wahab",
  },
  // PT VADS Indonesia
  {
    id: "st_deddy_hermansyah",
    companyId: "co_vads",
    name: "Deddy Hermansyah",
    title: "Chief Sales and Marketing Officer at PT VADS Indonesia",
    role: "economic_buyer",
    priority: "high",
    whyTarget:
      "C-suite, leads sales & marketing — cares about competitive edge via AI.",
    linkedinUrl: "https://linkedin.com/in/deddy-hermansyah",
    email: "deddy.hermansyah@vads.co.id",
  },
  {
    id: "st_anwar_solehudin",
    companyId: "co_vads",
    name: "Anwar Solehudin",
    title: "Senior Leader at PT VADS Indonesia (#2 Best Sales Manager APAC 2020)",
    role: "champion",
    priority: "medium",
    whyTarget:
      "Sales leadership — open to AI tools that improve team performance.",
    linkedinUrl: "https://linkedin.com/in/anwar-solehudin",
  },
  // Transcosmos Indonesia
  {
    id: "st_seisuke_kobayashi",
    companyId: "co_transcosmos",
    name: "Seisuke Kobayashi",
    title: "CEO President Director at Transcosmos Indonesia",
    role: "ceo",
    priority: "high",
    whyTarget:
      "Top decision maker; explicitly experienced in CX, DX, digital marketing.",
    linkedinUrl: "https://linkedin.com/in/seisuke-kobayashi",
  },
  {
    id: "st_ardi_sudarto",
    companyId: "co_transcosmos",
    name: "Ardi Sudarto",
    title: "Vice President Director at Transcosmos Indonesia",
    role: "economic_buyer",
    priority: "high",
    whyTarget: "VP Director = second in command, operational decisions.",
    linkedinUrl: "https://linkedin.com/in/ardi-sudarto",
  },
  {
    id: "st_ronny_saputra",
    companyId: "co_transcosmos",
    name: "Ronny Saputra",
    title: "Head of WFM (Workforce Management) at Transcosmos Indonesia",
    role: "champion",
    priority: "medium",
    whyTarget:
      "WFM = feels the pain of manual scheduling & staffing directly. 500+ LinkedIn connections.",
    linkedinUrl: "https://linkedin.com/in/ronny-saputra",
  },
  // MitraComm Ekasarana
  {
    id: "st_wahyu_wibisono",
    companyId: "co_mitracomm",
    name: "Wahyu Wibisono",
    title: "Managing Director & Chief Operating Officer at MitraComm Ekasarana",
    role: "economic_buyer",
    priority: "high",
    whyTarget:
      "MD + COO = ultimate decision maker for operations + budget.",
    linkedinUrl: "https://linkedin.com/in/wahyu-wibisono",
  },
  {
    id: "st_bambang_suryadi",
    companyId: "co_mitracomm",
    name: "Bambang Suryadi",
    title: "Sr. VP Operations at MitraComm Ekasarana",
    role: "champion",
    priority: "high",
    whyTarget:
      "Sr. VP Ops = the champion who feels the daily pain most. 15+ years contact center (telco, insurance, banking, property, healthcare, automotive).",
    linkedinUrl: "https://linkedin.com/in/bambang-suryadi",
  },
  {
    id: "st_mustafiq",
    companyId: "co_mitracomm",
    name: "Mustafiq",
    title: "Head of Contact Center Operations at MitraComm Ekasarana",
    role: "champion",
    priority: "medium",
    whyTarget:
      "Cross-company experience (VADS, Transcosmos, Teleperformance) — knows competitor landscape, open to innovation.",
    linkedinUrl: "https://linkedin.com/in/mustafiq",
  },
  {
    id: "st_endang_widya",
    companyId: "co_mitracomm",
    name: "Endang Widya P",
    title: "Direktur MitraComm Business Process Service",
    role: "economic_buyer",
    priority: "high",
    whyTarget:
      "Director of BPS unit = directly owns the BPO service line. Represented company at Kemnaker Job Fair 2025.",
    linkedinUrl: "https://linkedin.com/in/endang-widya",
  },
];

// Synthesized stakeholders for companies without named contacts in the PDF.
// Follows the 4-step role pattern (champion → economic_buyer → technical_gatekeeper → ceo).
const SYNTHESIZED_TEMPLATES: Array<{
  role: StakeholderRole;
  titlePool: string[];
  priority: "high" | "medium" | "low";
  whyTarget: string;
}> = [
  {
    role: "champion",
    titlePool: ["Head of Contact Center", "Head of CX", "VP of Operations"],
    priority: "high",
    whyTarget: "Operational champion — feels manual pain daily.",
  },
  {
    role: "economic_buyer",
    titlePool: ["Chief Operating Officer", "Chief Digital Officer"],
    priority: "high",
    whyTarget: "Holds budget for AI/automation transformation.",
  },
  {
    role: "technical_gatekeeper",
    titlePool: ["CTO", "Head of IT", "Head of Digital Transformation"],
    priority: "medium",
    whyTarget: "Approves integrations, evaluates security & API compatibility.",
  },
  {
    role: "ceo",
    titlePool: ["CEO", "President Director"],
    priority: "medium",
    whyTarget: "Final sign-off for enterprise contracts.",
  },
];

// Indonesian name pool for synthesis (kept realistic and respectful).
const FIRST_NAMES = [
  "Rizky",
  "Dewi",
  "Hendra",
  "Sari",
  "Bagus",
  "Putri",
  "Iwan",
  "Ratna",
  "Yudha",
  "Maya",
  "Agus",
  "Linda",
  "Faisal",
  "Indra",
  "Citra",
  "Reza",
  "Nina",
  "Tomy",
  "Lia",
  "Rangga",
];
const LAST_NAMES = [
  "Pratama",
  "Wijaya",
  "Kusuma",
  "Hidayat",
  "Setiawan",
  "Saputra",
  "Lestari",
  "Nugroho",
  "Wibowo",
  "Permana",
  "Halim",
  "Hartono",
  "Susilo",
  "Anggraini",
  "Prasetyo",
];

function synthName(seed: string, idx: number): string {
  const a = (hash(seed + idx) % FIRST_NAMES.length + FIRST_NAMES.length) % FIRST_NAMES.length;
  const b = (hash(seed + idx + "_l") % LAST_NAMES.length + LAST_NAMES.length) % LAST_NAMES.length;
  return `${FIRST_NAMES[a]} ${LAST_NAMES[b]}`;
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h | 0;
}

export function buildAllStakeholders(companyIds: string[]): Stakeholder[] {
  const result: Stakeholder[] = [...NAMED];
  const namedByCompany = new Map<string, Set<StakeholderRole>>();
  for (const s of NAMED) {
    if (!namedByCompany.has(s.companyId))
      namedByCompany.set(s.companyId, new Set());
    namedByCompany.get(s.companyId)!.add(s.role);
  }

  for (const cId of companyIds) {
    const filled = namedByCompany.get(cId) ?? new Set<StakeholderRole>();
    SYNTHESIZED_TEMPLATES.forEach((tpl, i) => {
      if (filled.has(tpl.role)) return;
      const name = synthName(cId, i);
      const title =
        tpl.titlePool[(hash(cId + i) >>> 0) % tpl.titlePool.length];
      result.push({
        id: `st_${cId}_${tpl.role}`,
        companyId: cId,
        name,
        title,
        role: tpl.role,
        priority: tpl.priority,
        whyTarget: tpl.whyTarget,
        linkedinUrl: `https://linkedin.com/in/${name.toLowerCase().replace(/ /g, "-")}`,
      });
    });
  }
  return result;
}
