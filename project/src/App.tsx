import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Clock,
  MessageSquare,
  RotateCcw,
  Send,
  Cpu,
} from 'lucide-react';

type ProcessId = 'P1' | 'P2' | 'P3';
type ProcessState = 'Active' | 'Waiting' | 'Sending' | 'Receiving';
type LogKind = 'sent' | 'received' | 'reset';

interface LogEntry {
  id: number;
  time: string;
  from: ProcessId | 'SYSTEM';
  to: ProcessId | 'ALL';
  text: string;
  kind: LogKind;
}

interface Flight {
  id: number;
  from: ProcessId;
  to: ProcessId;
  color: string;
  fromX: number;
  toX: number;
}

const PROCESSES: ProcessId[] = ['P1', 'P2', 'P3'];

const PROCESS_META: Record<ProcessId, { label: string; desc: string; accent: string; dot: string; ring: string; soft: string }> = {
  P1: {
    label: 'Process 1',
    desc: 'Client process',
    accent: 'text-sky-700',
    dot: 'bg-sky-500',
    ring: 'ring-sky-200',
    soft: 'bg-sky-50',
  },
  P2: {
    label: 'Process 2',
    desc: 'Worker process',
    accent: 'text-emerald-700',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    soft: 'bg-emerald-50',
  },
  P3: {
    label: 'Process 3',
    desc: 'Storage process',
    accent: 'text-amber-700',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
    soft: 'bg-amber-50',
  },
};

const FLIGHT_COLORS: Record<ProcessId, string> = {
  P1: '#0284c7',
  P2: '#059669',
  P3: '#d97706',
};

let idCounter = 1;
const nextId = () => idCounter++;

const now = () =>
  new Date().toLocaleTimeString('en-GB', { hour12: false }) +
  '.' +
  String(new Date().getMilliseconds()).padStart(3, '0');

export default function App() {
  const [states, setStates] = useState<Record<ProcessId, ProcessState>>({
    P1: 'Active',
    P2: 'Active',
    P3: 'Active',
  });
  const [messages, setMessages] = useState<Record<ProcessId, number>>({
    P1: 0,
    P2: 0,
    P3: 0,
  });
  const [flights, setFlights] = useState<Flight[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sender, setSender] = useState<ProcessId>('P1');
  const [receiver, setReceiver] = useState<ProcessId>('P3');
  const [autoRunning, setAutoRunning] = useState(false);
  const epochRef = useRef(0);

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'time'>) => {
    setLog((prev) => [{ ...entry, id: nextId(), time: now() }, ...prev].slice(0, 60));
  }, []);

  const updateState = useCallback((pid: ProcessId, next: ProcessState) => {
    setStates((prev) => (prev[pid] === next ? prev : { ...prev, [pid]: next }));
  }, []);

  const sendMessage = useCallback(
    (from: ProcessId, to: ProcessId) => {
      if (from === to) return;
      const flightId = nextId();
      const hop = 900;
      const epoch = epochRef.current;
      const stillCurrent = () => epochRef.current === epoch;

      updateState(from, 'Sending');
      updateState(to, 'Waiting');
      addLog({
        from,
        to,
        text: `send() — message dispatched from ${from} to ${to}`,
        kind: 'sent',
      });

      // halfway: the receiver notices the message and starts reading it
      setTimeout(() => {
        if (!stillCurrent()) return;
        updateState(to, 'Receiving');
        addLog({
          from: to,
          to: from,
          text: `recv() — message from ${from} received by ${to}`,
          kind: 'received',
        });
        setMessages((prev) => ({ ...prev, [to]: prev[to] + 1 }));
      }, hop);

      // fully delivered: both processes settle back to Active
      setTimeout(() => {
        if (!stillCurrent()) return;
        setFlights((prev) => prev.filter((f) => f.id !== flightId));
        setMessages((prev) => ({ ...prev, [from]: prev[from] + 1 }));
        updateState(from, 'Active');
        updateState(to, 'Active');
      }, hop * 2);

      setFlights((prev) => [
        ...prev,
        {
          id: flightId,
          from,
          to,
          color: FLIGHT_COLORS[from],
          fromX: 18 + PROCESSES.indexOf(from) * 32,
          toX: 18 + PROCESSES.indexOf(to) * 32,
        },
      ]);
    },
    [addLog, updateState],
  );

  const handleSend = useCallback(() => {
    sendMessage(sender, receiver);
  }, [sendMessage, sender, receiver]);

  const handleReset = useCallback(() => {
    epochRef.current += 1;
    setFlights([]);
    setStates({ P1: 'Active', P2: 'Active', P3: 'Active' });
    setMessages({ P1: 0, P2: 0, P3: 0 });
    setSender('P1');
    setReceiver('P3');
    setAutoRunning(false);
    addLog({ from: 'SYSTEM', to: 'ALL', text: 'Simulation reset — all processes back to Active', kind: 'reset' });
  }, [addLog]);

  // Auto demo mode: random process pairs exchange messages on a loop
  useEffect(() => {
    if (!autoRunning) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const from = PROCESSES[Math.floor(Math.random() * PROCESSES.length)];
      const options = PROCESSES.filter((p) => p !== from);
      const to = options[Math.floor(Math.random() * options.length)];
      setSender(from);
      setReceiver(to);
      sendMessage(from, to);
      timer = setTimeout(loop, 1600);
    };
    timer = setTimeout(loop, 400);
    return () => clearTimeout(timer);
  }, [autoRunning, sendMessage]);

  const swapEndpoints = (pid: ProcessId) => {
    if (pid === sender) return;
    if (pid === receiver) {
      setReceiver(sender);
      setSender(pid);
    } else {
      setReceiver(pid);
    }
  };

  const statusStyle: Record<ProcessState, string> = {
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Waiting: 'bg-amber-50 text-amber-700 border-amber-200',
    Sending: 'bg-sky-50 text-sky-700 border-sky-200',
    Receiving: 'bg-violet-50 text-violet-700 border-violet-200',
  };

  const pulseDot: Record<ProcessState, string> = {
    Active: 'bg-emerald-500',
    Waiting: 'bg-amber-500',
    Sending: 'bg-sky-500',
    Receiving: 'bg-violet-500',
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                Distributed Process Communication Simulator
              </h1>
              <p className="text-sm text-slate-500">
                Message passing between P1, P2 and P3 — send / receive model
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            {flights.length > 0 ? `${flights.length} message in transit` : 'Channel idle'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left: diagram + controls */}
          <section className="space-y-6">
            {/* Diagram */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Communication Diagram
                </h2>
              </div>
              <div className="relative px-4 pb-8 pt-6 sm:px-8">
                <svg
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                      <polygon points="0 0, 6 2, 0 4" fill="#94a3b8" />
                    </marker>
                  </defs>
                  <line
                    x1="20" y1="18" x2="50" y2="82"
                    stroke="#cbd5e1" strokeWidth="0.3" strokeDasharray="2 1.5"
                    markerEnd="url(#arrowhead)" vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1="50" y1="18" x2="80" y2="82"
                    stroke="#cbd5e1" strokeWidth="0.3" strokeDasharray="2 1.5"
                    markerEnd="url(#arrowhead)" vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1="16" y1="52" x2="84" y2="52"
                    stroke="#cbd5e1" strokeWidth="0.3" strokeDasharray="2 1.5"
                    markerEnd="url(#arrowhead)" vectorEffect="non-scaling-stroke"
                  />
                </svg>

                {/* Animated messages in flight */}
                {flights.map((f) => (
                  <FlightBubble key={f.id} flight={f} duration={1800} />
                ))}

                <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
                  {PROCESSES.map((pid) => {
                    const meta = PROCESS_META[pid];
                    const state = states[pid];
                    const isSender = pid === sender;
                    const isReceiver = pid === receiver;
                    return (
                      <div key={pid} className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => swapEndpoints(pid)}
                          className={`w-full max-w-[200px] rounded-xl border-2 p-4 text-center transition-all duration-200 ${
                            isSender
                              ? 'border-sky-400 bg-sky-50 shadow-md'
                              : isReceiver
                                ? 'border-emerald-400 bg-emerald-50 shadow-md'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                            {pid}
                          </div>
                          <div className="text-sm font-semibold text-slate-800">{meta.label}</div>
                          <div className="text-xs text-slate-500">{meta.desc}</div>
                          <div className="mt-2 text-[11px] font-medium text-slate-400">
                            {isSender ? 'Sender' : isReceiver ? 'Receiver' : 'Tap to set as receiver'}
                          </div>
                        </button>
                        <div
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[state]}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${pulseDot[state]} ${state !== 'Active' ? 'animate-pulse' : ''}`} />
                          {state}
                        </div>
                        <div className="text-[11px] text-slate-400">{messages[pid]} messages handled</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Controls
              </h2>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label htmlFor="sender-select" className="mb-1 block text-xs font-medium text-slate-600">
                    Sender
                  </label>
                  <select
                    id="sender-select"
                    value={sender}
                    onChange={(e) => setSender(e.target.value as ProcessId)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                  >
                    {PROCESSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <ArrowRight className="mb-2.5 h-4 w-4 text-slate-400" />
                <div>
                  <label htmlFor="receiver-select" className="mb-1 block text-xs font-medium text-slate-600">
                    Receiver
                  </label>
                  <select
                    id="receiver-select"
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value as ProcessId)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    {PROCESSES.map((p) => (
                      <option key={p} value={p} disabled={p === sender}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSend}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-95"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
                <button
                  onClick={() => setAutoRunning((r) => !r)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition active:scale-95 ${
                    autoRunning
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  {autoRunning ? 'Stop Auto Traffic' : 'Auto Traffic'}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Click a process card to choose it as the message receiver, or use the dropdowns.
              </p>
            </div>
          </section>

          {/* Right: message log */}
          <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Message Log
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {log.length}
              </span>
            </div>
            <div className="max-h-[420px] min-h-[200px] space-y-2 overflow-y-auto p-4">
              {log.length === 0 ? (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
                  <MessageSquare className="h-8 w-8 text-slate-300" />
                  No messages yet.
                  <span className="text-xs">Press “Send Message” to start communicating.</span>
                </div>
              ) : (
                log.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-3 text-xs leading-relaxed ${
                      entry.kind === 'sent'
                        ? 'border-sky-100 bg-sky-50/60'
                        : entry.kind === 'received'
                          ? 'border-emerald-100 bg-emerald-50/60'
                          : entry.kind === 'reset'
                            ? 'border-slate-200 bg-slate-50'
                            : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">
                        {entry.from === 'SYSTEM' ? 'System' : `${entry.from} → ${entry.to}`}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{entry.time}</span>
                    </div>
                    <p className="text-slate-600">{entry.text}</p>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </aside>
        </div>

        {/* How it works */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            How It Works
          </h2>
          <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-1 font-semibold text-slate-800">1. send()</div>
              The sender process calls <span className="font-mono text-xs">send(msg, receiver)</span> and
              hands the message to the communication channel.
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-1 font-semibold text-slate-800">2. Channel transit</div>
              The message travels through the distributed middleware — shown as the moving bubble in the
              diagram.
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="mb-1 font-semibold text-slate-800">3. recv()</div>
              The receiver calls <span className="font-mono text-xs">recv()</span>, wakes up from its
              waiting state, and both processes return to Active.
            </div>
          </div>
        </section>

        <footer className="py-6 text-center text-xs text-slate-400">
          College mini project — Distributed Process Communication Simulator using message passing
        </footer>
      </main>

    </div>
  );
}

function FlightBubble({ flight, duration }: { flight: Flight; duration: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      [
        { left: `${flight.fromX}%`, transform: 'scale(0.9)' },
        { left: `${(flight.fromX + flight.toX) / 2}%`, transform: 'scale(1.1)' },
        { left: `${flight.toX}%`, transform: 'scale(0.9)' },
      ],
      { duration, easing: 'ease-in-out', fill: 'forwards' },
    );
    return () => anim.cancel();
  }, [flight, duration]);

  return (
    <span
      ref={ref}
      className="pointer-events-none absolute z-10 text-[11px] font-semibold text-white shadow-md"
      style={{
        background: flight.color,
        borderRadius: '9999px',
        padding: '2px 10px',
        left: `${flight.fromX}%`,
        top: '38px',
      }}
    >
      msg
    </span>
  );
}
