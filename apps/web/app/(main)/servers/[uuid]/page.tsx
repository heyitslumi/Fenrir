'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { api, type EggConfig } from '@/lib/api';
import Editor from '@monaco-editor/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { getAccessToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import { Input } from '@workspace/ui/components/input';
import { Skeleton } from '@workspace/ui/components/skeleton';
import {
  ArrowLeftIcon,
  PlayIcon,
  SquareIcon,
  RotateCcwIcon,
  SkullIcon,
  SendIcon,
  TerminalIcon,
  FolderIcon,
  FileIcon,
  FileTextIcon,
  DownloadIcon,
  UploadIcon,
  CoinsIcon,
  TrashIcon,
  PlusIcon,
  ArchiveIcon,
  SaveIcon,
  XIcon,
  ChevronRightIcon,
  HomeIcon,
  CpuIcon,
  MemoryStickIcon,
  HardDriveIcon,
  NetworkIcon,
  ClockIcon,
  SettingsIcon,
  DatabaseIcon,
  PencilIcon,
  RefreshCcwIcon,
  SearchIcon,
  MinusIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  Puzzle as PuzzleIcon,
} from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';

type Tab = 'console' | 'files' | 'backups' | 'startup' | 'resources' | 'settings' | 'activity' | 'plugins';

interface FileEntry {
  name: string;
  mode: string;
  size: number;
  directory: boolean;
  file: boolean;
  symlink: boolean;
  mime: string;
  created: string;
  modified: string;
}

function normalizeServerFsPath(raw?: string | null): string {
  if (!raw?.trim()) return '/';
  let path = raw.trim();
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

function isTextLikeFile(file: FileEntry): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return (
    ['txt', 'json', 'yml', 'yaml', 'toml', 'cfg', 'conf', 'ini', 'properties', 'log', 'xml', 'html', 'css', 'js', 'ts', 'java', 'py', 'sh', 'bat', 'md', 'env', 'csv'].includes(ext) ||
    file.mime?.startsWith('text/') ||
    file.size < 512000
  );
}

function Sparkline({ data, max, color = 'currentColor', className = '' }: { data: number[]; max?: number; color?: string; className?: string }) {
  const ceiling = max ?? Math.max(...data, 1);
  const w = 200;
  const h = 48;
  const pad = data.length < 2 ? [] : data;
  const step = pad.length > 1 ? w / (pad.length - 1) : w;
  const pts = pad.map((v, i) => `${i * step},${h - (Math.min(v, ceiling) / ceiling) * (h * 0.85)}`).join(' ');
  const fill = pad.length > 1 ? `0,${h} ${pts} ${(pad.length - 1) * step},${h}` : '';
  const id = `sp-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full ${className}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={fill} fill={`url(#${id})`} />}
      {pad.length > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0.6" />}
    </svg>
  );
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uuid = params.uuid as string;
  const { resolvedTheme } = useTheme();

  const searchParams = useSearchParams();
  const validTabs: Tab[] = ['console', 'files', 'backups', 'startup', 'resources', 'settings', 'activity'];
  const searchTab = searchParams.get('tab') as Tab | null;
  const initialTab = validTabs.includes(searchTab as Tab) ? (searchTab as Tab) : 'console';
  const filesPathParam = normalizeServerFsPath(searchParams.get('path'));
  const editingFileParam = searchParams.get('file');
  const [tab, setTabState] = useState<Tab>(initialTab);
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', t);
    window.history.replaceState({}, '', url.toString());
  }, []);
  const [server, setServer] = useState<any>(null);
  const [resources, setResources] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const MAX_HISTORY = 30;
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [diskHistory, setDiskHistory] = useState<number[]>([]);
  const [netHistory, setNetHistory] = useState<number[]>([]);

  // Console state
  const [commandInput, setCommandInput] = useState('');
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const historyBufferRef = useRef<string[]>([]);
  const logsSentRef = useRef(false);
  const [fontSize, setFontSize] = useState(14);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Files state
  const [currentPath, setCurrentPath] = useState(filesPathParam);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileSaving, setFileSaving] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadDialogFile, setUploadDialogFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [originalFileContent, setOriginalFileContent] = useState('');
  const [breadcrumbEntries, setBreadcrumbEntries] = useState<Record<string, FileEntry[]>>({});
  const [breadcrumbLoading, setBreadcrumbLoading] = useState<string | null>(null);
  const [breadcrumbSearch, setBreadcrumbSearch] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveFileRef = useRef<() => void>(() => {});

  // Backups state
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupName, setBackupName] = useState('');

  // Startup state
  const [startupVars, setStartupVars] = useState<any[]>([]);
  const [startupLoading, setStartupLoading] = useState(false);
  const [varEdits, setVarEdits] = useState<Record<string, string>>({});
  const [dockerImage, setDockerImage] = useState('');

  // Settings state
  const [renameValue, setRenameValue] = useState('');

  // Activity state
  const [activities, setActivities] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Plugins state
  const [pluginSearch, setPluginSearch] = useState('');
  const [pluginResults, setPluginResults] = useState<any[]>([]);
  const [pluginSearching, setPluginSearching] = useState(false);
  const [pluginProgress, setPluginProgress] = useState<Record<string, { label: string; pct: number }>>({});
  const [pluginMsg, setPluginMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pluginLoader, setPluginLoader] = useState('');
  const [pluginCategory, setPluginCategory] = useState('');
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set());
  const [installedPluginFiles, setInstalledPluginFiles] = useState<any[]>([]);

  // Egg logo + config
  const [eggLogo, setEggLogo] = useState<string | null>(null);
  const [matchedEgg, setMatchedEgg] = useState<EggConfig | null>(null);

  const token = getAccessToken();

  const updateFilesLocation = useCallback((nextPath: string, nextFile?: string | null) => {
    const normalizedPath = normalizeServerFsPath(nextPath);
    setCurrentPath(normalizedPath);
    if (!nextFile) {
      setEditingFile(null);
      setFileContent('');
      setOriginalFileContent('');
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'files');
    url.searchParams.set('path', normalizedPath);
    if (nextFile) {
      url.searchParams.set('file', nextFile);
    } else {
      url.searchParams.delete('file');
    }
    window.history.pushState({}, '', url.toString());
  }, []);

  const loadBreadcrumbEntries = useCallback(async (dir: string) => {
    if (!token) return;
    if (breadcrumbEntries[dir]) return;
    setBreadcrumbLoading(dir);
    try {
      const res = await api.servers.files.list(token, uuid, dir);
      const list = res?.entries?.data ?? res?.data ?? res?.files ?? res ?? [];
      setBreadcrumbEntries((prev) => ({ ...prev, [dir]: Array.isArray(list) ? list : [] }));
    } catch {
      setBreadcrumbEntries((prev) => ({ ...prev, [dir]: [] }));
    } finally {
      setBreadcrumbLoading((current) => (current === dir ? null : current));
    }
  }, [breadcrumbEntries, token, uuid]);

  useEffect(() => {
    const nextTab = validTabs.includes(searchTab as Tab) ? (searchTab as Tab) : 'console';
    setTabState(nextTab);
  }, [searchTab]);

  useEffect(() => {
    setCurrentPath(filesPathParam);
  }, [filesPathParam]);

  // Load server details
  const loadServer = useCallback(async () => {
    if (!token) return;
    try {
      const [data, eggsData] = await Promise.all([
        api.servers.get(token, uuid),
        api.servers.eggs(token),
      ]);
      setServer(data.server);
      setResources(data.resources);
      setRenameValue(data.server?.name || '');
      console.log('[loadServer] container:', data.server?.container, '| docker_image:', data.server?.docker_image, '| image:', data.server?.image);
      setDockerImage((prev) => prev || data.server?.container?.image || data.server?.docker_image || data.server?.image || '');
      const eggUuid = data.server?.egg?.uuid;
      if (eggUuid && eggsData) {
        const match = eggsData.find((e: EggConfig) => e.remoteUuid === eggUuid);
        if (match) {
          if (match.logo) setEggLogo(match.logo);
          setMatchedEgg(match);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, uuid]);

  useEffect(() => { loadServer(); }, [loadServer]);

  // Single WebSocket — handles stats + console + logs
  const connectWs = useCallback(async () => {
    if (!token || wsRef.current) return;
    try {
      const ws = await api.servers.websocket(token, uuid);
      const wsUrl = typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? ws.url.replace(/^ws:/, 'wss:') : ws.url;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        socket.send(JSON.stringify({ event: 'auth', args: [ws.token] }));
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'auth success') {
            setWsConnected(true);
            socket.send(JSON.stringify({ event: 'send stats', args: [null] }));
            socket.send(JSON.stringify({ event: 'send logs', args: [null] }));
            logsSentRef.current = true;
          } else if (data.event === 'console output') {
            const lines = Array.isArray(data.args) ? data.args : [data.args];
            for (const line of lines) {
              if (typeof line === 'string') {
                if (xtermRef.current) {
                  xtermRef.current.writeln(line);
                } else {
                  historyBufferRef.current.push(line);
                  if (historyBufferRef.current.length > 5000) historyBufferRef.current.shift();
                }
                if (!eulaDismissedRef.current && /you need to agree to the eula/i.test(line)) {
                  setShowEula(true);
                }
              }
            }
          } else if (data.event === 'install output') {
            const lines = Array.isArray(data.args) ? data.args : [data.args];
            for (const line of lines) {
              if (typeof line === 'string') {
                xtermRef.current?.writeln(`\x1b[33m[Install]\x1b[0m ${line}`);
              }
            }
          } else if (data.event === 'daemon error') {
            const msg = data.args?.[0] || 'Unknown daemon error';
            xtermRef.current?.writeln(`\x1b[31m[Error]\x1b[0m ${msg}`);
          } else if (data.event === 'status') {
            const state = data.args?.[0] || data.args;
            setResources((prev: any) => ({ ...(prev || {}), state }));
          } else if (data.event === 'stats') {
            try {
              const stats = typeof data.args?.[0] === 'string' ? JSON.parse(data.args[0]) : data.args?.[0];
              if (stats) {
                setResources((prev: any) => ({ ...(prev || {}), ...stats }));
                setCpuHistory(h => [...h.slice(-(MAX_HISTORY - 1)), stats.cpu_absolute ?? 0]);
                setMemHistory(h => [...h.slice(-(MAX_HISTORY - 1)), stats.memory_bytes ?? 0]);
                setDiskHistory(h => [...h.slice(-(MAX_HISTORY - 1)), stats.disk_bytes ?? 0]);
                const net = (stats.network?.tx_bytes ?? 0) + (stats.network?.rx_bytes ?? 0);
                setNetHistory(h => [...h.slice(-(MAX_HISTORY - 1)), net]);
              }
            } catch { /* ignore */ }
          } else if (data.event === 'token expiring') {
            api.servers.websocket(token, uuid).then((newWs) => {
              socket.send(JSON.stringify({ event: 'auth', args: [newWs.token] }));
            }).catch(() => {});
          }
        } catch { /* ignore */ }
      };

      socket.onclose = () => {
        setWsConnected(false); wsRef.current = null; logsSentRef.current = false;
        if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
        wsReconnectRef.current = setTimeout(() => { connectWs(); }, 3000);
      };
      socket.onerror = () => { setWsConnected(false); wsRef.current = null; };
      wsRef.current = socket;
    } catch (err: any) {
      console.error('WS error:', err);
    }
  }, [token, uuid]);

  // Connect once after server loads — don't reconnect on every server state update
  const serverLoadedRef = useRef(false);
  useEffect(() => {
    if (server && !serverLoadedRef.current) {
      serverLoadedRef.current = true;
      connectWs();
    }
    return () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (wsReconnectRef.current) { clearTimeout(wsReconnectRef.current); wsReconnectRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  // xterm.js initialization via callback ref
  const terminalCallbackRef = useCallback((node: HTMLDivElement | null) => {
    terminalRef.current = node;
    if (!node) return;
    if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null; }

    const term = new Terminal({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#09090b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        selectionBackground: '#27272a',
        black: '#09090b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa',
      },
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(node);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Write any buffered history that arrived before xterm was ready
    if (historyBufferRef.current.length > 0) {
      for (const line of historyBufferRef.current) {
        term.writeln(line);
      }
    }

    // Handle user input — send as command
    let inputBuffer = '';
    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\n');
        if (inputBuffer.trim()) {
          const t = getAccessToken();
          if (t) api.servers.command(t, uuid, inputBuffer.trim()).catch(() => {});
        }
        inputBuffer = '';
      } else if (data === '\x7f') {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data >= ' ') {
        inputBuffer += data;
        term.write(data);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
  }, [uuid]);

  // Fit terminal when tab switches to console
  useEffect(() => {
    if (tab === 'console' && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [tab]);

  // Cleanup xterm on unmount
  useEffect(() => {
    return () => {
      if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null; }
    };
  }, []);

  // Send command via input box (fallback)
  const sendCommand = async () => {
    if (!commandInput.trim() || !token) return;
    try {
      await api.servers.command(token, uuid, commandInput.trim());
      setCommandInput('');
    } catch { /* ignore */ }
  };

  // Power actions
  const sendPower = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
    if (!token) return;
    try {
      await api.servers.power(token, uuid, action);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Files ──

  const loadFiles = useCallback(async (dir: string) => {
    if (!token) return;
    setFilesLoading(true);
    setSelectedFiles(new Set());
    try {
      const res = await api.servers.files.list(token, uuid, dir);
      const list = res?.entries?.data ?? res?.data ?? res?.files ?? res ?? [];
      setFiles(Array.isArray(list) ? list : []);
      setCurrentPath(dir);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFilesLoading(false);
    }
  }, [token, uuid]);

  const openFile = async (filePath: string) => {
    if (!token) return;
    try {
      const res = await api.servers.files.contents(token, uuid, filePath);
      const content = typeof res === 'string' ? res : res?.content ?? JSON.stringify(res, null, 2);
      setFileContent(content);
      setOriginalFileContent(content);
      setEditingFile(filePath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveFile = async () => {
    if (!token || !editingFile) return;
    setFileSaving(true);
    try {
      await api.servers.files.write(token, uuid, editingFile, fileContent);
      setOriginalFileContent(fileContent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFileSaving(false);
    }
  };
  saveFileRef.current = saveFile;

  const uploadFiles = async (fileList: FileList) => {
    if (!token || fileList.length === 0) return;
    setUploading(true);
    try {
      const res = await api.servers.files.uploadUrl(token, uuid);
      const uploadUrl = res?.attributes?.url ?? res?.url;
      if (!uploadUrl) throw new Error('Failed to get upload URL');
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.append('files', file);
        const uploadRes = await fetch(`${uploadUrl}&directory=${encodeURIComponent(currentPath)}`, {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) throw new Error(`Upload failed for ${file.name}`);
      }
      loadFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteSelectedFiles = async () => {
    if (!token || selectedFiles.size === 0) return;
    if (!confirm(`Delete ${selectedFiles.size} file(s)?`)) return;
    try {
      await api.servers.files.deleteFiles(token, uuid, currentPath, Array.from(selectedFiles));
      loadFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteFilesByName = async (names: string[]) => {
    if (!token || names.length === 0) return;
    if (!confirm(`Delete ${names.length} item(s)?`)) return;
    try {
      await api.servers.files.deleteFiles(token, uuid, currentPath, names);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        names.forEach((name) => next.delete(name));
        return next;
      });
      loadFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createFolder = async () => {
    if (!token || !newFolderName.trim()) return;
    try {
      await api.servers.files.createDirectory(token, uuid, currentPath, newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
      loadFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const createFile = async () => {
    if (!token || !newFileName.trim()) return;
    try {
      await api.servers.files.write(token, uuid, currentPath === '/' ? `/${newFileName.trim()}` : `${currentPath}/${newFileName.trim()}`, '');
      setNewFileName('');
      setShowNewFile(false);
      loadFiles(currentPath);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const downloadFile = async (filePath: string) => {
    if (!token) return;
    try {
      const res = await api.servers.files.downloadUrl(token, uuid, filePath);
      window.open(res.url || res, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (tab === 'files') loadFiles(currentPath);
  }, [tab, currentPath, loadFiles]);

  useEffect(() => {
    if (tab !== 'files') return;
    if (!editingFileParam) {
      setEditingFile(null);
      setFileContent('');
      setOriginalFileContent('');
      return;
    }
    if (editingFileParam !== editingFile) {
      void openFile(editingFileParam);
    }
  }, [tab, editingFileParam]);

  // ── Backups ──

  const loadBackups = useCallback(async () => {
    if (!token) return;
    setBackupsLoading(true);
    try {
      const res = await api.servers.backups.list(token, uuid);
      const raw = res?.data ?? res?.backups?.data ?? res?.backups ?? [];
      setBackups(raw.map((b: any) => b.attributes ?? b));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBackupsLoading(false);
    }
  }, [token, uuid]);

  const createBackup = async () => {
    if (!token) return;
    try {
      await api.servers.backups.create(token, uuid, backupName || undefined);
      setBackupName('');
      loadBackups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Auto-poll backups while any are in progress
  useEffect(() => {
    if (tab !== 'backups') return;
    const hasInProgress = backups.some((b: any) => !b.completed);
    if (!hasInProgress) return;
    const interval = setInterval(() => loadBackups(), 5000);
    return () => clearInterval(interval);
  }, [tab, backups, loadBackups]);

  const deleteBackup = async (backupUuid: string) => {
    if (!token || !confirm('Delete this backup?')) return;
    try {
      await api.servers.backups.remove(token, uuid, backupUuid);
      loadBackups();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const downloadBackup = async (backupUuid: string) => {
    if (!token) return;
    try {
      const res = await api.servers.backups.download(token, uuid, backupUuid);
      const url = res?.attributes?.url ?? res?.url;
      if (url) window.open(url, '_blank');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const restoreBackup = async (backupUuid: string) => {
    if (!token || !confirm('Restore this backup? This will overwrite current server files.')) return;
    try {
      await api.servers.backups.restore(token, uuid, backupUuid);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (tab === 'backups') loadBackups();
  }, [tab]);

  // ── Startup ──

  const loadStartup = useCallback(async () => {
    if (!token) return;
    setStartupLoading(true);
    try {
      const res = await api.servers.startup.get(token, uuid);
      const vars = res?.data ?? res?.variables?.data ?? res?.variables ?? res ?? [];
      setStartupVars(Array.isArray(vars) ? vars : []);
      const edits: Record<string, string> = {};
      for (const v of (Array.isArray(vars) ? vars : [])) {
        edits[v.env_variable] = v.value ?? v.default_value ?? '';
      }
      setVarEdits(edits);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStartupLoading(false);
    }
  }, [token, uuid]);

  const saveStartup = async () => {
    if (!token) return;
    try {
      await api.servers.startup.update(token, uuid, varEdits);
    } catch (err: any) {
      setError(err.message);
    }
    if (dockerImage) {
      try {
        await api.servers.startup.updateDockerImage(token, uuid, dockerImage);
      } catch (err: any) {
        setError(err.message);
      }
    }
    loadStartup();
  };

  useEffect(() => {
    if (tab === 'startup') loadStartup();
  }, [tab]);

  // ── Plugins ──

  const searchPlugins = useCallback((query: string, loader = pluginLoader, category = pluginCategory) => {
    setPluginSearching(true);
    setPluginMsg(null);
    const facetGroups: string[][] = [[`project_type:plugin`]];
    if (loader) facetGroups.push([`categories:${loader}`]);
    if (category) facetGroups.push([`categories:${category}`]);
    const facets = JSON.stringify(facetGroups);
    const base = query.trim()
      ? `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=20`
      : `https://api.modrinth.com/v2/search?limit=20&index=downloads`;
    fetch(`${base}&facets=${encodeURIComponent(facets)}`)
      .then((r) => r.json())
      .then((d) => setPluginResults(d.hits ?? []))
      .catch(() => setPluginResults([]))
      .finally(() => setPluginSearching(false));
  }, [pluginLoader, pluginCategory]);

  const loadInstalledPlugins = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.servers.files.list(token, uuid, '/plugins');
      const files: any[] = res?.data ?? res?.files ?? res ?? [];
      const jars = files.filter((f: any) => f.file && (f.name as string).endsWith('.jar'));
      setInstalledPluginFiles(jars);
      setInstalledPlugins(new Set(jars.map((f: any) => f.name as string)));
    } catch {
      setInstalledPlugins(new Set());
      setInstalledPluginFiles([]);
    }
  }, [token, uuid]);

  useEffect(() => {
    if (tab === 'plugins') {
      searchPlugins('');
      loadInstalledPlugins();
    }
  }, [tab]);

  // ── Activity ──

  const loadActivity = useCallback(async () => {
    if (!token) return;
    setActivityLoading(true);
    try {
      const res = await api.servers.activity(token, uuid);
      setActivities(res?.data ?? res?.activities?.data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActivityLoading(false);
    }
  }, [token, uuid]);

  useEffect(() => {
    if (tab === 'activity') loadActivity();
  }, [tab]);

  // ── Settings ──

  const handleRename = async () => {
    if (!token || !renameValue.trim()) return;
    try {
      await api.servers.rename(token, uuid, renameValue.trim());
      loadServer();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const [showReinstall, setShowReinstall] = useState(false);
  const [reinstallDeleteFiles, setReinstallDeleteFiles] = useState(true);
  const [showEula, setShowEula] = useState(false);
  const eulaDismissedRef = useRef(false);

  const handleReinstall = async () => {
    if (!token) return;
    try {
      await api.servers.reinstall(token, uuid, reinstallDeleteFiles);
      setShowReinstall(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!token || !confirm('Delete this server permanently? This cannot be undone.')) return;
    try {
      await api.servers.delete(token, uuid);
      router.push('/servers');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Helpers ──

  const getMonacoLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      json: 'json', html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
      css: 'css', scss: 'scss', less: 'less',
      md: 'markdown', yaml: 'yaml', yml: 'yaml', toml: 'ini',
      py: 'python', java: 'java', kt: 'kotlin', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c',
      go: 'go', rs: 'rust', rb: 'ruby', php: 'php', lua: 'lua',
      sh: 'shell', bash: 'shell', bat: 'bat', ps1: 'powershell',
      sql: 'sql', graphql: 'graphql',
      ini: 'ini', cfg: 'ini', conf: 'ini', properties: 'ini', env: 'ini',
      dockerfile: 'dockerfile', log: 'plaintext', txt: 'plaintext', csv: 'plaintext',
    };
    if (filename.toLowerCase() === 'dockerfile') return 'dockerfile';
    return map[ext] || 'plaintext';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const serverState = resources?.state ?? resources?.status ?? 'offline';

  const statusColor = serverState === 'running' ? 'bg-emerald-500' :
    serverState === 'starting' ? 'bg-yellow-500' :
    serverState === 'stopping' ? 'bg-orange-500' :
    serverState === 'installing' ? 'bg-blue-500 animate-pulse' :
    serverState === 'install_failed' ? 'bg-destructive' : 'bg-muted-foreground/50';

  const statusLabel = serverState === 'running' ? 'Running' :
    serverState === 'starting' ? 'Starting' :
    serverState === 'stopping' ? 'Stopping' :
    serverState === 'installing' ? 'Installing…' :
    serverState === 'install_failed' ? 'Install Failed' : 'Offline';

  const pathParts = currentPath.split('/').filter(Boolean);
  const displayedFiles = files.sort((a, b) => {
    if (a.directory && !b.directory) return -1;
    if (!a.directory && b.directory) return 1;
    return a.name.localeCompare(b.name);
  });
  const selectedCount = selectedFiles.size;
  const directoryCount = files.filter((file) => file.directory).length;
  const fileCount = files.filter((file) => !file.directory).length;
  const isEditorDirty = editingFile ? fileContent !== originalFileContent : false;

  const closeEditor = () => {
    if (isEditorDirty && !confirm('Discard unsaved changes?')) return;
    updateFilesLocation(currentPath, null);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error && !server) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" asChild><Link href="/servers">Back to Servers</Link></Button>
      </div>
    );
  }

  const isMinecraftServer =
    matchedEgg?.type?.toLowerCase() === 'minecraft' ||
    matchedEgg?.category?.toLowerCase() === 'minecraft' ||
    /minecraft/i.test(matchedEgg?.name ?? '') ||
    /minecraft/i.test(server?.egg?.name ?? '');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'console', label: 'Console', icon: <TerminalIcon className="size-4" /> },
    { key: 'files', label: 'Files', icon: <FolderIcon className="size-4" /> },
    { key: 'backups', label: 'Backups', icon: <DatabaseIcon className="size-4" /> },
    { key: 'startup', label: 'Startup', icon: <CpuIcon className="size-4" /> },
    ...(isMinecraftServer ? [{ key: 'plugins' as Tab, label: 'Plugins', icon: <PuzzleIcon className="size-4" /> }] : []),
    { key: 'resources', label: 'Resources', icon: <CoinsIcon className="size-4" /> },
    { key: 'settings', label: 'Settings', icon: <SettingsIcon className="size-4" /> },
    { key: 'activity', label: 'Activity', icon: <ClockIcon className="size-4" /> },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/servers"><ArrowLeftIcon className="size-4" /></Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className={`size-3 rounded-full ${statusColor}`} />
          {eggLogo && (
            <img src={eggLogo} alt="" className="size-6 rounded object-contain" />
          )}
          <div>
            <h1 className="text-xl font-bold">{server?.name}</h1>
            <p className="text-xs text-muted-foreground">{server?.uuid_short || uuid.substring(0, 8)}</p>
          </div>
          <Badge variant="outline">{statusLabel}</Badge>
          {server?.allocation && (
            <button
              onClick={() => navigator.clipboard.writeText(`${server.allocation.ip}:${server.allocation.port}`)}
              className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors cursor-pointer"
              title="Click to copy"
            >
              {server.allocation.ip}:{server.allocation.port}
            </button>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => sendPower('start')} disabled={serverState === 'running'}>
            <PlayIcon className="size-4 mr-1" /> Start
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendPower('restart')}>
            <RotateCcwIcon className="size-4 mr-1" /> Restart
          </Button>
          <Button size="sm" variant="outline" onClick={() => sendPower('stop')} disabled={serverState === 'offline'}>
            <SquareIcon className="size-4 mr-1" /> Stop
          </Button>
          <Button size="sm" variant="destructive" onClick={() => sendPower('kill')} disabled={serverState === 'offline'}>
            <SkullIcon className="size-4 mr-1" /> Kill
          </Button>
        </div>
      </div>

      {/* Resource cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { icon: CpuIcon, label: 'CPU', value: `${(resources?.cpu_absolute ?? 0).toFixed(1)}%`, limit: server?.limits?.cpu ? `/ ${server.limits.cpu}%` : '', data: cpuHistory, max: server?.limits?.cpu || 100, color: '#71717a' },
          { icon: MemoryStickIcon, label: 'Memory', value: formatBytes(resources?.memory_bytes ?? 0), limit: server?.limits?.memory ? `/ ${formatBytes(server.limits.memory * 1024 * 1024)}` : '', data: memHistory, max: server?.limits?.memory ? server.limits.memory * 1024 * 1024 : undefined, color: '#71717a' },
          { icon: HardDriveIcon, label: 'Disk', value: formatBytes(resources?.disk_bytes ?? 0), limit: server?.limits?.disk ? `/ ${formatBytes(server.limits.disk * 1024 * 1024)}` : '', data: diskHistory, max: server?.limits?.disk ? server.limits.disk * 1024 * 1024 : undefined, color: '#71717a' },
          { icon: NetworkIcon, label: 'Network', value: '', limit: '', data: [], color: '#71717a', isNetwork: true },
        ].map(({ icon: Icon, label, value, limit, data, max, color, isNetwork }) => (
          <Card key={label} className="overflow-hidden relative group">
            <div className="absolute inset-x-0 bottom-0 pointer-events-none">
              <Sparkline data={data} max={max} color={color} className="h-12" />
            </div>
            <CardContent className="relative z-10 p-3 pb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="size-3.5 text-muted-foreground/70" />
                <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
              </div>
              {isNetwork ? (
                <p className="text-base font-semibold tabular-nums tracking-tight">
                  ↑{formatBytes(resources?.network?.tx_bytes ?? 0)} ↓{formatBytes(resources?.network?.rx_bytes ?? 0)}
                </p>
              ) : (
                <p className="text-base font-semibold tabular-nums tracking-tight">
                  {value}
                  {limit && <span className="text-xs font-normal text-muted-foreground/50 ml-1">{limit}</span>}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/50 p-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
              tab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ CONSOLE TAB ═══ */}
      {tab === 'console' && (
        <div className="flex flex-col flex-1 min-h-[600px]">
          {/* Console container */}
          <div className="flex flex-col flex-1 min-h-0 min-w-0 rounded-lg border bg-card overflow-hidden">
            {/* Console toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/50">
              <div className="flex items-center gap-2">
                <div className={`size-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-xs text-muted-foreground font-mono">
                  {wsConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setShowSearch(!showSearch); if (showSearch) searchAddonRef.current?.clearDecorations(); }}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                  title="Search"
                >
                  <SearchIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => {
                    xtermRef.current?.clear();
                    historyBufferRef.current = [];
                  }}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                  title="Clear console"
                >
                  <TrashIcon className="size-3.5" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => { const s = Math.max(10, fontSize - 1); setFontSize(s); if (xtermRef.current) { xtermRef.current.options.fontSize = s; fitAddonRef.current?.fit(); } }}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                  title="Decrease font size"
                >
                  <MinusIcon className="size-3.5" />
                </button>
                <span className="text-xs text-muted-foreground font-mono min-w-[28px] text-center">{fontSize}px</span>
                <button
                  onClick={() => { const s = Math.min(24, fontSize + 1); setFontSize(s); if (xtermRef.current) { xtermRef.current.options.fontSize = s; fitAddonRef.current?.fit(); } }}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                  title="Increase font size"
                >
                  <PlusIcon className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Search bar */}
            {showSearch && (
              <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/50">
                <SearchIcon className="size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) searchAddonRef.current?.findNext(e.target.value);
                    else searchAddonRef.current?.clearDecorations();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) searchAddonRef.current?.findPrevious(searchQuery);
                      else searchAddonRef.current?.findNext(searchQuery);
                    }
                    if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); searchAddonRef.current?.clearDecorations(); }
                  }}
                  className="flex-1 bg-transparent text-xs text-foreground font-mono placeholder:text-muted-foreground outline-none"
                  autoFocus
                />
              </div>
            )}

            {/* xterm.js terminal */}
            <div
              ref={terminalCallbackRef}
              className="flex-1 min-h-[400px]"
              style={{ background: '#09090b' }}
            />

            {/* Command input */}
            <div className="flex items-center border-t bg-muted/50 px-3">
              <span className="text-xs text-muted-foreground font-mono mr-2">{'>'}</span>
              <input
                type="text"
                placeholder="Type a command..."
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCommand()}
                className="flex-1 bg-transparent text-sm text-foreground font-mono py-2.5 placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={sendCommand}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
              >
                <SendIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FILES TAB ═══ */}
      {tab === 'files' && !editingFile && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <button
                    onClick={() => updateFilesLocation('/')}
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                  >
                    <HomeIcon className="size-3.5" />
                  </button>
              {pathParts.map((part, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <ChevronRightIcon className="size-3 text-muted-foreground/60" />
                  <DropdownMenu onOpenChange={(open) => {
                    if (open) {
                      void loadBreadcrumbEntries('/' + pathParts.slice(0, i + 1).join('/'));
                    }
                  }}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-foreground/90 transition hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="max-w-40 truncate">{part}</span>
                        <ChevronRightIcon className="size-3 rotate-90 text-muted-foreground/60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      <DropdownMenuLabel className="font-mono text-[11px]">
                        {'/' + pathParts.slice(0, i + 1).join('/')}
                      </DropdownMenuLabel>
                      <div className="px-1 py-1.5">
                        <div className="relative">
                          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={breadcrumbSearch['/' + pathParts.slice(0, i + 1).join('/')] || ''}
                            onChange={(e) => setBreadcrumbSearch((prev) => ({
                              ...prev,
                              ['/' + pathParts.slice(0, i + 1).join('/')]: e.target.value,
                            }))}
                            placeholder="Search files..."
                            className="h-8 pl-9 text-xs"
                          />
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <div className="max-h-72 overflow-y-auto">
                        {(breadcrumbLoading === '/' + pathParts.slice(0, i + 1).join('/') ? [] : (breadcrumbEntries['/' + pathParts.slice(0, i + 1).join('/')] || []))
                          .filter((entry) => entry.name.toLowerCase().includes((breadcrumbSearch['/' + pathParts.slice(0, i + 1).join('/')] || '').toLowerCase()))
                          .sort((a, b) => {
                            if (a.directory && !b.directory) return -1;
                            if (!a.directory && b.directory) return 1;
                            return a.name.localeCompare(b.name);
                          })
                          .map((entry) => {
                            const dirPath = '/' + pathParts.slice(0, i + 1).join('/');
                            const fullPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;
                            return (
                              <DropdownMenuItem
                                key={entry.name}
                                onClick={() => {
                                  if (entry.directory) updateFilesLocation(fullPath);
                                  else if (isTextLikeFile(entry)) updateFilesLocation(dirPath, fullPath);
                                  else downloadFile(fullPath);
                                }}
                              >
                                {entry.directory ? (
                                  <FolderIcon className="size-4 mr-2 text-primary" />
                                ) : (
                                  <FileTextIcon className="size-4 mr-2 text-muted-foreground" />
                                )}
                                <span className="truncate">{entry.name}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        {breadcrumbLoading === '/' + pathParts.slice(0, i + 1).join('/') ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
                        ) : null}
                        {breadcrumbLoading !== '/' + pathParts.slice(0, i + 1).join('/') &&
                        ((breadcrumbEntries['/' + pathParts.slice(0, i + 1).join('/')] || []).filter((entry) => entry.name.toLowerCase().includes((breadcrumbSearch['/' + pathParts.slice(0, i + 1).join('/')] || '').toLowerCase())).length === 0) ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">No files found.</div>
                        ) : null}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowNewFile(true)}>
                <PlusIcon className="size-4 mr-1" /> Create File
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
                <PlusIcon className="size-4 mr-1" /> Create Directory
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowUploadDialog(true)}>
                <UploadIcon className="size-4 mr-1" /> Upload
              </Button>
              {selectedCount > 0 ? (
                <Button size="sm" variant="destructive" onClick={deleteSelectedFiles}>
                  <TrashIcon className="size-4 mr-1" /> Delete
                </Button>
              ) : null}
            </div>
            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>

          <div className="relative rounded-md border bg-background">
            {filesLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="overflow-hidden">
                <div className="grid grid-cols-[36px_minmax(0,1.6fr)_120px_160px_44px] items-center border-b px-4 py-2 text-[11px] text-muted-foreground">
                  <span />
                  <span>Name</span>
                  <span className="text-right">Size</span>
                  <span className="hidden md:block text-right">Modified</span>
                  <span />
                </div>
                {currentPath !== '/' && (
                  <button
                    onClick={() => {
                      const parent = '/' + pathParts.slice(0, -1).join('/');
                      updateFilesLocation(parent || '/');
                    }}
                    className="grid w-full grid-cols-[36px_minmax(0,1.6fr)_120px_160px_44px] items-center border-b px-4 py-3 text-left text-sm transition hover:bg-muted/40"
                  >
                    <span />
                    <span className="flex items-center gap-3 min-w-0">
                      <FolderIcon className="size-4 shrink-0 text-blue-400" />
                      <span className="truncate text-muted-foreground">..</span>
                    </span>
                    <span />
                    <span />
                    <span />
                  </button>
                )}
                {displayedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                    <FolderIcon className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-medium">
                      {files.length === 0 ? 'This folder is empty' : 'No matches in this folder'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {files.length === 0 ? 'Upload files or create a folder to get started.' : 'Try a different search term.'}
                    </p>
                  </div>
                ) : (
                  displayedFiles.map((file) => {
                    const fullPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
                    const isTextLike = isTextLikeFile(file);

                    return (
                      <div key={file.name} className="grid grid-cols-[36px_minmax(0,1.6fr)_120px_160px_44px] items-center border-b px-4 py-3 text-sm transition hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.name)}
                          onChange={(e) => {
                            const s = new Set(selectedFiles);
                            e.target.checked ? s.add(file.name) : s.delete(file.name);
                            setSelectedFiles(s);
                          }}
                          className="rounded border-muted-foreground/30"
                        />
                        <button
                          onClick={() => file.directory ? updateFilesLocation(fullPath) : (isTextLike ? updateFilesLocation(currentPath, fullPath) : downloadFile(fullPath))}
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          {file.directory ? (
                            <FolderIcon className="size-4 shrink-0 text-primary" />
                          ) : (
                            <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">{file.name}</div>
                          </div>
                        </button>
                        <span className="text-right text-xs text-muted-foreground">
                          {file.directory ? '—' : formatBytes(file.size)}
                        </span>
                        <span className="hidden text-right text-xs text-muted-foreground md:block">
                          {file.modified ? new Date(file.modified).toLocaleDateString() : '—'}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="ml-auto size-8 p-0">
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {file.directory ? (
                              <DropdownMenuItem onClick={() => updateFilesLocation(fullPath)}>
                                <FolderIcon className="size-4 mr-2" /> Open
                              </DropdownMenuItem>
                            ) : (
                              <>
                                {isTextLike ? (
                                  <DropdownMenuItem onClick={() => updateFilesLocation(currentPath, fullPath)}>
                                    <PencilIcon className="size-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem onClick={() => downloadFile(fullPath)}>
                                  <DownloadIcon className="size-4 mr-2" /> Download
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteFilesByName([file.name])}
                              className="text-destructive focus:text-destructive"
                            >
                              <TrashIcon className="size-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <Dialog open={showNewFile} onOpenChange={setShowNewFile}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create File</DialogTitle>
                <DialogDescription>Create a new empty file in {currentPath}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="notes.txt"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createFile()}
                  autoFocus
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowNewFile(false); setNewFileName(''); }}>Cancel</Button>
                  <Button onClick={createFile}>Create</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Directory</DialogTitle>
                <DialogDescription>Create a new directory in {currentPath}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="new-folder"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                  autoFocus
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}>Cancel</Button>
                  <Button onClick={createFolder}>Create</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File</DialogTitle>
                <DialogDescription>Upload a file to {currentPath}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="file"
                  onChange={(e) => setUploadDialogFile(e.target.files?.[0] || null)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setShowUploadDialog(false); setUploadDialogFile(null); }}>Cancel</Button>
                  <Button
                    disabled={!uploadDialogFile || uploading}
                    onClick={async () => {
                      if (!uploadDialogFile) return;
                      const dt = new DataTransfer();
                      dt.items.add(uploadDialogFile);
                      await uploadFiles(dt.files);
                      setUploadDialogFile(null);
                      setShowUploadDialog(false);
                    }}
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ═══ FILE EDITOR ═══ */}
      {tab === 'files' && editingFile && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <button
                onClick={closeEditor}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ArrowLeftIcon className="size-4" />
                Files
              </button>
              <ChevronRightIcon className="size-3 text-muted-foreground" />
              <span className="truncate font-mono text-muted-foreground">{editingFile}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadFile(editingFile)}>
                <DownloadIcon className="size-4 mr-1" /> Download
              </Button>
              <Button size="sm" onClick={saveFile} disabled={fileSaving}>
                <SaveIcon className="size-4 mr-1" /> {fileSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          <div className="h-[600px] overflow-hidden rounded-md border bg-background">
            {isEditorDirty ? (
              <div className="border-b px-4 py-2 text-xs text-muted-foreground">Unsaved changes</div>
            ) : null}
            <Editor
              height="100%"
              theme="vs-dark"
              language={getMonacoLanguage(editingFile)}
              value={fileContent}
              onChange={(value) => setFileContent(value ?? '')}
              onMount={(editor) => {
                editor.addCommand(2048 | 49 /* KeyMod.CtrlCmd | KeyCode.KeyS */, () => {
                  saveFileRef.current();
                });
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ BACKUPS TAB ═══ */}
      {tab === 'backups' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Backups</CardTitle>
                <span className="text-xs text-muted-foreground">{backups.length} / {server?.featureLimits?.backups ?? 0}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Backup name (optional)"
                  value={backupName}
                  onChange={(e) => setBackupName(e.target.value)}
                  className="w-48"
                  disabled={backups.length >= (server?.featureLimits?.backups ?? 0)}
                />
                <Button size="sm" onClick={createBackup} disabled={backups.length >= (server?.featureLimits?.backups ?? 0)}>
                  <PlusIcon className="size-4 mr-1" /> Create
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {backupsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : backups.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No backups yet.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {backups.map((backup: any) => (
                  <div key={backup.uuid} className="flex items-center justify-between p-3 text-sm gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ArchiveIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{backup.name}</p>
                          {!backup.completed ? (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-[10px]">In progress</Badge>
                          ) : backup.is_successful === false ? (
                            <Badge variant="destructive" className="text-[10px]">Failed</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">Completed</Badge>
                          )}
                          {backup.is_locked && <Badge variant="outline" className="text-[10px]">Locked</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatBytes(backup.bytes ?? 0)}</span>
                          <span className="text-xs text-muted-foreground">{new Date(backup.created).toLocaleString()}</span>
                          {backup.checksum && (
                            <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[300px]">{backup.checksum}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-8 p-0">
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadBackup(backup.uuid)} disabled={!backup.completed || !backup.is_successful}>
                          <DownloadIcon className="size-4 mr-2" /> Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => restoreBackup(backup.uuid)} disabled={!backup.completed || !backup.is_successful}>
                          <RefreshCcwIcon className="size-4 mr-2" /> Restore
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteBackup(backup.uuid)} className="text-destructive focus:text-destructive">
                          <TrashIcon className="size-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ STARTUP TAB ═══ */}
      {tab === 'startup' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Startup Variables</CardTitle>
                <CardDescription>Configure environment variables for your server.</CardDescription>
              </div>
              <Button size="sm" onClick={saveStartup}>
                <SaveIcon className="size-4 mr-1" /> Save
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {startupLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : startupVars.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No startup variables.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {startupVars.map((v: any) => (
                  <div key={v.env_variable} className="rounded-lg border bg-muted/20 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-medium truncate">{v.name}</label>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{v.env_variable}</span>
                    </div>
                    {v.description && <p className="text-xs text-muted-foreground leading-relaxed">{v.description}</p>}
                    <Input
                      value={varEdits[v.env_variable] ?? ''}
                      onChange={(e) => setVarEdits((prev) => ({ ...prev, [v.env_variable]: e.target.value }))}
                      disabled={v.is_editable === false}
                      placeholder={v.default_value || ''}
                      className="font-mono text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
            {(() => {
              const images = matchedEgg?.dockerImages ?? {};
              const entries = Object.entries(images);
              if (entries.length <= 1) return null;
              return (
                <div className="mt-4 rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium">Docker Image</label>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">docker_image</span>
                  </div>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                  >
                    {entries.map(([label, uri]) => (
                      <option key={uri as string} value={uri as string}>{label}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ═══ RESOURCES TAB ═══ */}
      {tab === 'resources' && (
        <ResourcesUpgradeTab
          token={token!}
          uuid={uuid}
          server={server}
          resources={resources}
          onUpgraded={loadServer}
        />
      )}

      {/* ═══ SETTINGS TAB ═══ */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Name</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Server name"
              />
              <Button onClick={handleRename}>
                <PencilIcon className="size-4 mr-1" /> Rename
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reinstall Server</CardTitle>
              <CardDescription>Reinstalling your server will stop it, and then re-run the install script that initially set it up. Some files may be deleted or modified during this process.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setShowReinstall(true)}>
                <RefreshCcwIcon className="size-4 mr-1" /> Reinstall Server
              </Button>
            </CardContent>
          </Card>

          <Dialog open={showReinstall} onOpenChange={setShowReinstall}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reinstall Server</DialogTitle>
                <DialogDescription>
                  Are you sure you want to reinstall this server?
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 py-2">
                <button
                  onClick={() => setReinstallDeleteFiles(!reinstallDeleteFiles)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                    reinstallDeleteFiles ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span className={`pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
                    reinstallDeleteFiles ? 'translate-x-[18px]' : 'translate-x-0.5'
                  } mt-0.5`} />
                </button>
                <p className="text-sm text-muted-foreground">
                  Do you want to delete all files of this server before performing this action? This cannot be undone.
                </p>
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={handleReinstall}>Reinstall</Button>
                <Button variant="outline" onClick={() => setShowReinstall(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Permanently delete this server. This cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleDelete}>
                <TrashIcon className="size-4 mr-1" /> Delete Server
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══ PLUGINS TAB ═══ */}
      {tab === 'plugins' && (
        <div className="space-y-4">
        {installedPluginFiles.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Installed Plugins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {installedPluginFiles.map((f: any) => (
                  <div key={f.name} className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5">
                    <PuzzleIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{(f.name as string).replace(/\.jar$/i, '')}</span>
                    <Badge variant="secondary" className="text-[10px] ml-1">jar</Badge>
                    {f.size != null && (
                      <span className="text-[11px] text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="space-y-4">
            {pluginMsg && (
              <div className={`rounded-md p-3 text-sm ${
                pluginMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
              }`}>
                {pluginMsg.text}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Search plugins on Modrinth…"
                value={pluginSearch}
                onChange={(e) => setPluginSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') searchPlugins(pluginSearch); }}
              />
              <Button
                variant="outline"
                onClick={() => searchPlugins(pluginSearch)}
                disabled={pluginSearching}
              >
                <SearchIcon className="size-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                value={pluginLoader || '__all__'}
                onValueChange={(v) => { const val = v === '__all__' ? '' : v; setPluginLoader(val); searchPlugins(pluginSearch, val, pluginCategory); }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All loaders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All loaders</SelectItem>
                  <SelectItem value="paper">Paper</SelectItem>
                  <SelectItem value="purpur">Purpur</SelectItem>
                  <SelectItem value="spigot">Spigot</SelectItem>
                  <SelectItem value="bukkit">Bukkit</SelectItem>
                  <SelectItem value="folia">Folia</SelectItem>
                  <SelectItem value="bungeecord">BungeeCord</SelectItem>
                  <SelectItem value="waterfall">Waterfall</SelectItem>
                  <SelectItem value="velocity">Velocity</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={pluginCategory || '__all__'}
                onValueChange={(v) => { const val = v === '__all__' ? '' : v; setPluginCategory(val); searchPlugins(pluginSearch, pluginLoader, val); }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All categories</SelectItem>
                  <SelectItem value="admin-tools">Admin Tools</SelectItem>
                  <SelectItem value="chat">Chat</SelectItem>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="game-mechanics">Game Mechanics</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                  <SelectItem value="minigame">Minigame</SelectItem>
                  <SelectItem value="mobs">Mobs</SelectItem>
                  <SelectItem value="optimization">Optimization</SelectItem>
                  <SelectItem value="protection">Protection</SelectItem>
                  <SelectItem value="pvp">PvP</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="transportation">Transportation</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="world-management">World Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {pluginSearching ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : pluginResults.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No plugins found. Try a different search.</p>
            ) : (
              <div className="space-y-2">
                {pluginResults.map((plugin: any) => (
                  <div key={plugin.project_id} className="rounded-lg border bg-muted/20 overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                    {plugin.icon_url ? (
                      <img src={plugin.icon_url} alt={plugin.title} className="size-10 rounded-md object-contain shrink-0" />
                    ) : (
                      <div className="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <PuzzleIcon className="size-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{plugin.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{plugin.downloads?.toLocaleString()} downloads</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{plugin.description}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(plugin.categories ?? []).slice(0, 3).map((c: string) => (
                          <span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{c}</span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {(() => {
                        const slug = plugin.slug ?? plugin.title?.toLowerCase().replace(/\s+/g, '-');
                        const isInstalled = plugin.files?.some((f: any) => installedPlugins.has(f.filename)) ||
                          [...installedPlugins].some((name) => name.toLowerCase().startsWith(slug?.toLowerCase() ?? '\0'));
                        return isInstalled ? (
                          <Badge variant="secondary" className="text-[10px]">Installed</Badge>
                        ) : null;
                      })()}
                      <Button
                        size="sm"
                        disabled={!!pluginProgress?.[plugin.project_id]}
                        onClick={async () => {
                          if (!token) return;
                          const pid = plugin.project_id;
                          const step = (label: string, pct: number) => setPluginProgress((p) => ({ ...p, [pid]: { label, pct } }));
                          const clear = () => setPluginProgress((p) => { const n = { ...p }; delete n[pid]; return n; });
                          setPluginMsg(null);
                          try {
                            step('Fetching version…', 20);
                            const vRes = await fetch(`https://api.modrinth.com/v2/project/${pid}/version?loaders=["bukkit","spigot","paper","purpur","folia","bungeecord","waterfall","velocity"]&featured=true`);
                            const versions = await vRes.json();
                            const ver = Array.isArray(versions) && versions.length > 0 ? versions[0] : null;
                            const file = ver?.files?.find((f: any) => f.primary) ?? ver?.files?.[0];
                            if (!file) throw new Error('No downloadable file found for this plugin.');
                            step('Downloading…', 55);
                            await api.servers.plugins.install(token, uuid, file.url, file.filename);
                            step('Installing…', 90);
                            await new Promise((r) => setTimeout(r, 400));
                            clear();
                            setPluginMsg({ type: 'success', text: `${plugin.title} installed to /plugins/${file.filename}` });
                            loadInstalledPlugins();
                          } catch (err: any) {
                            clear();
                            setPluginMsg({ type: 'error', text: err.message });
                          }
                        }}
                      >
                        {pluginProgress?.[plugin.project_id] ? (
                          <RefreshCcwIcon className="size-3.5 animate-spin" />
                        ) : (
                          <DownloadIcon className="size-3.5 mr-1" />
                        )}
                        {pluginProgress?.[plugin.project_id] ? '' : 'Install'}
                      </Button>
                    </div>
                    </div>
                    {pluginProgress?.[plugin.project_id] && (
                      <div className="px-3 pb-2.5 space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{pluginProgress[plugin.project_id]!.label}</span>
                          <span>{pluginProgress[plugin.project_id]!.pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${pluginProgress[plugin.project_id]!.pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* ═══ ACTIVITY TAB ═══ */}
      {tab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No activity recorded.</p>
            ) : (
              <div className="rounded-lg border divide-y">
                {activities.map((activity: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <ClockIcon className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{activity.event}</p>
                        {activity.ip && <p className="text-xs text-muted-foreground">{activity.ip}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(activity.created).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* EULA Dialog */}
      <Dialog open={showEula} onOpenChange={(open) => { if (!open) eulaDismissedRef.current = true; setShowEula(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Minecraft EULA</DialogTitle>
            <DialogDescription>
              By pressing &quot;I Accept&quot; below you are indicating your agreement to the{' '}
              <a href="https://aka.ms/MinecraftEULA" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Minecraft EULA
              </a>.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will write <code className="rounded bg-muted px-1 py-0.5 text-xs">eula=true</code> to <code className="rounded bg-muted px-1 py-0.5 text-xs">eula.txt</code> and restart your server.
          </p>
          <DialogFooter>
            <Button onClick={async () => {
              if (!token) return;
              try {
                await api.servers.files.write(token, uuid, '/eula.txt', 'eula=true\n');
                await api.servers.power(token, uuid, 'restart');
                setShowEula(false);
                eulaDismissedRef.current = true;
              } catch (err: any) {
                setError(err.message);
              }
            }}>
              I Accept
            </Button>
            <Button variant="outline" onClick={() => { setShowEula(false); eulaDismissedRef.current = true; }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ResourcesUpgradeTab({
  token,
  uuid,
  server,
  resources,
  onUpgraded,
}: {
  token: string;
  uuid: string;
  server: any;
  resources: any;
  onUpgraded: () => void;
}) {
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [userRes, setUserRes] = useState<any>(null);
  const [newRam, setNewRam] = useState(0);
  const [newDisk, setNewDisk] = useState(0);
  const [newCpu, setNewCpu] = useState(0);
  const [upgrading, setUpgrading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentRam = server?.limits?.memory ?? 0;
  const currentDisk = server?.limits?.disk ?? 0;
  const currentCpu = server?.limits?.cpu ?? 0;

  useEffect(() => {
    if (!token) return;
    Promise.all([api.store.items(token), api.store.resources(token)])
      .then(([items, res]) => {
        setStoreItems(items);
        setUserRes(res);
        setNewRam(currentRam);
        setNewDisk(currentDisk);
        setNewCpu(currentCpu);
      })
      .catch(() => {});
  }, [token, currentRam, currentDisk, currentCpu]);

  const coins = userRes?.coins ?? 0;
  const availRam = resources?.available?.ram ?? 0;
  const availDisk = resources?.available?.disk ?? 0;
  const availCpu = resources?.available?.cpu ?? 0;

  const maxRam = currentRam + availRam;
  const maxDisk = currentDisk + availDisk;
  const maxCpu = currentCpu + availCpu;

  const ramDelta = newRam - currentRam;
  const diskDelta = newDisk - currentDisk;
  const cpuDelta = newCpu - currentCpu;

  // Cost = delta / storeItem.amount * price
  const costFor = (resource: string, delta: number) => {
    if (delta <= 0) return 0;
    const item = storeItems.find((i) => i.resource === resource);
    if (!item || !item.amount) return 0;
    return Math.ceil(delta / item.amount) * item.price;
  };

  const totalCost = costFor('ram', ramDelta) + costFor('disk', diskDelta) + costFor('cpu', cpuDelta);
  const hasChanges = ramDelta !== 0 || diskDelta !== 0 || cpuDelta !== 0;

  const handleUpgrade = async () => {
    if (!hasChanges) return;
    setUpgrading(true);
    setMsg(null);
    try {
      await api.servers.modify(token, uuid, { ram: newRam, disk: newDisk, cpu: newCpu });
      setMsg({ type: 'success', text: 'Server resources updated successfully.' });
      onUpgraded();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setUpgrading(false);
    }
  };

  const ResourceRow = ({
    label,
    icon,
    current,
    value,
    max,
    unit,
    step,
    resource,
    onChange,
  }: {
    label: string;
    icon: React.ReactNode;
    current: number;
    value: number;
    max: number;
    unit: string;
    step: number;
    resource: string;
    onChange: (v: number) => void;
  }) => {
    const delta = value - current;
    const cost = costFor(resource, delta);
    const item = storeItems.find((i) => i.resource === resource);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            {icon}
            {label}
          </div>
          <div className="flex items-center gap-3 text-sm">
            {delta > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <CoinsIcon className="size-3" /> {cost} coins
              </span>
            )}
            <span className="font-mono tabular-nums">
              {value.toLocaleString()} {unit}
            </span>
          </div>
        </div>
        <input
          type="range"
          min={current}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-primary"
          disabled={max <= current}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Current: {current.toLocaleString()} {unit}</span>
          {item && <span>{item.price} coins / {item.amount} {unit}</span>}
          <span>Max: {max.toLocaleString()} {unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Upgrade Resources</CardTitle>
            <CardDescription>Allocate more resources to this server using your available quota.</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <CoinsIcon className="size-4 text-yellow-500" />
            <span>{coins.toFixed(0)} coins</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {msg && (
            <div className={`rounded-md p-3 text-sm ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
              {msg.text}
            </div>
          )}

          <ResourceRow
            label="RAM"
            icon={<MemoryStickIcon className="size-4" />}
            current={currentRam}
            value={newRam}
            max={maxRam}
            unit="MB"
            step={256}
            resource="ram"
            onChange={setNewRam}
          />

          <ResourceRow
            label="Disk"
            icon={<HardDriveIcon className="size-4" />}
            current={currentDisk}
            value={newDisk}
            max={maxDisk}
            unit="MB"
            step={256}
            resource="disk"
            onChange={setNewDisk}
          />

          <ResourceRow
            label="CPU"
            icon={<CpuIcon className="size-4" />}
            current={currentCpu}
            value={newCpu}
            max={maxCpu}
            unit="%"
            step={25}
            resource="cpu"
            onChange={setNewCpu}
          />

          {hasChanges && (
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {totalCost > 0 ? `Total cost: ${totalCost} coins` : 'No extra cost — using available quota'}
              </span>
              <Button onClick={handleUpgrade} disabled={upgrading || (totalCost > coins && totalCost > 0)}>
                {upgrading ? 'Applying…' : 'Apply Changes'}
              </Button>
            </div>
          )}

          {!hasChanges && (
            <p className="text-center text-sm text-muted-foreground py-2">Drag the sliders above to adjust resources.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
