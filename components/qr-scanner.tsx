"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, RefreshCw, CheckCircle, X, WifiOff, CloudUpload, Clock } from "lucide-react";

interface QRScannerProps {
  eventId: string;
  onCheckIn?: (guestName: string) => void;
}

interface CameraDevice {
  id: string;
  label: string;
}

interface CheckInResult {
  guestName: string;
  category?: string;
  plusOnes?: { id: string; name: string; checkedIn: boolean }[];
}

interface CachedGuest {
  id: string;
  qrToken: string;
  fullName: string;
  salutation: string | null;
  company: string;
  category: string;
  attendanceStatus: string;
  plusOnes: { id: string; name: string; checkedIn: boolean }[];
}

interface QueuedCheckIn {
  token: string;
  eventId: string;
  timestamp: number;
  guestName: string;
}

const CACHE_KEY = (eventId: string) => `checkin_cache_${eventId}`;
const QUEUE_KEY = (eventId: string) => `checkin_queue_${eventId}`;

function loadCache(eventId: string): CachedGuest[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY(eventId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCache(eventId: string, guests: CachedGuest[]) {
  try {
    localStorage.setItem(CACHE_KEY(eventId), JSON.stringify(guests));
  } catch {
    // storage full — skip
  }
}

function loadQueue(eventId: string): QueuedCheckIn[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY(eventId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(eventId: string, queue: QueuedCheckIn[]) {
  try {
    localStorage.setItem(QUEUE_KEY(eventId), JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function QRScanner({ eventId, onCheckIn }: QRScannerProps) {
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [lastCheckIn, setLastCheckIn] = useState<CheckInResult | null>(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const scannerRef = useRef<unknown>(null);
  const processingRef = useRef(false);
  const checkedInTokens = useRef<Set<string>>(new Set());

  // Initialise queue count client-side only
  useEffect(() => {
    setQueuedCount(loadQueue(eventId).length);
  }, [eventId]);

  // Online/offline listeners
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      syncQueue();
    }
    function handleOffline() {
      setIsOffline(true);
      toast.warning("You are offline. Check-ins will be queued and synced when reconnected.", {
        id: "offline-warn",
        duration: 5000,
      });
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchCache() {
    try {
      const res = await fetch(`/api/events/${eventId}/guests/cache`, { cache: "no-store" });
      if (res.ok) {
        const guests: CachedGuest[] = await res.json();
        saveCache(eventId, guests);
      }
    } catch {
      // offline — use existing cache
    }
  }

  async function loadCameras() {
    const { Html5Qrcode } = await import("html5-qrcode");
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      if (devices.length > 0) {
        const preferred =
          devices.find((d) => /back|environ|rear/i.test(d.label)) ?? devices[0];
        setSelectedCamera((prev) => prev || preferred.id);
      }
    } catch {
      toast.error("Could not access cameras. Please allow camera permission.");
    }
  }

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current as {
        stop: () => Promise<void>;
        clear: () => void;
      };
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // already stopped
      }
      scannerRef.current = null;
    }
    setScanning(false);
    processingRef.current = false;
  }, []);

  // Sync queued offline check-ins
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function syncQueue() {
    const queue = loadQueue(eventId);
    if (queue.length === 0) return;
    setSyncing(true);
    const remaining: QueuedCheckIn[] = [];
    let synced = 0;
    for (const item of queue) {
      try {
        const res = await fetch("/api/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: item.token, eventId: item.eventId }),
        });
        if (res.ok) { synced++; } else { remaining.push(item); }
      } catch {
        remaining.push(item);
      }
    }
    saveQueue(eventId, remaining);
    setQueuedCount(remaining.length);
    setSyncing(false);
    if (synced > 0) {
      toast.success(`Synced ${synced} offline check-in${synced > 1 ? "s" : ""} to server`);
      onCheckIn?.("sync");
      await fetchCache();
    }
  }

  const startScanner = useCallback(async () => {
    const { Html5Qrcode } = await import("html5-qrcode");
    const cameraId = selectedCamera || cameras[0]?.id;
    if (!cameraId) {
      toast.error("No camera found. Please check browser permissions.");
      return;
    }

    const scanner = new Html5Qrcode("qr-reader-dialog");

    try {
      await scanner.start(
        { deviceId: { exact: cameraId } },
        { fps: 15, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        async (decodedText: string) => {
          if (processingRef.current) return;
          processingRef.current = true;
          setProcessing(true);

          let token = decodedText;
          try {
            const url = new URL(decodedText);
            token = url.searchParams.get("token") ?? decodedText;
          } catch {
            // raw token
          }

          if (checkedInTokens.current.has(token)) {
            toast.warning("Already checked in this session", { id: `dup-${token}` });
            setProcessing(false);
            setTimeout(() => { processingRef.current = false; }, 2000);
            return;
          }

          if (navigator.onLine) {
            try {
              const res = await fetch("/api/check-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, eventId }),
              });
              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error ?? "Check-in failed");
              } else {
                const result: CheckInResult = {
                  guestName: data.guestName,
                  category: data.category,
                  plusOnes: data.plusOnes,
                };
                setLastCheckIn(result);
                checkedInTokens.current.add(token);
                const cached = loadCache(eventId);
                saveCache(eventId, cached.map((g) =>
                  g.qrToken === token ? { ...g, attendanceStatus: "CONFIRMED_PRESENT" } : g,
                ));
                toast.success(
                  data.alreadyCheckedIn
                    ? `${data.guestName} already checked in`
                    : `✓ ${data.guestName} checked in!`
                );
                onCheckIn?.(data.guestName);
              }
            } catch {
              toast.error("Check-in failed. Please try again.");
            }
          } else {
            // Offline fallback
            const cache = loadCache(eventId);
            const guest = cache.find((g) => g.qrToken === token);
            if (!guest) {
              toast.error("Guest not found in offline cache.");
            } else if (guest.attendanceStatus === "CONFIRMED_PRESENT") {
              toast.warning(`${guest.fullName} already checked in (offline)`);
            } else {
              const queue = loadQueue(eventId);
              queue.push({ token, eventId, timestamp: Date.now(), guestName: guest.fullName });
              saveQueue(eventId, queue);
              setQueuedCount(queue.length);
              saveCache(eventId, cache.map((g) =>
                g.qrToken === token ? { ...g, attendanceStatus: "CONFIRMED_PRESENT" } : g,
              ));
              checkedInTokens.current.add(token);
              setLastCheckIn({ guestName: guest.fullName, category: guest.category, plusOnes: guest.plusOnes });
              toast.success(`✓ ${guest.fullName} (offline — will sync)`);
              onCheckIn?.(guest.fullName);
            }
          }

          setProcessing(false);
          setTimeout(() => { processingRef.current = false; }, 2000);
        },
        () => { /* ignore per-frame errors */ }
      );

      scannerRef.current = scanner;
      setScanning(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start camera");
    }
  }, [selectedCamera, cameras, eventId, onCheckIn]);

  useEffect(() => {
    loadCameras();
    fetchCache();
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open && !scanning && cameras.length > 0) {
      const t = setTimeout(() => startScanner(), 150);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cameras]);

  async function handleClose() {
    await stopScanner();
    setOpen(false);
  }

  async function handleCameraChange(newId: string) {
    setSelectedCamera(newId);
    if (scanning) {
      await stopScanner();
      setTimeout(() => startScanner(), 150);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={() => setOpen(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Open QR Scanner
          </Button>
          {isOffline && (
            <span className="flex items-center gap-1.5 text-xs text-yellow-700 bg-yellow-100 rounded-full px-3 py-1 font-medium">
              <WifiOff className="h-3.5 w-3.5" />
              Offline mode
            </span>
          )}
          {queuedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={syncQueue}
              disabled={syncing || isOffline}
              className="gap-1.5 text-xs"
            >
              {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
              Sync {queuedCount} queued
            </Button>
          )}
        </div>

        {lastCheckIn && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50 max-w-sm">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Last check-in</p>
              <p className="text-green-700 font-medium">{lastCheckIn.guestName}</p>
              {lastCheckIn.category && <p className="text-xs text-green-600">{lastCheckIn.category}</p>}
              {lastCheckIn.plusOnes && lastCheckIn.plusOnes.length > 0 && (
                <p className="text-xs text-green-600">+{lastCheckIn.plusOnes.length}: {lastCheckIn.plusOnes.map(p => p.name).join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent
          className="sm:max-w-lg p-0 overflow-hidden"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-5 pt-5 pb-3 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Webcam QR Check-In
              {processing && (
                <span className="text-xs font-normal text-muted-foreground animate-pulse ml-2">Processing…</span>
              )}
              {isOffline && (
                <span className="flex items-center gap-1 text-[11px] text-yellow-700 bg-yellow-100 rounded-full px-2 py-0.5 font-medium ml-1">
                  <WifiOff className="h-3 w-3" /> Offline
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {scanning && (
                <Button size="icon" variant="ghost" title="Restart camera"
                  onClick={async () => { await stopScanner(); setTimeout(startScanner, 150); }}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          {cameras.length > 1 && (
            <div className="px-5 pb-3">
              <Select value={selectedCamera} onValueChange={handleCameraChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select camera…" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((cam) => (
                    <SelectItem key={cam.id} value={cam.id}>
                      {cam.label || `Camera ${cam.id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative bg-black">
            <div id="qr-reader-dialog" style={{ width: "100%", minHeight: 420 }} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-64">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />
              </div>
            </div>
          </div>

          {lastCheckIn ? (
            <div className="px-5 py-4 flex items-center gap-3 border-t bg-green-50">
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 text-sm">{lastCheckIn.guestName}</p>
                <p className="text-xs text-green-600">
                  {[lastCheckIn.category, ...(lastCheckIn.plusOnes?.map(p => `+1: ${p.name}`) ?? [])]
                    .filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 text-center border-t">
              {isOffline ? (
                <p className="text-xs text-yellow-700 flex items-center justify-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Offline — check-ins will be queued ({queuedCount} pending)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Hold a guest QR code up to the camera to check them in
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

