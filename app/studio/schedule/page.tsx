"use client";

import { useCallback, useEffect, useState } from "react";
import { studioApi } from "@/lib/api/studio";
import { useAuth } from "@/lib/auth/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PlusIcon,
  ListIcon,
  CalendarIcon,
  PencilIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  UsersIcon,
} from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked_count: number;
  status: string;
  base_credit_cost?: number;
  service?: { id: string; name: string; slug?: string; duration_minutes?: number };
  provider?: { id: string; name: string; avatar_url?: string };
}

interface Service {
  id: string;
  name: string;
  credit_price: number;
  duration_minutes: number;
  capacity: number;
}

interface Provider {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  full: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

type ViewMode = "list" | "calendar";

export default function SchedulePage() {
  const { roles } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("calendar");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Form state
  const [form, setForm] = useState({
    service_id: "",
    provider_id: "",
    date: "",
    start_time: "",
    end_time: "",
    capacity: "",
    base_credit_cost: "",
  });

  const entityId = roles?.ownedEntities?.[0]?.entityId;
  const currentRole = roles?.ownedEntities?.[0]?.role;
  const canManage = currentRole === "manager" || currentRole === "owner" || roles?.isAdmin;

  const fetchSessions = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await studioApi.getSessions(entityId, { page, limit: 50 });
      setSessions(res.data);
      setTotal(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityId, page]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Load services + providers for create form
  useEffect(() => {
    if (!entityId) return;
    Promise.all([
      studioApi.getServices(entityId),
      studioApi.getProviders(entityId),
    ]).then(([sRes, pRes]) => {
      setServices(sRes.data);
      setProviders(pRes.data);
    }).catch(console.error);
  }, [entityId]);

  const openCreate = () => {
    setEditingSession(null);
    setForm({ service_id: "", provider_id: "", date: "", start_time: "", end_time: "", capacity: "", base_credit_cost: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: Session) => {
    setEditingSession(s);
    const d = new Date(s.start_time);
    const dateStr = d.toISOString().split("T")[0];
    const startStr = d.toTimeString().slice(0, 5);
    const endStr = new Date(s.end_time).toTimeString().slice(0, 5);
    setForm({
      service_id: s.service?.id || "",
      provider_id: s.provider?.id || "",
      date: dateStr,
      start_time: startStr,
      end_time: endStr,
      capacity: String(s.capacity),
      base_credit_cost: String(s.base_credit_cost || ""),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!entityId) return;
    setSaving(true);
    try {
      const payload = {
        service_id: form.service_id,
        provider_id: form.provider_id || null,
        start_time: `${form.date}T${form.start_time}:00Z`,
        end_time: `${form.date}T${form.end_time}:00Z`,
        capacity: parseInt(form.capacity),
        base_credit_cost: parseInt(form.base_credit_cost) || 5,
      };

      if (editingSession) {
        await studioApi.updateSession(entityId, editingSession.id, payload);
      } else {
        await studioApi.createSession(entityId, payload);
      }
      setDialogOpen(false);
      fetchSessions();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!entityId || !confirm("Cancel this session?")) return;
    try {
      await studioApi.deleteSession(entityId, sessionId);
      fetchSessions();
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-fill capacity and credit cost when service is selected
  const handleServiceChange = (serviceId: string) => {
    setForm((prev) => {
      const service = services.find((s) => s.id === serviceId);
      return {
        ...prev,
        service_id: serviceId,
        capacity: service ? String(service.capacity) : prev.capacity,
        base_credit_cost: service ? String(service.credit_price) : prev.base_credit_cost,
        end_time: service && prev.start_time
          ? addMinutes(prev.start_time, service.duration_minutes)
          : prev.end_time,
      };
    });
  };

  // Calendar helpers
  const calendarWeekStart = getWeekStart(calendarDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(calendarWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const sessionsByDay = (day: Date) => {
    const dayStr = day.toISOString().split("T")[0];
    return sessions.filter((s) => s.start_time.startsWith(dayStr))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  // List view columns
  const columns: Column<Session>[] = [
    {
      header: "Service",
      cell: (row) => <span className="font-medium">{row.service?.name || "N/A"}</span>,
    },
    {
      header: "Instructor",
      cell: (row) => <span>{row.provider?.name || "—"}</span>,
    },
    {
      header: "Date & Time",
      cell: (row) => (
        <div className="text-sm">
          <p>{new Date(row.start_time).toLocaleDateString()}</p>
          <p className="text-muted-foreground">
            {new Date(row.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" — "}
            {new Date(row.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ),
    },
    {
      header: "Capacity",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <UsersIcon className="size-3.5 text-muted-foreground" />
          <span>{row.booked_count}/{row.capacity}</span>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge variant="outline" className={statusColors[row.status] || ""}>
          {row.status}
        </Badge>
      ),
    },
    ...(canManage ? [{
      header: "",
      cell: (row: Session) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(row)}>
            <PencilIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(row.id)}>
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} sessions</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-lg overflow-hidden">
            <Button
              variant={view === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setView("calendar")}
            >
              <CalendarIcon className="size-4 mr-1.5" />
              Calendar
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setView("list")}
            >
              <ListIcon className="size-4 mr-1.5" />
              List
            </Button>
          </div>
          {canManage && (
            <Button onClick={openCreate}>
              <PlusIcon className="size-4 mr-2" />
              New Session
            </Button>
          )}
        </div>
      </div>

      {/* Calendar View */}
      {view === "calendar" && (
        <div>
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => {
              const d = new Date(calendarDate);
              d.setDate(d.getDate() - 7);
              setCalendarDate(d);
            }}>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <h2 className="text-sm font-medium">
              {weekDays[0].toLocaleDateString("en-US", { month: "long", day: "numeric" })}
              {" — "}
              {weekDays[6].toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => {
              const d = new Date(calendarDate);
              d.setDate(d.getDate() + 7);
              setCalendarDate(d);
            }}>
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const daySessions = sessionsByDay(day);
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div key={day.toISOString()} className="min-h-[200px]">
                  <div className={`text-center py-2 rounded-t-lg text-sm font-medium ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <p className="text-xs opacity-70">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                    <p>{day.getDate()}</p>
                  </div>
                  <div className="border border-t-0 border-border rounded-b-lg p-1 space-y-1 min-h-[160px]">
                    {daySessions.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center mt-8">No sessions</p>
                    )}
                    {daySessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => canManage ? openEdit(s) : undefined}
                        className={`w-full text-left p-1.5 rounded text-[11px] leading-tight transition-colors ${
                          s.status === "cancelled"
                            ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                            : s.status === "full"
                              ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                              : "bg-primary/5 hover:bg-primary/10 text-foreground"
                        }`}
                      >
                        <p className="font-medium truncate">{s.service?.name || "Session"}</p>
                        <p className="opacity-70">
                          {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {" · "}{s.booked_count}/{s.capacity}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <DataTable
          columns={columns}
          data={sessions}
          total={total}
          page={page}
          pageSize={50}
          onPageChange={setPage}
          isLoading={loading}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Create Session"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Service *</label>
              <Select value={form.service_id} onValueChange={handleServiceChange}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes}min, {s.credit_price} credits)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Instructor</label>
              <Select value={form.provider_id} onValueChange={(v) => setForm({ ...form, provider_id: v })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="No instructor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No instructor</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Date *</label>
              <Input
                type="date"
                className="mt-1.5"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Start Time *</label>
                <Input
                  type="time"
                  className="mt-1.5"
                  value={form.start_time}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const service = services.find((s) => s.id === form.service_id);
                    setForm({
                      ...form,
                      start_time: newStart,
                      end_time: service ? addMinutes(newStart, service.duration_minutes) : form.end_time,
                    });
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time *</label>
                <Input
                  type="time"
                  className="mt-1.5"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Capacity *</label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  min="1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Credit Cost</label>
                <Input
                  type="number"
                  className="mt-1.5"
                  value={form.base_credit_cost}
                  onChange={(e) => setForm({ ...form, base_credit_cost: e.target.value })}
                  min="1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.service_id || !form.date || !form.start_time || !form.end_time || !form.capacity}
              >
                {saving ? "Saving..." : editingSession ? "Update Session" : "Create Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helpers
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
