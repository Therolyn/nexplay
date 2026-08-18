'use client';

import { useState } from 'react';
import { useApp, type ConnMode } from '@/store/useAppStore';

export function Login() {
  const { connect, connecting, error } = useApp();
  const [mode, setMode] = useState<ConnMode>('xtream');
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'xtream') {
      connect({ mode, server, username, password });
    } else {
      connect({ mode, url });
    }
  };

  const inputCls =
    'w-full rounded-lg bg-zinc-800/80 border border-zinc-700 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition';

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">
            NexPlay
          </h1>
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
      </div>
    </div>
  );
}