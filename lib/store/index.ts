"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";
import { uid } from "@/lib/utils";
import type {
  Company,
  Stakeholder,
  CampaignLead,
  Deal,
  LogEvent,
  ChatMessage,
  ClockState,
  CampaignStage,
  Touchpoint,
  AIAnalysis,
  DealStage,
  DealActivity,
  LeadStatus,
} from "@/lib/types";
const MAX_LOGS = 500;

interface State {
  // Data
  companies: Company[];
  stakeholders: Stakeholder[];
  campaigns: CampaignLead[];
  deals: Deal[];
  logs: LogEvent[];
  chat: ChatMessage[];
  clock: ClockState;
  selectedCompanyId: string | null;

  // Company / lead status
  setLeadStatus: (id: string, status: LeadStatus) => void;
  setAnalysis: (id: string, analysis: AIAnalysis) => void;

  // Import
  addCompanies: (companies: Company[]) => number;
  addStakeholders: (stakeholders: Stakeholder[]) => number;

  // Campaign mutations
  pushToCampaign: (companyId: string) => void;
  updateCampaignStage: (
    companyId: string,
    stage: CampaignStage,
    nowIso?: string,
  ) => void;
  setActiveStep: (companyId: string, step: 1 | 2 | 3 | 4) => void;
  appendTouchpoint: (companyId: string, tp: Touchpoint) => void;

  // Deal mutations
  upsertDeal: (deal: Partial<Deal> & { companyId: string }) => void;
  appendDealActivity: (companyId: string, activity: DealActivity) => void;
  setDealStage: (companyId: string, stage: DealStage) => void;

  // Chat
  appendChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, patch: Partial<ChatMessage>) => void;

  // Logs
  log: (e: Omit<LogEvent, "id" | "at"> & { at?: string }) => void;

  // Clock
  setClock: (patch: Partial<ClockState>) => void;
  tickSimulatedTime: (ms: number) => void;

  // Selection
  selectCompany: (id: string | null) => void;

  // Reset
  resetDemo: () => void;
}

function freshState() {
  return {
    companies: [] as Company[],
    stakeholders: [] as Stakeholder[],
    campaigns: [] as CampaignLead[],
    deals: [] as Deal[],
    logs: [] as LogEvent[],
    chat: [] as ChatMessage[],
    clock: {
      running: false,
      speed: 1 as 1 | 5 | 10,
      simulatedTime: new Date().toISOString(),
    },
    selectedCompanyId: null as string | null,
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...freshState(),

      setLeadStatus: (id, status) =>
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, status } : c,
          ),
        })),

      setAnalysis: (id, analysis) =>
        set((s) => ({
          companies: s.companies.map((c) =>
            c.id === id ? { ...c, analysis, status: "qualified" } : c,
          ),
        })),

      addCompanies: (newCompanies) => {
        let added = 0;
        set((s) => {
          const existing = new Set(s.companies.map((c) => c.id));
          const byName = new Set(s.companies.map((c) => c.name.toLowerCase()));
          const filtered = newCompanies.filter((c) => {
            if (existing.has(c.id)) return false;
            if (byName.has(c.name.toLowerCase())) return false;
            existing.add(c.id);
            byName.add(c.name.toLowerCase());
            added += 1;
            return true;
          });
          if (filtered.length === 0) return {};
          return { companies: [...s.companies, ...filtered] };
        });
        return added;
      },

      addStakeholders: (newStakeholders) => {
        let added = 0;
        set((s) => {
          const existing = new Set(s.stakeholders.map((x) => x.id));
          const filtered = newStakeholders.filter((x) => {
            if (existing.has(x.id)) return false;
            existing.add(x.id);
            added += 1;
            return true;
          });
          if (filtered.length === 0) return {};
          return { stakeholders: [...s.stakeholders, ...filtered] };
        });
        return added;
      },

      pushToCampaign: (companyId) => {
        const now = new Date().toISOString();
        const exists = get().campaigns.find((c) => c.companyId === companyId);
        if (exists) return;
        set((s) => ({
          campaigns: [
            ...s.campaigns,
            {
              companyId,
              stage: "queued",
              activeStep: 1,
              touchpoints: [],
              enteredStageAt: now,
              createdAt: now,
            },
          ],
          companies: s.companies.map((c) =>
            c.id === companyId ? { ...c, pushedToCampaignAt: now } : c,
          ),
        }));
        // Create initial Deal in "new" stage
        get().upsertDeal({ companyId, stage: "new" });
      },

      updateCampaignStage: (companyId, stage, nowIso) => {
        const at = nowIso ?? new Date().toISOString();
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.companyId === companyId
              ? { ...c, stage, enteredStageAt: at }
              : c,
          ),
        }));
      },

      setActiveStep: (companyId, step) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.companyId === companyId ? { ...c, activeStep: step } : c,
          ),
        })),

      appendTouchpoint: (companyId, tp) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) =>
            c.companyId === companyId
              ? { ...c, touchpoints: [...c.touchpoints, tp] }
              : c,
          ),
        })),

      upsertDeal: ({ companyId, ...patch }) => {
        const now = new Date().toISOString();
        set((s) => {
          const existing = s.deals.find((d) => d.companyId === companyId);
          if (existing) {
            return {
              deals: s.deals.map((d) =>
                d.companyId === companyId ? { ...d, ...patch } : d,
              ),
            };
          }
          return {
            deals: [
              ...s.deals,
              {
                id: uid("deal"),
                companyId,
                stage: "new",
                activities: [],
                createdAt: now,
                ...patch,
              } as Deal,
            ],
          };
        });
      },

      appendDealActivity: (companyId, activity) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.companyId === companyId
              ? { ...d, activities: [activity, ...d.activities].slice(0, 50) }
              : d,
          ),
        })),

      setDealStage: (companyId, stage) =>
        set((s) => ({
          deals: s.deals.map((d) =>
            d.companyId === companyId ? { ...d, stage } : d,
          ),
        })),

      appendChatMessage: (msg) =>
        set((s) => ({ chat: [...s.chat, msg].slice(-100) })),

      updateChatMessage: (id, patch) =>
        set((s) => ({
          chat: s.chat.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        })),

      log: (e) =>
        set((s) => ({
          logs: [
            {
              id: uid("log"),
              at: e.at ?? new Date().toISOString(),
              ...e,
            } as LogEvent,
            ...s.logs,
          ].slice(0, MAX_LOGS),
        })),

      setClock: (patch) =>
        set((s) => ({ clock: { ...s.clock, ...patch } })),

      tickSimulatedTime: (ms) =>
        set((s) => ({
          clock: {
            ...s.clock,
            simulatedTime: new Date(
              new Date(s.clock.simulatedTime).getTime() + ms,
            ).toISOString(),
          },
        })),

      selectCompany: (id) => set({ selectedCompanyId: id }),

      resetDemo: () => set({ ...freshState() }),
    }),
    {
      name: "bpo-automation-store",
      version: 2,
      storage: createJSONStorage(() => ({
        getItem: (name: string) => {
          try {
            return localStorage.getItem(name);
          } catch {
            return null;
          }
        },
        setItem: (name: string, value: string) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            if (e instanceof DOMException) {
              toast.warning("Storage quota exceeded", {
                description:
                  "State will not persist across page reloads. Analyze or push fewer companies to campaigns to reduce storage use.",
                duration: 8000,
                id: "storage-quota",
              });
            }
          }
        },
        removeItem: (name: string) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // ignore
          }
        },
      })),
      partialize: (state) => {
        // Always persist companies that have been analyzed or pushed to campaigns —
        // those have work attached. For raw (pending_analysis, not in campaign)
        // companies, cap at MAX_RAW_PERSISTED to avoid blowing past the ~5 MB
        // localStorage limit on large (40k+) imports.
        const MAX_RAW_PERSISTED = 500;
        const campaignIds = new Set(state.campaigns.map((c) => c.companyId));
        const worked = state.companies.filter(
          (c) => c.status !== "pending_analysis" || campaignIds.has(c.id),
        );
        const raw = state.companies
          .filter(
            (c) => c.status === "pending_analysis" && !campaignIds.has(c.id),
          )
          .slice(0, MAX_RAW_PERSISTED);
        const persistedCompanies = [...worked, ...raw];
        const persistedIds = new Set(persistedCompanies.map((c) => c.id));
        return {
          companies: persistedCompanies,
          stakeholders: state.stakeholders.filter((s) =>
            persistedIds.has(s.companyId),
          ),
          campaigns: state.campaigns,
          deals: state.deals,
          logs: state.logs,
          chat: state.chat,
          clock: { ...state.clock, running: false },
          selectedCompanyId: state.selectedCompanyId,
        };
      },
      onRehydrateStorage: () => (state) => {
        // No analysis can be in flight across a page load, so any lead left in
        // "analyzing" is stale — the result of a run whose stream was cut short
        // (e.g. a navigation/reload mid-analysis). Reset it to "pending_analysis"
        // so the Lead Database view never shows a permanently-stuck row.
        // Deferred so the store singleton is fully assigned before setState.
        if (!state) return;
        if (state.companies.some((c) => c.status === "analyzing")) {
          setTimeout(() => {
            useStore.setState((s) => ({
              companies: s.companies.map((c) =>
                c.status === "analyzing"
                  ? { ...c, status: "pending_analysis" }
                  : c,
              ),
            }));
          }, 0);
        }
      },
    },
  ),
);

// Convenience selectors
export const selectCompany = (id: string) => (s: State) =>
  s.companies.find((c) => c.id === id);

export const selectStakeholdersFor = (companyId: string) => (s: State) =>
  s.stakeholders.filter((st) => st.companyId === companyId);

export const selectCampaign = (companyId: string) => (s: State) =>
  s.campaigns.find((c) => c.companyId === companyId);

export const selectDeal = (companyId: string) => (s: State) =>
  s.deals.find((d) => d.companyId === companyId);

export const selectFunnelCounts = (s: State) => {
  const acquired = s.companies.length;
  const analyzed = s.companies.filter(
    (c) => c.status === "qualified" || c.status === "disqualified",
  ).length;
  const inCampaign = s.campaigns.length;
  const replied = s.campaigns.filter(
    (c) =>
      c.stage === "replied" ||
      c.stage === "meeting_booked",
  ).length;
  const meetingBooked = s.campaigns.filter(
    (c) => c.stage === "meeting_booked",
  ).length;
  return { acquired, analyzed, inCampaign, replied, meetingBooked };
};
