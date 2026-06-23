"use client";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "@/lib/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { ClientOnly } from "@/components/ui/client-only";

function ChartSkeleton() {
  return (
    <div className="h-full w-full rounded-md bg-surface-2/60 animate-pulse" />
  );
}

const FUNNEL_STAGES = [
  { key: "acquired", label: "Acquired", color: "#0d9488" },
  { key: "analyzed", label: "Analyzed", color: "#2563eb" },
  { key: "inCampaign", label: "In Campaign", color: "#16a34a" },
  { key: "replied", label: "Replied", color: "#d97706" },
  { key: "meetingBooked", label: "Meeting Booked", color: "#7c3aed" },
] as const;

export function FunnelChart() {
  const counts = useStore(
    useShallow((s) => {
      const acquired = s.companies.length;
      const analyzed = s.companies.filter(
        (c) => c.status === "qualified" || c.status === "disqualified",
      ).length;
      const inCampaign = s.campaigns.length;
      const replied = s.campaigns.filter(
        (c) => c.stage === "replied" || c.stage === "meeting_booked",
      ).length;
      const meetingBooked = s.campaigns.filter(
        (c) => c.stage === "meeting_booked",
      ).length;
      return { acquired, analyzed, inCampaign, replied, meetingBooked };
    }),
  );

  const data = FUNNEL_STAGES.map((s) => ({
    name: s.label,
    value: counts[s.key],
    fill: s.color,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>
          Companies flowing through each layer of the workflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ClientOnly fallback={<ChartSkeleton />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} stroke="#52525b" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #e4e4e7",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </ClientOnly>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChannelPerformanceChart() {
  const counts = useStore(
    useShallow((s) => {
      let linkedinSent = 0,
        linkedinReplied = 0,
        emailSent = 0,
        emailReplied = 0;
      for (const c of s.campaigns) {
        for (const t of c.touchpoints) {
          if (t.type === "reply_received") {
            // attribute reply to the channel the previous touchpoint used for that step
            const prev = c.touchpoints
              .filter(
                (p) => p.step === t.step && p.type !== "reply_received",
              )
              .at(-1);
            if (prev?.channel === "linkedin") linkedinReplied++;
            else if (prev?.channel === "email") emailReplied++;
          } else {
            if (t.channel === "linkedin") linkedinSent++;
            else if (t.channel === "email") emailSent++;
          }
        }
      }
      return { linkedinSent, linkedinReplied, emailSent, emailReplied };
    }),
  );

  const data = [
    { name: "LinkedIn", sent: counts.linkedinSent, replied: counts.linkedinReplied },
    { name: "Email", sent: counts.emailSent, replied: counts.emailReplied },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Performance</CardTitle>
        <CardDescription>
          Outbound touchpoints sent vs replies received.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ClientOnly fallback={<ChartSkeleton />}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#52525b" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#a1a1aa" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: "1px solid #e4e4e7",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="sent" name="Sent" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="replied" name="Replied" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </ClientOnly>
        </div>
      </CardContent>
    </Card>
  );
}

export function LayerActivityPie() {
  const byLayer = useStore(
    useShallow((s) => {
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<1 | 2 | 3 | 4, number>;
      for (const l of s.logs) counts[l.layer]++;
      return counts;
    }),
  );

  const data = [
    { name: "L1 · Data", value: byLayer[1], fill: "#0d9488" },
    { name: "L2 · AI Brain", value: byLayer[2], fill: "#2563eb" },
    { name: "L3 · Engagement", value: byLayer[3], fill: "#16a34a" },
    { name: "L4 · CRM", value: byLayer[4], fill: "#7c3aed" },
  ];

  const total = data.reduce((a, b) => a + b.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity by Layer</CardTitle>
        <CardDescription>Where events are being generated in the workflow.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          {total === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-fg-muted">
              No activity yet.
            </div>
          ) : (
            <ClientOnly fallback={<ChartSkeleton />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={40}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: "1px solid #e4e4e7",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            </ClientOnly>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
