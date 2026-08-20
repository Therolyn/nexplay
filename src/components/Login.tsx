'use client';

import { useEffect, useRef, useState } from 'react';
import { clearSavedCreds, loadSavedCreds, useApp, type ConnMode } from '@/store/useAppStore';

export function Login() {
  const { connect, connecting, error } = useApp();
  const [saved] = useState(() => loadSavedCreds());
  const [mode, setMode] = useState<ConnMode>(saved?.mode === 'm3u' ? 'm3u' : 'xtream');
  const [server, setServer] = useState(saved?.mode === 'xtream' ? saved.server || '' : '');
  const [username, setUsername] = useState(saved?.mode === 'xtream' ? saved.username || '' : '');
  const [password, setPassword] = useState(saved?.mode === 'xtream' ? saved.password || '' : '');
  const [url, setUrl] = useState(saved?.mode === 'm3u' ? saved.url || '' : '');
  const [hasSaved, setHasSaved] = useState(saved !== null);
  const [saveData, setSaveData] = useState(true);
  const autoReconnect = useRef(false);

  useEffect(() => {
    let skipped = false;
    try {
      skipped = sessionStorage.getItem('nexplay_logged_out') === '1';
    } catch {
      /* ignore */
    }
    if (saved && !skipped && !autoReconnect.current) {
      autoReconnect.current = true;
      connect(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = mode === 'xtream' ? { mode, server, username, password } : { mode, url };
    void connect(input).then(() => {
      if (!saveData) {
        clearSavedCreds();
        setHasSaved(false);
      }
    });
  };

  const clearSaved = () => {
    clearSavedCreds();
    setHasSaved(false);
    setSaveData(false);
  };

  const inputCls =
    'w-full rounded-lg bg-zinc-800/80 border border-zinc-700 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition';

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="NexPlay" className="mx-auto h-20 w-auto" />
          <p className="mt-2 text-sm text-zinc-500">Conecte seu provedor Xtream ou lista M3U</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-zinc-800/60 p-1 text-sm font-medium">
          {(['xtream', 'm3u'] as ConnMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-2 transition ${
                mode === m ? 'bg-violet-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m === 'xtream' ? 'Painel Xtream' : 'Lista M3U'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'xtream' ? (
            <>
              <input className={inputCls} placeholder="Servidor (ex: http://seuip:8080)" value={server} onChange={(e) => setServer(e.target.value)} autoFocus />
              <input className={inputCls} placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input className={inputCls} type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          ) : (
            <input
              className={inputCls}
              placeholder="URL da lista (ex: http://servidor/get.php?username=...&password=...&type=m3u_plus)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
          )}

          {error && <p className="rounded-lg bg-red-950/60 border border-red-800 px-4 py-2 text-sm text-red-300">{error}</p>}

          <label className="flex items-center gap-2.5 px-1 text-sm text-zinc-400 select-none">
            <input
              type="checkbox"
              checked={saveData}
              onChange={(e) => setSaveData(e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Salvar dados neste navegador (não digitar novamente)
          </label>

          <button
            type="submit"
            disabled={connecting}
            className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connecting ? 'Conectando…' : 'Conectar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-600">
          As credenciais ficam apenas no seu navegador (token local).
        </p>
        {hasSaved && (
          <button
            type="button"
            onClick={clearSaved}
            className="mt-3 w-full rounded-lg py-2 text-center text-xs text-zinc-500 underline-offset-2 transition hover:text-red-300 hover:underline"
          >
            Limpar dados salvos deste navegador
          </button>
        )}
      </div>
    </div>
  );
}