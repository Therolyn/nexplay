'use client';

import { useEffect, useState } from 'react';
import { isIOS, isTV } from '@/lib/device';

const DISMISS_KEY = 'safiraplay_pwa_dismiss';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as { standalone?: boolean }).standalone)
  );
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    return !!raw && Date.now() - Number(raw) < COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const [installed] = useState(isStandalone);
  const [dismissed] = useState(isDismissed);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios] = useState(isIOS);
  const [tv] = useState(isTV);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (installed || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [installed, dismissed]);

  const dismiss = () => {
    setClosed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setClosed(true);
    if (choice.outcome === 'dismissed') {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* storage blocked */
      }
    }
  };

  if (installed || dismissed || closed || (!ios && !tv && !deferred)) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-50 p-3">
      <div className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-zinc-900 p-4 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="SafiraPlay" className="h-12 w-auto" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Instale o SafiraPlay</p>
            <p className="text-xs text-zinc-400">
              {ios
                ? 'Toque no botão Compartilhar e depois em "Adicionar à Tela de Início".'
                : tv && !deferred
                  ? 'Seu navegador de TV não instala apps — adicione aos favoritos para acesso rápido.'
                  : 'Acesse mais rápido, como um app no seu dispositivo.'}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar aviso de instalação"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        {!ios && deferred && (
          <button
            type="button"
            onClick={install}
            className="min-h-11 w-full rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500"
          >
            Instalar agora
          </button>
        )}
      </div>
    </div>
  );
}