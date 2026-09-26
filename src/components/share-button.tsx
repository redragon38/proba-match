'use client';
import { useState } from 'react';
import { Share2 } from 'lucide-react';
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [status, setStatus] = useState('');
  async function share() {
    const url = new URL(path, location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setStatus('Lien copié');
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setStatus('Copiez l’adresse de cette page depuis votre navigateur.');
    }
  }
  return (
    <div className="share-row">
      <button className="button secondary" onClick={share}>
        <Share2 size={16} />
        Partager le match
      </button>
      <span role="status">{status}</span>
    </div>
  );
}
